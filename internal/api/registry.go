package api

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/huzairuje/o-drive-go/internal/crypto"
	"github.com/huzairuje/o-drive-go/internal/db"
	"github.com/huzairuje/o-drive-go/internal/model"
	"github.com/huzairuje/o-drive-go/internal/provider"
	"github.com/huzairuje/o-drive-go/internal/provider/gdrive"
	"github.com/huzairuje/o-drive-go/internal/provider/mock"
)

type ProviderRegistry struct {
	mu        sync.RWMutex
	store     *db.Store
	vault     *crypto.Vault
	providers map[string]provider.StorageProvider
}

func NewProviderRegistry(store *db.Store, vault *crypto.Vault) *ProviderRegistry {
	return &ProviderRegistry{
		store:     store,
		vault:     vault,
		providers: make(map[string]provider.StorageProvider),
	}
}

func (r *ProviderRegistry) Register(connectionID string, p provider.StorageProvider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.providers[connectionID] = p
}

func (r *ProviderRegistry) GetProvider(ctx context.Context, connectionID string) (provider.StorageProvider, error) {
	r.mu.RLock()
	p, ok := r.providers[connectionID]
	r.mu.RUnlock()
	if ok {
		return p, nil
	}

	conn, err := r.store.GetConnection(ctx, connectionID)
	if err != nil {
		// If connection not found, check if it's the mock connection
		if connectionID == "mock" || connectionID == "mock-conn" {
			mockP := mock.NewMockProvider()
			r.Register(connectionID, mockP)
			return mockP, nil
		}
		return nil, fmt.Errorf("connection '%s' not found: %w", connectionID, err)
	}

	if conn.Provider == model.ProviderMock {
		mockP := mock.NewMockProvider()
		r.Register(connectionID, mockP)
		return mockP, nil
	}

	if conn.Provider == model.ProviderGoogleDrive {
		decrypted, err := r.vault.Decrypt(conn.CredentialsEncrypted)
		if err != nil {
			return nil, fmt.Errorf("decrypt credentials: %w", err)
		}

		var creds gdrive.Credentials
		if err := json.Unmarshal([]byte(decrypted), &creds); err != nil {
			return nil, fmt.Errorf("unmarshal credentials: %w", err)
		}

		gdriveP := gdrive.NewGDriveProvider(creds)
		r.Register(connectionID, gdriveP)
		return gdriveP, nil
	}

	// For preview/connected storage adapters
	if conn.Provider == model.ProviderR2 || conn.Provider == model.ProviderS3 || conn.Provider == model.ProviderOneDrive || conn.Provider == model.ProviderTelegram {
		mockP := mock.NewMockProvider()
		r.Register(connectionID, mockP)
		return mockP, nil
	}

	return nil, fmt.Errorf("unsupported provider: %s", conn.Provider)
}
