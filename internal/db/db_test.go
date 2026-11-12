package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/huzairuje/o-drive-go/internal/model"
)

func runStoreTests(t *testing.T, store *Store) {
	ctx := context.Background()
	defer func() {
		_ = store.DeleteDrive(ctx, "drv-test-1")
		_ = store.DeleteConnection(ctx, "conn-test-1")
		_ = store.DeleteUser(ctx, "usr-test-root", "cleaner@local")
	}()

	// 1. Connection
	conn := &model.Connection{
		ID:                   "conn-test-1",
		Name:                 "Primary Google Drive",
		Provider:             model.ProviderGoogleDrive,
		AuthType:             model.AuthOAuth2,
		Status:               model.ConnectionConnected,
		Email:                "admin@example.local",
		CredentialsEncrypted: "encrypted-blob",
	}
	if err := store.SaveConnection(ctx, conn); err != nil {
		t.Fatalf("SaveConnection failed: %v", err)
	}

	gotConn, err := store.GetConnection(ctx, "conn-test-1")
	if err != nil {
		t.Fatalf("GetConnection failed: %v", err)
	}
	if gotConn.Email != "admin@example.local" {
		t.Errorf("Email mismatch: %s", gotConn.Email)
	}

	// 2. Drive
	drive := &model.Drive{
		ID:           "drv-test-1",
		Name:         "Document Vault",
		Slug:         "doc-vault-test",
		ConnectionID: "conn-test-1",
		RootFolderID: "folder-notes-root",
		Status:       "active",
		TotalBytes:   1000000000,
		UsedBytes:    500000,
	}
	if err := store.SaveDrive(ctx, drive); err != nil {
		t.Fatalf("SaveDrive failed: %v", err)
	}

	gotDrive, err := store.GetDriveBySlug(ctx, "doc-vault-test")
	if err != nil {
		t.Fatalf("GetDriveBySlug failed: %v", err)
	}
	if gotDrive.Name != "Document Vault" {
		t.Errorf("Drive name mismatch: %s", gotDrive.Name)
	}

	// 3. File
	file := &model.FileMetadata{
		ID:             "file-test-1",
		DriveID:        "drv-test-1",
		ProviderFileID: "gdrive-file-abc",
		ParentID:       "folder-notes-root",
		Name:           "book-intro.pdf",
		Path:           "/book-intro.pdf",
		Kind:           "file",
		MimeType:       "application/pdf",
		SizeBytes:      2048576,
		ETag:           `"etag-123"`,
		ModifiedAt:     time.Now().UTC(),
	}
	if err := store.SaveFile(ctx, file); err != nil {
		t.Fatalf("SaveFile failed: %v", err)
	}

	gotFile, err := store.GetFileByPath(ctx, "drv-test-1", "/book-intro.pdf")
	if err != nil {
		t.Fatalf("GetFileByPath failed: %v", err)
	}
	if gotFile.SizeBytes != 2048576 {
		t.Errorf("File size mismatch: %d", gotFile.SizeBytes)
	}

	// 4. Share
	share := &model.ShareLink{
		ID:        "sh-test-1",
		Token:     "share-token-test",
		DriveID:   "drv-test-1",
		FileID:    "file-test-1",
		FileName:  "book-intro.pdf",
		MimeType:  "application/pdf",
		SizeBytes: 2048576,
	}
	if err := store.SaveShare(ctx, share); err != nil {
		t.Fatalf("SaveShare failed: %v", err)
	}

	if err := store.IncrementShareDownload(ctx, "share-token-test"); err != nil {
		t.Fatalf("IncrementShareDownload failed: %v", err)
	}
	gotShare, err := store.GetShareByToken(ctx, "share-token-test")
	if err != nil {
		t.Fatalf("GetShareByToken failed: %v", err)
	}
	if gotShare.DownloadCount != 1 {
		t.Errorf("Expected 1 download count, got %d", gotShare.DownloadCount)
	}

	// 5. API Key
	apiKey := &model.APIKey{
		ID:      "key-test-1",
		Name:    "Primary App Client",
		Prefix:  "odrv_live_test",
		KeyHash: "sha256-hash-secret",
		Scopes:  "read,write,s3",
	}
	if err := store.SaveAPIKey(ctx, apiKey); err != nil {
		t.Fatalf("SaveAPIKey failed: %v", err)
	}
	gotKey, err := store.GetAPIKeyByHash(ctx, "sha256-hash-secret")
	if err != nil {
		t.Fatalf("GetAPIKeyByHash failed: %v", err)
	}
	if gotKey.Name != "Primary App Client" {
		t.Errorf("Key name mismatch: %s", gotKey.Name)
	}

	// 6. Users and RBAC
	rootUser := &model.User{
		ID:           "usr-test-root",
		Email:        "test-root@example.local",
		PasswordHash: "hashed-pass",
		Name:         "Root Super Admin",
		Role:         model.RoleSuperAdmin,
		IsRoot:       true,
	}
	if err := store.SaveUser(ctx, rootUser); err != nil {
		t.Fatalf("SaveUser root failed: %v", err)
	}

	adminUser := &model.User{
		ID:           "usr-test-admin-2",
		Email:        "admin2@example.local",
		PasswordHash: "hashed-pass-2",
		Name:         "Admin Two",
		Role:         model.RoleAdmin,
		IsRoot:       false,
	}
	if err := store.SaveUser(ctx, adminUser); err != nil {
		t.Fatalf("SaveUser secondary admin failed: %v", err)
	}

	// Verify root protection invariant: cannot delete root admin
	if err := store.DeleteUser(ctx, "usr-test-root", "admin2@example.local"); err != ErrCannotDeleteRootAdmin {
		t.Fatalf("Expected ErrCannotDeleteRootAdmin when deleting root user, got: %v", err)
	}

	// Secondary admin can be deleted
	if err := store.DeleteUser(ctx, "usr-test-admin-2", "test-root@example.local"); err != nil {
		t.Fatalf("Failed to delete secondary admin: %v", err)
	}

	// 7. Sessions
	sessionToken := fmt.Sprintf("test-token-%d", time.Now().UnixNano())
	sess := &model.Session{
		Token:     sessionToken,
		UserID:    "usr-test-root",
		UserEmail: "test-root@example.local",
		Role:      model.RoleSuperAdmin,
		ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
	}
	if err := store.CreateSession(ctx, sess); err != nil {
		t.Fatalf("CreateSession failed: %v", err)
	}
	gotSess, err := store.GetSession(ctx, sessionToken)
	if err != nil {
		t.Fatalf("GetSession failed: %v", err)
	}
	if gotSess.UserEmail != "test-root@example.local" {
		t.Errorf("Session user mismatch: %s", gotSess.UserEmail)
	}

	// 8. Activities & Transfers
	actID := fmt.Sprintf("act-test-%d", time.Now().UnixNano())
	act := &model.ActivityLog{
		ID:        actID,
		UserEmail: "test-root@example.local",
		Action:    "login",
		Resource:  "auth",
		Status:    "success",
		IPAddress: "127.0.0.1",
	}
	if err := store.LogActivity(ctx, act); err != nil {
		t.Fatalf("LogActivity failed: %v", err)
	}
	activities, err := store.ListActivities(ctx, 10)
	if err != nil || len(activities) == 0 {
		t.Fatalf("ListActivities failed: %v", err)
	}

	xferID := fmt.Sprintf("xfer-test-%d", time.Now().UnixNano())
	transfer := &model.Transfer{
		ID:        xferID,
		Type:      "upload",
		FileName:  "book-intro.pdf",
		DriveName: "Document Vault",
		SizeBytes: 2048576,
		Status:    "completed",
		Progress:  100,
	}
	if err := store.SaveTransfer(ctx, transfer); err != nil {
		t.Fatalf("SaveTransfer failed: %v", err)
	}
	transfers, err := store.ListTransfers(ctx, "all")
	if err != nil || len(transfers) == 0 {
		t.Fatalf("ListTransfers failed: %v", err)
	}

	// 9. Dashboard stats
	stats, err := store.GetDashboardStats(ctx)
	if err != nil {
		t.Fatalf("GetDashboardStats failed: %v", err)
	}
	if stats["drives_count"].(int64) < 1 {
		t.Errorf("Expected drives_count >= 1, got %v", stats["drives_count"])
	}
}

func TestSQLiteStore(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "odrive-sqlite-test-*")
	if err != nil {
		t.Fatalf("MkdirTemp failed: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "test.db")
	store, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open SQLite failed: %v", err)
	}
	defer store.Close()

	if store.Driver() != "sqlite" {
		t.Errorf("Expected sqlite driver, got %s", store.Driver())
	}

	runStoreTests(t, store)
}

func TestPostgresStore(t *testing.T) {
	pgDSN := "postgres://postgres:postgres@127.0.0.1:5432/odrive?sslmode=disable"
	store, err := Open(pgDSN)
	if err != nil {
		t.Skipf("Skipping postgres test: %v", err)
		return
	}
	defer store.Close()

	if store.Driver() != "pgx" {
		t.Errorf("Expected pgx driver, got %s", store.Driver())
	}

	runStoreTests(t, store)
}
