package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/huzairuje/o-drive-go/internal/db"
	"github.com/huzairuje/o-drive-go/internal/model"
)

type contextKey string

const (
	SessionContextKey contextKey = "session"
	UserContextKey    contextKey = "user"
)

type Middleware struct {
	store *db.Store
}

func NewMiddleware(store *db.Store) *Middleware {
	return &Middleware{store: store}
}

// CORS adds CORS headers for local and web UI communication.
func (m *Middleware) CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Omni-Key, Range, If-None-Match")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Range, ETag, Accept-Ranges")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Authenticate verifies API Keys or Web UI session tokens.
func (m *Middleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Public routes bypass
		if path == "/health" ||
			path == "/api/v1/health" ||
			path == "/api/v1/auth/login" ||
			strings.HasPrefix(path, "/s/") ||
			strings.HasPrefix(path, "/s3/") {
			next.ServeHTTP(w, r)
			return
		}

		var token string
		if cookie, err := r.Cookie("omni_session"); err == nil && cookie.Value != "" {
			token = cookie.Value
		}

		authHeader := r.Header.Get("Authorization")
		if token == "" && strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}

		if token != "" {
			sess, err := m.store.GetSession(r.Context(), token)
			if err == nil && sess != nil {
				ctx := context.WithValue(r.Context(), SessionContextKey, sess)
				user, err := m.store.GetUserByID(ctx, sess.UserID)
				if err == nil && user != nil {
					ctx = context.WithValue(ctx, UserContextKey, user)
				}
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
		}

		rawKey := r.Header.Get("X-Omni-Key")
		if rawKey == "" && token != "" {
			rawKey = token
		}

		if rawKey != "" {
			hash := sha256.Sum256([]byte(rawKey))
			hashHex := hex.EncodeToString(hash[:])
			apiKey, err := m.store.GetAPIKeyByHash(r.Context(), hashHex)
			if err == nil && apiKey != nil {
				go func() {
					_ = m.store.UpdateAPIKeyLastUsed(context.Background(), apiKey.ID)
				}()
				srvUser := &model.User{
					ID:     "api-" + apiKey.ID,
					Email:  "service-" + apiKey.Name + "@localhost",
					Name:   apiKey.Name,
					Role:   model.RoleSuperAdmin,
					IsRoot: false,
				}
				ctx := context.WithValue(r.Context(), UserContextKey, srvUser)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
		}

		if strings.HasPrefix(path, "/api/v1/") {
			http.Error(w, `{"error":"unauthorized: valid session or API key required"}`, http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Logger logs incoming requests.
func (m *Middleware) Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		_ = start
	})
}

func UserFromContext(ctx context.Context) *model.User {
	if u, ok := ctx.Value(UserContextKey).(*model.User); ok {
		return u
	}
	return nil
}

func SessionFromContext(ctx context.Context) *model.Session {
	if s, ok := ctx.Value(SessionContextKey).(*model.Session); ok {
		return s
	}
	return nil
}
