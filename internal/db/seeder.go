package db

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/huzairuje/o-drive-go/internal/crypto"
	"github.com/huzairuje/o-drive-go/internal/model"
)

type AppKeyInfo struct {
	AppID     string   `json:"app_id"`
	AppName   string   `json:"app_name"`
	KeyID     string   `json:"key_id"`
	SecretKey string   `json:"secret_key"`
	Prefix    string   `json:"prefix"`
	Scopes    string   `json:"scopes"`
	TargetEnv []string `json:"target_env_examples"`
}

type DriveInfo struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Slug       string `json:"slug"`
	Purpose    string `json:"purpose"`
	TotalBytes int64  `json:"total_bytes"`
}

type EcosystemSeedResult struct {
	RootAdminEmail    string                `json:"root_admin_email"`
	RootAdminPassword string                `json:"root_admin_password,omitempty"`
	Drives            []DriveInfo           `json:"drives"`
	AppKeys           map[string]AppKeyInfo `json:"app_keys"`
	ManifestPath      string                `json:"manifest_path,omitempty"`
}

// SeedEcosystem provisions default connections, drives, and dedicated service API keys
// for client applications and automated background workers.
func SeedEcosystem(ctx context.Context, store *Store, vault *crypto.Vault) (*EcosystemSeedResult, error) {
	res := &EcosystemSeedResult{
		AppKeys: make(map[string]AppKeyInfo),
	}

	// 1. Root Superadmin
	rootEmail := os.Getenv("ODRIVE_ROOT_EMAIL")
	if rootEmail == "" {
		rootEmail = os.Getenv("OMNI_ROOT_EMAIL")
	}
	if rootEmail == "" {
		rootEmail = "admin@example.local"
	}
	res.RootAdminEmail = rootEmail

	rootPass := os.Getenv("ODRIVE_ROOT_PASSWORD")
	if rootPass == "" {
		rootPass = os.Getenv("OMNI_ROOT_PASSWORD")
	}
	existingRoot, err := store.GetUserByEmail(ctx, rootEmail)
	if err != nil {
		if rootPass == "" {
			rootPass = generateSecureRandomString(20)
			res.RootAdminPassword = rootPass
			log.Printf("[WARN] Generated random root password: %s", rootPass)
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(rootPass), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("hash root password: %w", err)
		}
		rootUser := &model.User{
			ID:           "usr-root-superadmin",
			Email:        rootEmail,
			PasswordHash: string(hash),
			Name:         "Super Administrator",
			Role:         model.RoleSuperAdmin,
			IsRoot:       true,
		}
		if err := store.SaveUser(ctx, rootUser); err != nil {
			return nil, fmt.Errorf("save root admin: %w", err)
		}
		log.Printf("[INFO] Seeded root super administrator: %s", rootEmail)
	} else if rootPass != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(rootPass), bcrypt.DefaultCost)
		if err == nil {
			_ = store.UpdateUserPassword(ctx, existingRoot.ID, string(hash))
			log.Printf("[INFO] Synchronized root super administrator password with environment configuration.")
		}
	}

	// 2. Default Local Mock Storage Connection
	if _, err := store.GetConnection(ctx, "mock-conn"); err != nil {
		enc, err := vault.Encrypt(`{"type":"mock"}`)
		if err != nil {
			return nil, fmt.Errorf("encrypt mock connection credentials: %w", err)
		}
		conn := &model.Connection{
			ID:                   "mock-conn",
			Name:                 "Local Storage Relay (Default)",
			Provider:             model.ProviderMock,
			AuthType:             model.AuthStaticKey,
			Status:               model.ConnectionConnected,
			Email:                "storage@localhost",
			CredentialsEncrypted: enc,
		}
		if err := store.SaveConnection(ctx, conn); err != nil {
			return nil, fmt.Errorf("save mock-conn: %w", err)
		}
		log.Printf("[INFO] Seeded default connection: mock-conn")
	}

	// 3. Default drives
	defaultDrives := []DriveInfo{
		{
			ID:         "drv-personal",
			Name:       "Personal Vault",
			Slug:       "personal-vault",
			Purpose:    "Encrypted personal documents and private files",
			TotalBytes: 50 * 1024 * 1024 * 1024,
		},
		{
			ID:         "drv-media",
			Name:       "Media Library",
			Slug:       "media-library",
			Purpose:    "Images, video assets, audio streams, and media uploads",
			TotalBytes: 50 * 1024 * 1024 * 1024,
		},
		{
			ID:         "drv-backup",
			Name:       "System Backups",
			Slug:       "system-backups",
			Purpose:    "Offsite database dumps and automated system snapshots",
			TotalBytes: 50 * 1024 * 1024 * 1024,
		},
	}

	for _, d := range defaultDrives {
		if _, err := store.GetDrive(ctx, d.ID); err != nil {
			driveRecord := &model.Drive{
				ID:           d.ID,
				Name:         d.Name,
				Slug:         d.Slug,
				ConnectionID: "mock-conn",
				RootFolderID: "root-" + d.Slug,
				Status:       "active",
				TotalBytes:   d.TotalBytes,
				UsedBytes:    0,
			}
			if err := store.SaveDrive(ctx, driveRecord); err != nil {
				return nil, fmt.Errorf("save drive %s: %w", d.ID, err)
			}
			log.Printf("[INFO] Seeded drive: %s (%s)", d.ID, d.Slug)
		}
		res.Drives = append(res.Drives, d)
	}

	// 4. Dedicated Service API Keys for connected applications
	appSpecs := []struct {
		AppID     string
		AppName   string
		KeyID     string
		EnvKey    string
		Prefix    string
		Scopes    string
		TargetEnv []string
	}{
		{
			AppID:   "app-client",
			AppName: "Primary Application Client",
			KeyID:   "key-client-app",
			EnvKey:  "ODRIVE_KEY_CLIENT_APP",
			Prefix:  "odrv_live_app_",
			Scopes:  "read,write,s3",
			TargetEnv: []string{
				"S3_ACCESS_KEY=odrv_live_app_...",
				"S3_ENDPOINT=http://odrive:8090/s3",
				"S3_BUCKET=media-library",
			},
		},
		{
			AppID:   "backup-worker",
			AppName: "Automated Backup Worker",
			KeyID:   "key-backup-worker",
			EnvKey:  "ODRIVE_KEY_BACKUP_WORKER",
			Prefix:  "odrv_live_backup_",
			Scopes:  "read,write",
			TargetEnv: []string{
				"ODRIVE_INTERNAL_URL=http://odrive:8090",
				"ODRIVE_API_KEY=odrv_live_backup_...",
			},
		},
	}

	for _, spec := range appSpecs {
		var secretToken string
		if fromEnv := os.Getenv(spec.EnvKey); fromEnv != "" {
			secretToken = fromEnv
		}

		keyHashHex := ""
		if secretToken != "" {
			h := sha256.Sum256([]byte(secretToken))
			keyHashHex = hex.EncodeToString(h[:])
		}

		// Check if key already exists
		existingKeys, err := store.ListAPIKeys(ctx)
		var matched *model.APIKey
		if err == nil {
			for _, k := range existingKeys {
				if k.ID == spec.KeyID {
					matched = &k
					break
				}
			}
		}

		if matched == nil {
			if secretToken == "" {
				randomSuffix := generateSecureRandomHex(16)
				secretToken = spec.Prefix + randomSuffix
				h := sha256.Sum256([]byte(secretToken))
				keyHashHex = hex.EncodeToString(h[:])
			}

			keyRecord := &model.APIKey{
				ID:        spec.KeyID,
				Name:      spec.AppName,
				Prefix:    secretToken[:15] + "...",
				KeyHash:   keyHashHex,
				Scopes:    spec.Scopes,
				CreatedAt: time.Now().UTC(),
			}

			if err := store.SaveAPIKey(ctx, keyRecord); err != nil {
				return nil, fmt.Errorf("save api key %s: %w", spec.KeyID, err)
			}
			log.Printf("[INFO] Seeded service API key: %s (%s)", spec.KeyID, spec.AppName)
		} else if secretToken != "" && keyHashHex != "" && matched.KeyHash != keyHashHex {
			// Update hash if environment variable changed
			matched.KeyHash = keyHashHex
			matched.Prefix = secretToken[:15] + "..."
			_ = store.SaveAPIKey(ctx, matched)
			log.Printf("[INFO] Updated service API key hash from environment: %s", spec.KeyID)
		}

		res.AppKeys[spec.AppID] = AppKeyInfo{
			AppID:     spec.AppID,
			AppName:   spec.AppName,
			KeyID:     spec.KeyID,
			SecretKey: secretToken,
			Prefix:    spec.Prefix,
			Scopes:    spec.Scopes,
			TargetEnv: spec.TargetEnv,
		}
	}

	// 5. Persist credentials manifest if data dir is available
	manifestDir := "./data"
	if err := os.MkdirAll(manifestDir, 0750); err == nil {
		manifestPath := filepath.Join(manifestDir, "odrive-keys.json")
		bytes, err := json.MarshalIndent(res, "", "  ")
		if err == nil {
			if err := os.WriteFile(manifestPath, bytes, 0600); err == nil {
				res.ManifestPath = manifestPath
				log.Printf("[INFO] Ecosystem credentials manifest saved to %s", manifestPath)
			}
		}
	}

	return res, nil
}

func generateSecureRandomString(length int) string {
	const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!#$%"
	bytes := make([]byte, length)
	_, _ = rand.Read(bytes)
	for i := range bytes {
		bytes[i] = charset[int(bytes[i])%len(charset)]
	}
	return string(bytes)
}

func generateSecureRandomHex(byteCount int) string {
	b := make([]byte, byteCount)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
