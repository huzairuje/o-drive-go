package mock

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/huzairuje/o-drive-go/internal/model"
	"github.com/huzairuje/o-drive-go/internal/provider"
)

type mockFile struct {
	meta model.FileMetadata
	data []byte
}

type MockProvider struct {
	mu    sync.RWMutex
	files map[string]*mockFile
}

func NewMockProvider() *MockProvider {
	m := &MockProvider{
		files: make(map[string]*mockFile),
	}
	// Seed demo folder
	rootID := "mock-root"
	m.files[rootID] = &mockFile{
		meta: model.FileMetadata{
			ID:             rootID,
			ProviderFileID: rootID,
			Name:           "root",
			Kind:           "folder",
			MimeType:       "application/vnd.google-apps.folder",
			ModifiedAt:     time.Now().UTC(),
		},
	}
	return m
}

func (m *MockProvider) Name() string {
	return "mock"
}

func (m *MockProvider) List(ctx context.Context, folderID string) ([]model.FileMetadata, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []model.FileMetadata
	for _, f := range m.files {
		if f.meta.ParentID == folderID && f.meta.ID != folderID {
			result = append(result, f.meta)
		}
	}
	return result, nil
}

func (m *MockProvider) Search(ctx context.Context, query string) ([]model.FileMetadata, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	lower := strings.ToLower(query)
	var result []model.FileMetadata
	for _, f := range m.files {
		if strings.Contains(strings.ToLower(f.meta.Name), lower) {
			result = append(result, f.meta)
		}
	}
	return result, nil
}

func (m *MockProvider) CreateFolder(ctx context.Context, parentID, name string) (*model.FileMetadata, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	id := "mock-folder-" + uuid.NewString()[:8]
	meta := model.FileMetadata{
		ID:             id,
		ProviderFileID: id,
		ParentID:       parentID,
		Name:           name,
		Kind:           "folder",
		MimeType:       "application/vnd.google-apps.folder",
		ModifiedAt:     time.Now().UTC(),
	}
	m.files[id] = &mockFile{meta: meta}
	return &meta, nil
}

func (m *MockProvider) UploadStream(ctx context.Context, parentID, name, mimeType string, size int64, r io.Reader) (*model.FileMetadata, error) {
	buf := new(bytes.Buffer)
	written, err := io.Copy(buf, r)
	if err != nil {
		return nil, fmt.Errorf("read upload stream: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	id := "mock-file-" + uuid.NewString()[:8]
	meta := model.FileMetadata{
		ID:             id,
		ProviderFileID: id,
		ParentID:       parentID,
		Name:           name,
		Kind:           "file",
		MimeType:       mimeType,
		SizeBytes:      written,
		ETag:           fmt.Sprintf(`"%x"`, written),
		ModifiedAt:     time.Now().UTC(),
	}
	m.files[id] = &mockFile{
		meta: meta,
		data: buf.Bytes(),
	}
	return &meta, nil
}

func (m *MockProvider) DownloadStream(ctx context.Context, providerFileID string, rangeHeader string) (io.ReadCloser, provider.ContentInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	f, ok := m.files[providerFileID]
	if !ok {
		return nil, provider.ContentInfo{}, fmt.Errorf("file not found: %s", providerFileID)
	}

	reader := io.NopCloser(bytes.NewReader(f.data))
	info := provider.ContentInfo{
		ContentType:   f.meta.MimeType,
		ContentLength: f.meta.SizeBytes,
		ETag:          f.meta.ETag,
		StatusCode:    200,
	}
	return reader, info, nil
}

func (m *MockProvider) Delete(ctx context.Context, providerFileID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.files, providerFileID)
	return nil
}

func (m *MockProvider) GetQuota(ctx context.Context) (*model.QuotaInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var used int64
	for _, f := range m.files {
		used += f.meta.SizeBytes
	}
	return &model.QuotaInfo{
		UsedBytes:  used,
		TotalBytes: 15 * 1024 * 1024 * 1024, // 15 GB
		UserEmail:  "mock-local@localhost",
	}, nil
}
