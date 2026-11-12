package api

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/huzairuje/o-drive-go/internal/db"
	"github.com/huzairuje/o-drive-go/internal/model"
	"github.com/huzairuje/o-drive-go/internal/provider"
)

type S3Gateway struct {
	store    *db.Store
	registry *ProviderRegistry
}

func NewS3Gateway(store *db.Store, registry *ProviderRegistry) *S3Gateway {
	return &S3Gateway{
		store:    store,
		registry: registry,
	}
}

// ServeHTTP handles S3-compatible PutObject, GetObject, HeadObject, DeleteObject.
// Route format: /s3/{bucket}/{key...}
func (s *S3Gateway) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Strip prefix "/s3/"
	relPath := strings.TrimPrefix(r.URL.Path, "/s3/")
	relPath = strings.TrimPrefix(relPath, "/")
	parts := strings.SplitN(relPath, "/", 2)

	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "Bucket name required in path /s3/{bucket}/{key}", http.StatusBadRequest)
		return
	}

	bucketSlug := parts[0]
	key := ""
	if len(parts) > 1 {
		key = parts[1]
	}

	ctx := r.Context()
	drive, err := s.store.GetDriveBySlug(ctx, bucketSlug)
	if err != nil {
		// If bucket not found by slug, try by ID
		drive, err = s.store.GetDrive(ctx, bucketSlug)
		if err != nil {
			http.Error(w, fmt.Sprintf("Bucket/Drive '%s' not found", bucketSlug), http.StatusNotFound)
			return
		}
	}

	prov, err := s.registry.GetProvider(ctx, drive.ConnectionID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Storage provider error: %v", err), http.StatusBadGateway)
		return
	}

	switch r.Method {
	case http.MethodPut:
		s.handlePutObject(ctx, w, r, drive, prov, key)
	case http.MethodGet:
		s.handleGetObject(ctx, w, r, drive, prov, key)
	case http.MethodHead:
		s.handleHeadObject(ctx, w, r, drive, prov, key)
	case http.MethodDelete:
		s.handleDeleteObject(ctx, w, r, drive, prov, key)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *S3Gateway) handlePutObject(ctx context.Context, w http.ResponseWriter, r *http.Request, drive *model.Drive, prov provider.StorageProvider, key string) {
	if key == "" {
		http.Error(w, "Object key required", http.StatusBadRequest)
		return
	}

	fileName := path.Base(key)
	mimeType := r.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	contentLength := r.ContentLength

	// Stream upload directly to cloud provider (zero disk buffer!)
	meta, err := prov.UploadStream(ctx, drive.RootFolderID, fileName, mimeType, contentLength, r.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("Upload stream failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Persist metadata to DB
	fileRecord := &model.FileMetadata{
		ID:             uuid.NewString(),
		DriveID:        drive.ID,
		ProviderFileID: meta.ProviderFileID,
		ParentID:       drive.RootFolderID,
		Name:           fileName,
		Path:           "/" + key,
		Kind:           "file",
		MimeType:       mimeType,
		SizeBytes:      meta.SizeBytes,
		ETag:           meta.ETag,
		ModifiedAt:     time.Now().UTC(),
	}
	_ = s.store.SaveFile(ctx, fileRecord)

	w.Header().Set("ETag", meta.ETag)
	w.WriteHeader(http.StatusOK)
}

func (s *S3Gateway) handleGetObject(ctx context.Context, w http.ResponseWriter, r *http.Request, drive *model.Drive, prov provider.StorageProvider, key string) {
	fileRecord, err := s.store.GetFileByPath(ctx, drive.ID, "/"+key)
	if err != nil {
		http.Error(w, "Object not found", http.StatusNotFound)
		return
	}

	rangeHeader := r.Header.Get("Range")
	body, info, err := prov.DownloadStream(ctx, fileRecord.ProviderFileID, rangeHeader)
	if err != nil {
		http.Error(w, fmt.Sprintf("Download stream failed: %v", err), http.StatusInternalServerError)
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

	// Set optimal caching header for game assets and documents
	w.Header().Set("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600")

	if info.StatusCode != 0 {
		w.WriteHeader(info.StatusCode)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	_, _ = io.Copy(w, body)
}

func (s *S3Gateway) handleHeadObject(ctx context.Context, w http.ResponseWriter, r *http.Request, drive *model.Drive, prov provider.StorageProvider, key string) {
	fileRecord, err := s.store.GetFileByPath(ctx, drive.ID, "/"+key)
	if err != nil {
		http.Error(w, "Object not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", fileRecord.MimeType)
	w.Header().Set("Content-Length", strconv.FormatInt(fileRecord.SizeBytes, 10))
	w.Header().Set("ETag", fileRecord.ETag)
	w.Header().Set("Accept-Ranges", "bytes")
	w.WriteHeader(http.StatusOK)
}

func (s *S3Gateway) handleDeleteObject(ctx context.Context, w http.ResponseWriter, r *http.Request, drive *model.Drive, prov provider.StorageProvider, key string) {
	fileRecord, err := s.store.GetFileByPath(ctx, drive.ID, "/"+key)
	if err == nil {
		_ = prov.Delete(ctx, fileRecord.ProviderFileID)
		_ = s.store.DeleteFile(ctx, drive.ID, fileRecord.ID)
	}
	w.WriteHeader(http.StatusNoContent)
}
