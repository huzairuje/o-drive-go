package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/huzairuje/o-drive-go/internal/crypto"
	"github.com/huzairuje/o-drive-go/internal/db"
	"github.com/huzairuje/o-drive-go/internal/model"
	"github.com/huzairuje/o-drive-go/internal/provider"
)

type APIHandler struct {
	store    *db.Store
	vault    *crypto.Vault
	registry *ProviderRegistry
}

func NewAPIHandler(store *db.Store, vault *crypto.Vault, registry *ProviderRegistry) *APIHandler {
	return &APIHandler{
		store:    store,
		vault:    vault,
		registry: registry,
	}
}

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, status int, message string) {
	jsonResponse(w, status, map[string]string{"error": message})
}

// Health Check
func (h *APIHandler) Health(w http.ResponseWriter, r *http.Request) {
	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"status":    "healthy",
		"service":   "odrive",
		"version":   "1.0.0",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *APIHandler) ListDrives(w http.ResponseWriter, r *http.Request) {
	drives, err := h.store.ListDrives(r.Context())
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if drives == nil {
		drives = []model.Drive{}
	}
	jsonResponse(w, http.StatusOK, drives)
}

func (h *APIHandler) CreateDrive(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name         string `json:"name"`
		Slug         string `json:"slug"`
		ConnectionID string `json:"connection_id"`
		RootFolderID string `json:"root_folder_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "invalid json payload")
		return
	}

	if req.Name == "" || req.Slug == "" || req.ConnectionID == "" {
		jsonError(w, http.StatusBadRequest, "name, slug, and connection_id are required")
		return
	}

	if req.RootFolderID == "" {
		req.RootFolderID = "root"
	}

	drive := &model.Drive{
		ID:           uuid.NewString(),
		Name:         req.Name,
		Slug:         req.Slug,
		ConnectionID: req.ConnectionID,
		RootFolderID: req.RootFolderID,
		Status:       "active",
	}

	if err := h.store.SaveDrive(r.Context(), drive); err != nil {
		jsonError(w, http.StatusInternalServerError, err.Error())
		return
	}

	jsonResponse(w, http.StatusCreated, drive)
}

func (h *APIHandler) DeleteDrive(w http.ResponseWriter, r *http.Request) {
	id := path.Base(r.URL.Path)
	if err := h.store.DeleteDrive(r.Context(), id); err != nil {
		jsonError(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *APIHandler) ListConnections(w http.ResponseWriter, r *http.Request) {
	connections, err := h.store.ListConnections(r.Context())
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if connections == nil {
		connections = []model.Connection{}
	}
	defaultConnID := h.store.GetDefaultConnectionID(r.Context())
	for i := range connections {
		if connections[i].ID == defaultConnID {
			connections[i].IsDefault = true
		}
	}
	jsonResponse(w, http.StatusOK, connections)
}

func (h *APIHandler) SetDefaultConnection(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/connections/")
	id = strings.TrimSuffix(id, "/default")
	if id == "" {
		jsonError(w, http.StatusBadRequest, "connection id is required")
		return
	}

	conn, err := h.store.GetConnection(r.Context(), id)
	if err != nil {
		jsonError(w, http.StatusNotFound, "connection not found: "+err.Error())
		return
	}

	if err := h.store.SetDefaultConnection(r.Context(), id); err != nil {
		jsonError(w, http.StatusInternalServerError, "failed to set default connection: "+err.Error())
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"status":                "success",
		"default_connection_id": id,
		"name":                  conn.Name,
		"message":               "Default storage connection updated successfully",
	})
}

func (h *APIHandler) CreateConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string             `json:"name"`
		Provider    model.ProviderType `json:"provider"`
		AuthType    model.AuthType     `json:"auth_type"`
		Email       string             `json:"email"`
		Credentials json.RawMessage    `json:"credentials"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "invalid json payload")
		return
	}

	encrypted, err := h.vault.Encrypt(string(req.Credentials))
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "failed to encrypt credentials: "+err.Error())
		return
	}

	conn := &model.Connection{
		ID:                   uuid.NewString(),
		Name:                 req.Name,
		Provider:             req.Provider,
		AuthType:             req.AuthType,
		Status:               model.ConnectionConnected,
		Email:                req.Email,
		CredentialsEncrypted: encrypted,
	}

	if err := h.store.SaveConnection(r.Context(), conn); err != nil {
		jsonError(w, http.StatusInternalServerError, err.Error())
		return
	}

	jsonResponse(w, http.StatusCreated, conn)
}

func (h *APIHandler) DeleteConnection(w http.ResponseWriter, r *http.Request) {
	id := path.Base(r.URL.Path)
	if err := h.store.DeleteConnection(r.Context(), id); err != nil {
		jsonError(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *APIHandler) ListFiles(w http.ResponseWriter, r *http.Request) {
	driveID := r.URL.Query().Get("drive_id")
	parentID := r.URL.Query().Get("parent_id")

	if driveID == "" {
		jsonError(w, http.StatusBadRequest, "drive_id query param required")
		return
	}

	ctx := r.Context()
	drive, err := h.store.GetDrive(ctx, driveID)
	if err != nil {
		jsonError(w, http.StatusNotFound, "drive not found")
		return
	}

	if parentID == "" {
		parentID = drive.RootFolderID
	}

	prov, err := h.registry.GetProvider(ctx, drive.ConnectionID)
	if err != nil {
		jsonError(w, http.StatusBadGateway, "provider error: "+err.Error())
		return
	}

	files, err := prov.List(ctx, parentID)
	if err != nil {
		dbFiles, dbErr := h.store.ListFilesByParent(ctx, drive.ID, parentID)
		if dbErr == nil && len(dbFiles) > 0 {
			jsonResponse(w, http.StatusOK, dbFiles)
			return
		}
		jsonError(w, http.StatusInternalServerError, "provider list error: "+err.Error())
		return
	}
	if len(files) == 0 {
		dbFiles, _ := h.store.ListFilesByParent(ctx, drive.ID, parentID)
		if len(dbFiles) > 0 {
			files = dbFiles
		}
	}
	if files == nil {
		files = []model.FileMetadata{}
	}

	// Update DB records asynchronously
	go func() {
		for _, f := range files {
			f.DriveID = drive.ID
			_ = h.store.SaveFile(context.Background(), &f)
		}
	}()

	jsonResponse(w, http.StatusOK, files)
}

func (h *APIHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	driveID := r.URL.Query().Get("drive_id")
	parentID := r.URL.Query().Get("parent_id")

	if driveID == "" {
		jsonError(w, http.StatusBadRequest, "drive_id required")
		return
	}

	ctx := r.Context()
	drive, err := h.store.GetDrive(ctx, driveID)
	if err != nil {
		jsonError(w, http.StatusNotFound, "drive not found")
		return
	}

	if parentID == "" {
		parentID = drive.RootFolderID
	}

	prov, err := h.registry.GetProvider(ctx, drive.ConnectionID)
	if err != nil {
		jsonError(w, http.StatusBadGateway, "provider error: "+err.Error())
		return
	}

	// Handle multipart form upload or raw octet-stream
	var uploadReader io.Reader
	var fileName string
	var mimeType string
	var contentLength int64

	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		mr, err := r.MultipartReader()
		if err != nil {
			jsonError(w, http.StatusBadRequest, "invalid multipart: "+err.Error())
			return
		}

		for {
			part, err := mr.NextPart()
			if err == io.EOF {
				break
			}
			if err != nil {
				jsonError(w, http.StatusBadRequest, "read part failed: "+err.Error())
				return
			}

			if part.FormName() == "file" {
				fileName = part.FileName()
				mimeType = part.Header.Get("Content-Type")
				uploadReader = part
				break
			}
		}
	} else {
		fileName = r.URL.Query().Get("name")
		if fileName == "" {
			fileName = "uploaded-file"
		}
		mimeType = r.Header.Get("Content-Type")
		contentLength = r.ContentLength
		uploadReader = r.Body
	}

	if uploadReader == nil {
		jsonError(w, http.StatusBadRequest, "no file stream found in request")
		return
	}

	meta, err := prov.UploadStream(ctx, parentID, fileName, mimeType, contentLength, uploadReader)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "upload failed: "+err.Error())
		return
	}

	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		filePath = "/" + fileName
	} else if !strings.HasPrefix(filePath, "/") {
		filePath = "/" + filePath
	}

	meta.ID = uuid.NewString()
	meta.DriveID = drive.ID
	meta.ParentID = parentID
	meta.Path = filePath
	_ = h.store.SaveFile(ctx, meta)

	user := UserFromContext(ctx)
	userEmail := "system@localhost"
	if user != nil {
		userEmail = user.Email
	}

	_ = h.store.LogActivity(ctx, &model.ActivityLog{
		ID:        uuid.NewString(),
		UserEmail: userEmail,
		Action:    "upload",
		Resource:  fileName,
		Status:    "success",
		IPAddress: r.RemoteAddr,
	})

	_ = h.store.SaveTransfer(ctx, &model.Transfer{
		ID:        uuid.NewString(),
		Type:      "upload",
		FileName:  fileName,
		DriveName: drive.Name,
		SizeBytes: meta.SizeBytes,
		Status:    "completed",
		Progress:  100,
	})

	jsonResponse(w, http.StatusCreated, meta)
}

func (h *APIHandler) CreateFolder(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DriveID  string `json:"drive_id"`
		ParentID string `json:"parent_id"`
		Name     string `json:"name"`
		Path     string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.DriveID == "" || req.Name == "" {
		jsonError(w, http.StatusBadRequest, "drive_id and name are required")
		return
	}

	ctx := r.Context()
	drive, err := h.store.GetDrive(ctx, req.DriveID)
	if err != nil {
		jsonError(w, http.StatusNotFound, "drive not found")
		return
	}

	prov, err := h.registry.GetProvider(ctx, drive.ConnectionID)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "provider unavailable: "+err.Error())
		return
	}

	parentID := req.ParentID
	if parentID == "" {
		parentID = drive.RootFolderID
	}

	meta, err := prov.CreateFolder(ctx, parentID, req.Name)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "create folder failed: "+err.Error())
		return
	}

	folderPath := req.Path
	if folderPath == "" {
		folderPath = "/" + req.Name
	} else if !strings.HasPrefix(folderPath, "/") {
		folderPath = "/" + folderPath
	}

	meta.ID = uuid.NewString()
	meta.DriveID = drive.ID
	meta.ParentID = parentID
	meta.Path = folderPath
	_ = h.store.SaveFile(ctx, meta)

	jsonResponse(w, http.StatusCreated, meta)
}

func (h *APIHandler) DownloadFile(w http.ResponseWriter, r *http.Request) {
	fileID := path.Base(r.URL.Path)
	if fileID == "download" || fileID == "" || fileID == "." {
		if qp := r.URL.Query().Get("path"); qp != "" {
			fileID = qp
		} else if qn := r.URL.Query().Get("name"); qn != "" {
			fileID = qn
		} else if qid := r.URL.Query().Get("id"); qid != "" {
			fileID = qid
		}
	}
	driveID := r.URL.Query().Get("drive_id")

	ctx := r.Context()
	var fileRecord *model.FileMetadata
	var err error

	if driveID != "" {
		fileRecord, err = h.store.GetFile(ctx, driveID, fileID)
		if err != nil || fileRecord == nil {
			lookupPath := fileID
			if !strings.HasPrefix(lookupPath, "/") {
				lookupPath = "/" + lookupPath
			}
			fileRecord, err = h.store.GetFileByPath(ctx, driveID, lookupPath)
		}
	}
	if fileRecord == nil {
		// Fallback provider ID directly
		fileRecord = &model.FileMetadata{
			ProviderFileID: fileID,
		}
	}

	// Resolve provider
	var prov provider.StorageProvider
	if driveID != "" {
		drive, err := h.store.GetDrive(ctx, driveID)
		if err == nil {
			prov, _ = h.registry.GetProvider(ctx, drive.ConnectionID)
		}
	}
	if prov == nil {
		// Use mock provider fallback
		prov, _ = h.registry.GetProvider(ctx, "mock")
	}

	rangeHeader := r.Header.Get("Range")
	body, info, err := prov.DownloadStream(ctx, fileRecord.ProviderFileID, rangeHeader)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "download failed: "+err.Error())
		return
	}
	defer body.Close()

	if info.ContentType != "" {
		w.Header().Set("Content-Type", info.ContentType)
	}
	if info.ContentLength > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(info.ContentLength, 10))
	}
	if info.ETag != "" {
		w.Header().Set("ETag", info.ETag)
	}
	if info.ContentRange != "" {
		w.Header().Set("Content-Range", info.ContentRange)
	}
	w.Header().Set("Accept-Ranges", "bytes")

	if info.StatusCode != 0 {
		w.WriteHeader(info.StatusCode)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	_, _ = io.Copy(w, body)
}

func (h *APIHandler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	fileID := path.Base(r.URL.Path)
	driveID := r.URL.Query().Get("drive_id")

	ctx := r.Context()
	if driveID != "" {
		drive, err := h.store.GetDrive(ctx, driveID)
		if err == nil {
			prov, err := h.registry.GetProvider(ctx, drive.ConnectionID)
			if err == nil {
				_ = prov.Delete(ctx, fileID)
			}
		}
		_ = h.store.DeleteFile(ctx, driveID, fileID)
	}

	jsonResponse(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *APIHandler) ListShares(w http.ResponseWriter, r *http.Request) {
	shares, err := h.store.ListShares(r.Context())
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if shares == nil {
		shares = []model.ShareLink{}
	}
	jsonResponse(w, http.StatusOK, shares)
}

func (h *APIHandler) CreateShare(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DriveID      string `json:"drive_id"`
		FileID       string `json:"file_id"`
		FileName     string `json:"file_name"`
		MimeType     string `json:"mime_type"`
		SizeBytes    int64  `json:"size_bytes"`
		MaxDownloads int    `json:"max_downloads"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "invalid json")
		return
	}

	tokenBytes := make([]byte, 16)
	_, _ = rand.Read(tokenBytes)
	token := hex.EncodeToString(tokenBytes)

	share := &model.ShareLink{
		ID:           uuid.NewString(),
		Token:        token,
		DriveID:      req.DriveID,
		FileID:       req.FileID,
		FileName:     req.FileName,
		MimeType:     req.MimeType,
		SizeBytes:    req.SizeBytes,
		MaxDownloads: req.MaxDownloads,
		CreatedAt:    time.Now().UTC(),
	}

	if err := h.store.SaveShare(r.Context(), share); err != nil {
		jsonError(w, http.StatusInternalServerError, err.Error())
		return
	}

	jsonResponse(w, http.StatusCreated, share)
}

func (h *APIHandler) ServePublicShare(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimPrefix(r.URL.Path, "/s/")
	token = strings.TrimPrefix(token, "/")

	ctx := r.Context()
	share, err := h.store.GetShareByToken(ctx, token)
	if err != nil {
		http.Error(w, "Share link not found or expired", http.StatusNotFound)
		return
	}

	if share.MaxDownloads > 0 && share.DownloadCount >= share.MaxDownloads {
		http.Error(w, "Download limit reached for this share link", http.StatusGone)
		return
	}

	drive, err := h.store.GetDrive(ctx, share.DriveID)
	if err != nil {
		http.Error(w, "Target drive not found", http.StatusBadGateway)
		return
	}

	prov, err := h.registry.GetProvider(ctx, drive.ConnectionID)
	if err != nil {
		http.Error(w, "Provider unavailable", http.StatusBadGateway)
		return
	}

	rangeHeader := r.Header.Get("Range")
	body, info, err := prov.DownloadStream(ctx, share.FileID, rangeHeader)
	if err != nil {
		http.Error(w, "Failed to stream file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer body.Close()

	_ = h.store.IncrementShareDownload(ctx, token)

	w.Header().Set("Content-Type", share.MimeType)
	if info.ContentLength > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(info.ContentLength, 10))
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, share.FileName))
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600")

	if info.StatusCode != 0 {
		w.WriteHeader(info.StatusCode)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	_, _ = io.Copy(w, body)
}

func (h *APIHandler) ListAPIKeys(w http.ResponseWriter, r *http.Request) {
	keys, err := h.store.ListAPIKeys(r.Context())
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if keys == nil {
		keys = []model.APIKey{}
	}
	jsonResponse(w, http.StatusOK, keys)
}

func (h *APIHandler) CreateAPIKey(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name   string `json:"name"`
		Scopes string `json:"scopes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "invalid json")
		return
	}

	if req.Name == "" {
		jsonError(w, http.StatusBadRequest, "name required")
		return
	}
	if req.Scopes == "" {
		req.Scopes = "read,write,s3"
	}

	rawSecretBytes := make([]byte, 24)
	_, _ = rand.Read(rawSecretBytes)
	secretHex := hex.EncodeToString(rawSecretBytes)
	rawKey := fmt.Sprintf("odrv_live_%s", secretHex)

	hash := sha256.Sum256([]byte(rawKey))
	hashHex := hex.EncodeToString(hash[:])

	apiKey := &model.APIKey{
		ID:        uuid.NewString(),
		Name:      req.Name,
		Prefix:    rawKey[:14] + "...",
		KeyHash:   hashHex,
		Scopes:    req.Scopes,
		CreatedAt: time.Now().UTC(),
	}

	if err := h.store.SaveAPIKey(r.Context(), apiKey); err != nil {
		jsonError(w, http.StatusInternalServerError, err.Error())
		return
	}

	jsonResponse(w, http.StatusCreated, map[string]interface{}{
		"key":    apiKey,
		"secret": rawKey, // Returned only once upon creation
	})
}

func (h *APIHandler) DeleteAPIKey(w http.ResponseWriter, r *http.Request) {
	id := path.Base(r.URL.Path)
	if err := h.store.DeleteAPIKey(r.Context(), id); err != nil {
		jsonError(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, map[string]bool{"ok": true})
}
