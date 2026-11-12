package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/huzairuje/o-drive-go/internal/db"
	"github.com/huzairuje/o-drive-go/internal/model"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type CreateUserRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
	ConfirmPassword string `json:"confirm_password"`
}

func (h *APIHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		jsonError(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	user, err := h.store.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		_ = h.store.LogActivity(r.Context(), &model.ActivityLog{
			ID:        uuid.New().String(),
			UserEmail: req.Email,
			Action:    "auth:login",
			Resource:  "auth",
			Status:    "failed",
			IPAddress: r.RemoteAddr,
		})
		jsonError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		_ = h.store.LogActivity(r.Context(), &model.ActivityLog{
			ID:        uuid.New().String(),
			UserEmail: req.Email,
			Action:    "auth:login",
			Resource:  "auth",
			Status:    "failed",
			IPAddress: r.RemoteAddr,
		})
		jsonError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	tokenBytes := make([]byte, 32)
	_, _ = rand.Read(tokenBytes)
	token := hex.EncodeToString(tokenBytes)
	expiresAt := time.Now().UTC().Add(7 * 24 * time.Hour)

	sess := &model.Session{
		Token:     token,
		UserID:    user.ID,
		UserEmail: user.Email,
		Role:      user.Role,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now().UTC(),
	}
	if err := h.store.CreateSession(r.Context(), sess); err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "omni_session",
		Value:    token,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	_ = h.store.LogActivity(r.Context(), &model.ActivityLog{
		ID:        uuid.New().String(),
		UserEmail: user.Email,
		Action:    "auth:login",
		Resource:  "auth",
		Status:    "success",
		IPAddress: r.RemoteAddr,
	})

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user": map[string]interface{}{
			"id":      user.ID,
			"email":   user.Email,
			"name":    user.Name,
			"role":    user.Role,
			"is_root": user.IsRoot,
		},
	})
}

func (h *APIHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var token string
	if cookie, err := r.Cookie("omni_session"); err == nil && cookie.Value != "" {
		token = cookie.Value
	}
	if token == "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	if token != "" {
		_ = h.store.DeleteSession(r.Context(), token)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "omni_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	user := UserFromContext(r.Context())
	userEmail := "anonymous"
	if user != nil {
		userEmail = user.Email
	}

	_ = h.store.LogActivity(r.Context(), &model.ActivityLog{
		ID:        uuid.New().String(),
		UserEmail: userEmail,
		Action:    "auth:logout",
		Resource:  "auth",
		Status:    "success",
		IPAddress: r.RemoteAddr,
	})

	jsonResponse(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

func (h *APIHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())
	if user == nil {
		http.SetCookie(w, &http.Cookie{
			Name:     "omni_session",
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			Expires:  time.Unix(0, 0),
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})
		jsonError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"user": map[string]interface{}{
			"id":         user.ID,
			"email":      user.Email,
			"name":       user.Name,
			"role":       user.Role,
			"is_root":    user.IsRoot,
			"created_at": user.CreatedAt,
		},
	})
}

func (h *APIHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())
	if user == nil {
		jsonError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		jsonError(w, http.StatusBadRequest, "Current password and new password are required")
		return
	}

	if len(req.NewPassword) < 8 {
		jsonError(w, http.StatusBadRequest, "New password must be at least 8 characters long")
		return
	}

	if req.ConfirmPassword != "" && req.NewPassword != req.ConfirmPassword {
		jsonError(w, http.StatusBadRequest, "New passwords do not match")
		return
	}

	dbUser, err := h.store.GetUserByID(r.Context(), user.ID)
	if err != nil {
		jsonError(w, http.StatusNotFound, "User record not found")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(dbUser.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		_ = h.store.LogActivity(r.Context(), &model.ActivityLog{
			ID:        uuid.New().String(),
			UserEmail: user.Email,
			Action:    "auth:change_password",
			Resource:  "user:" + user.Email,
			Status:    "failed",
			IPAddress: r.RemoteAddr,
		})
		jsonError(w, http.StatusBadRequest, "Current password does not match")
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to hash new password")
		return
	}

	if err := h.store.UpdateUserPassword(r.Context(), user.ID, string(hashed)); err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to update password: "+err.Error())
		return
	}

	_ = h.store.LogActivity(r.Context(), &model.ActivityLog{
		ID:        uuid.New().String(),
		UserEmail: user.Email,
		Action:    "auth:change_password",
		Resource:  "user:" + user.Email,
		Status:    "success",
		IPAddress: r.RemoteAddr,
	})

	jsonResponse(w, http.StatusOK, map[string]string{"status": "password_updated"})
}

func (h *APIHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())
	if user == nil || (user.Role != model.RoleSuperAdmin && user.Role != model.RoleAdmin) {
		jsonError(w, http.StatusForbidden, "Insufficient permissions to manage users")
		return
	}

	users, err := h.store.ListUsers(r.Context())
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to list users: "+err.Error())
		return
	}

	var results []map[string]interface{}
	for _, u := range users {
		results = append(results, map[string]interface{}{
			"id":         u.ID,
			"email":      u.Email,
			"name":       u.Name,
			"role":       u.Role,
			"is_root":    u.IsRoot,
			"created_at": u.CreatedAt,
			"updated_at": u.UpdatedAt,
		})
	}

	if results == nil {
		results = []map[string]interface{}{}
	}

	jsonResponse(w, http.StatusOK, results)
}

func (h *APIHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	caller := UserFromContext(r.Context())
	if caller == nil || (caller.Role != model.RoleSuperAdmin && caller.Role != model.RoleAdmin) {
		jsonError(w, http.StatusForbidden, "Only administrators can create users")
		return
	}

	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" || req.Name == "" {
		jsonError(w, http.StatusBadRequest, "Email, name and password are required")
		return
	}

	// Validate role
	role := model.UserRole(req.Role)
	if role != model.RoleSuperAdmin && role != model.RoleAdmin && role != model.RoleViewer {
		role = model.RoleAdmin
	}

	// Only super admin can assign super admin role
	if role == model.RoleSuperAdmin && caller.Role != model.RoleSuperAdmin {
		jsonError(w, http.StatusForbidden, "Only super administrators can assign superadmin role")
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	newUser := &model.User{
		ID:           uuid.New().String(),
		Email:        req.Email,
		PasswordHash: string(hashed),
		Name:         req.Name,
		Role:         role,
		IsRoot:       false,
	}

	if err := h.store.SaveUser(r.Context(), newUser); err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to save user: "+err.Error())
		return
	}

	_ = h.store.LogActivity(r.Context(), &model.ActivityLog{
		ID:        uuid.New().String(),
		UserEmail: caller.Email,
		Action:    "users:create",
		Resource:  "user:" + req.Email,
		Status:    "success",
		IPAddress: r.RemoteAddr,
	})

	jsonResponse(w, http.StatusCreated, map[string]interface{}{
		"id":         newUser.ID,
		"email":      newUser.Email,
		"name":       newUser.Name,
		"role":       newUser.Role,
		"is_root":    newUser.IsRoot,
		"created_at": newUser.CreatedAt,
	})
}

func (h *APIHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	caller := UserFromContext(r.Context())
	if caller == nil || (caller.Role != model.RoleSuperAdmin && caller.Role != model.RoleAdmin) {
		jsonError(w, http.StatusForbidden, "Only administrators can delete users")
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/v1/users/")
	if id == "" {
		jsonError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	targetUser, err := h.store.GetUserByID(r.Context(), id)
	if err != nil {
		jsonError(w, http.StatusNotFound, "User not found")
		return
	}

	if targetUser.IsRoot {
		jsonError(w, http.StatusForbidden, "Root super administrator cannot be deleted")
		return
	}

	if err := h.store.DeleteUser(r.Context(), id, caller.Email); err != nil {
		if err == db.ErrCannotDeleteRootAdmin {
			jsonError(w, http.StatusForbidden, "Root super administrator cannot be deleted")
			return
		}
		if err == db.ErrCannotDeleteSelf {
			jsonError(w, http.StatusBadRequest, "Cannot delete your own account")
			return
		}
		jsonError(w, http.StatusInternalServerError, "Failed to delete user: "+err.Error())
		return
	}

	_ = h.store.LogActivity(r.Context(), &model.ActivityLog{
		ID:        uuid.New().String(),
		UserEmail: caller.Email,
		Action:    "users:delete",
		Resource:  "user:" + targetUser.Email,
		Status:    "success",
		IPAddress: r.RemoteAddr,
	})

	jsonResponse(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *APIHandler) ListActivities(w http.ResponseWriter, r *http.Request) {
	activities, err := h.store.ListActivities(r.Context(), 50)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to list activities: "+err.Error())
		return
	}
	if activities == nil {
		activities = []model.ActivityLog{}
	}
	jsonResponse(w, http.StatusOK, activities)
}

func (h *APIHandler) ListTransfers(w http.ResponseWriter, r *http.Request) {
	filterType := r.URL.Query().Get("type")
	transfers, err := h.store.ListTransfers(r.Context(), filterType)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to list transfers: "+err.Error())
		return
	}
	if transfers == nil {
		transfers = []model.Transfer{}
	}
	jsonResponse(w, http.StatusOK, transfers)
}

func (h *APIHandler) CreateTransfer(w http.ResponseWriter, r *http.Request) {
	var t model.Transfer
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid transfer request")
		return
	}

	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	if t.Status == "" {
		t.Status = "queued"
	}

	if err := h.store.SaveTransfer(r.Context(), &t); err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to save transfer: "+err.Error())
		return
	}

	jsonResponse(w, http.StatusCreated, t)
}

func (h *APIHandler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.store.GetDashboardStats(r.Context())
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to compute stats: "+err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, stats)
}
