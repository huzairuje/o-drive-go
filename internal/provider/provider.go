package provider

import (
	"context"
	"io"

	"github.com/huzairuje/o-drive-go/internal/model"
)

// ContentInfo describes the stream headers returned for downloads.
type ContentInfo struct {
	ContentType   string
	ContentLength int64
	ContentRange  string // E.g. "bytes 0-1023/2048" if 206 Partial Content
	ETag          string
	StatusCode    int // 200 OK or 206 Partial Content
}

// StorageProvider is the provider-agnostic interface for upstream storage backends.
type StorageProvider interface {
	Name() string
	List(ctx context.Context, folderID string) ([]model.FileMetadata, error)
	Search(ctx context.Context, query string) ([]model.FileMetadata, error)
	CreateFolder(ctx context.Context, parentID, name string) (*model.FileMetadata, error)
	UploadStream(ctx context.Context, parentID, name, mimeType string, size int64, r io.Reader) (*model.FileMetadata, error)
	DownloadStream(ctx context.Context, providerFileID string, rangeHeader string) (body io.ReadCloser, info ContentInfo, err error)
	Delete(ctx context.Context, providerFileID string) error
	GetQuota(ctx context.Context) (*model.QuotaInfo, error)
}
