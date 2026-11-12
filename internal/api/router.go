package api

import (
	"net/http"
	"strings"

	"github.com/huzairuje/o-drive-go/internal/crypto"
	"github.com/huzairuje/o-drive-go/internal/db"
	"github.com/huzairuje/o-drive-go/internal/webui"
)

type Server struct {
	mux        *http.ServeMux
	handler    *APIHandler
	s3Gateway  *S3Gateway
	middleware *Middleware
}

func NewServer(store *db.Store, vault *crypto.Vault) *Server {
	registry := NewProviderRegistry(store, vault)
	handler := NewAPIHandler(store, vault, registry)
	s3Gateway := NewS3Gateway(store, registry)
	middleware := NewMiddleware(store)

	mux := http.NewServeMux()

	s := &Server{
		mux:        mux,
		handler:    handler,
		s3Gateway:  s3Gateway,
		middleware: middleware,
	}
	s.routes()
	return s
}

func (s *Server) routes() {
	// Health check
	s.mux.HandleFunc("GET /health", s.handler.Health)
	s.mux.HandleFunc("GET /api/v1/health", s.handler.Health)

	// Authentication & RBAC
	s.mux.HandleFunc("POST /api/v1/auth/login", s.handler.Login)
	s.mux.HandleFunc("POST /api/v1/auth/logout", s.handler.Logout)
	s.mux.HandleFunc("GET /api/v1/auth/me", s.handler.GetMe)
	s.mux.HandleFunc("POST /api/v1/auth/password", s.handler.ChangePassword)
	s.mux.HandleFunc("GET /api/v1/users", s.handler.ListUsers)
	s.mux.HandleFunc("POST /api/v1/users", s.handler.CreateUser)
	s.mux.HandleFunc("DELETE /api/v1/users/", s.handler.DeleteUser)

	// Activity & Transfers
	s.mux.HandleFunc("GET /api/v1/activity", s.handler.ListActivities)
	s.mux.HandleFunc("GET /api/v1/transfers", s.handler.ListTransfers)
	s.mux.HandleFunc("POST /api/v1/transfers", s.handler.CreateTransfer)
	s.mux.HandleFunc("GET /api/v1/stats", s.handler.GetDashboardStats)

	// Drives
	s.mux.HandleFunc("GET /api/v1/drives", s.handler.ListDrives)
	s.mux.HandleFunc("POST /api/v1/drives", s.handler.CreateDrive)
	s.mux.HandleFunc("DELETE /api/v1/drives/", s.handler.DeleteDrive)

	// Connections
	s.mux.HandleFunc("GET /api/v1/connections", s.handler.ListConnections)
	s.mux.HandleFunc("POST /api/v1/connections", s.handler.CreateConnection)
	s.mux.HandleFunc("POST /api/v1/connections/{id}/default", s.handler.SetDefaultConnection)
	s.mux.HandleFunc("DELETE /api/v1/connections/", s.handler.DeleteConnection)

	// Files
	s.mux.HandleFunc("GET /api/v1/files", s.handler.ListFiles)
	s.mux.HandleFunc("POST /api/v1/files/upload", s.handler.UploadFile)
	s.mux.HandleFunc("GET /api/v1/files/download", s.handler.DownloadFile)
	s.mux.HandleFunc("GET /api/v1/files/download/", s.handler.DownloadFile)
	s.mux.HandleFunc("DELETE /api/v1/files/", s.handler.DeleteFile)

	// Shares
	s.mux.HandleFunc("GET /api/v1/shares", s.handler.ListShares)
	s.mux.HandleFunc("POST /api/v1/shares", s.handler.CreateShare)

	// Public Share Gateway (no auth required)
	s.mux.HandleFunc("GET /s/", s.handler.ServePublicShare)

	// API Keys
	s.mux.HandleFunc("GET /api/v1/keys", s.handler.ListAPIKeys)
	s.mux.HandleFunc("POST /api/v1/keys", s.handler.CreateAPIKey)
	s.mux.HandleFunc("DELETE /api/v1/keys/", s.handler.DeleteAPIKey)

	// S3 Gateway (/s3/{bucket}/{key...})
	s.mux.Handle("/s3/", s.s3Gateway)

	// Web UI handler for all other routes
	uiHandler := webui.Handler()
	s.mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		uiHandler.ServeHTTP(w, r)
	})
}

func (s *Server) Handler() http.Handler {
	return s.middleware.Logger(s.middleware.CORS(s.middleware.Authenticate(s.mux)))
}
