package api

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/huzairuje/o-drive-go/internal/crypto"
	"github.com/huzairuje/o-drive-go/internal/db"
	"github.com/huzairuje/o-drive-go/internal/model"
	"github.com/huzairuje/o-drive-go/internal/provider/mock"
)

func TestS3GatewayFlow(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "s3-test-*")
	defer os.RemoveAll(tmpDir)

	store, err := db.Open(filepath.Join(tmpDir, "test.db"))
	if err != nil {
		t.Fatalf("Open DB failed: %v", err)
	}
	defer store.Close()

	vault, _ := crypto.NewVault("test-secret")
	registry := NewProviderRegistry(store, vault)

	mockProv := mock.NewMockProvider()
	registry.Register("mock-conn", mockProv)

	// Seed test connection and drive
	conn := &model.Connection{
		ID:                   "mock-conn",
		Name:                 "Mock Storage",
		Provider:             model.ProviderMock,
		AuthType:             model.AuthStaticKey,
		Status:               model.ConnectionConnected,
		CredentialsEncrypted: "enc",
	}
	if err := store.SaveConnection(t.Context(), conn); err != nil {
		t.Fatalf("SaveConnection failed: %v", err)
	}

	drive := &model.Drive{
		ID:           "drv-s3",
		Name:         "Media Storage Bucket",
		Slug:         "media-library",
		ConnectionID: "mock-conn",
		RootFolderID: "mock-root",
		Status:       "active",
	}
	if err := store.SaveDrive(t.Context(), drive); err != nil {
		t.Fatalf("SaveDrive failed: %v", err)
	}

	s3GW := NewS3Gateway(store, registry)

	// 1. PUT Object (simulate PutObject from client app)
	bookContent := []byte("PDF Binary Content: Sample Open Document")
	putReq := httptest.NewRequest(http.MethodPut, "/s3/media-library/documents/sample.pdf", bytes.NewReader(bookContent))
	putReq.Header.Set("Content-Type", "application/pdf")
	putRec := httptest.NewRecorder()

	s3GW.ServeHTTP(putRec, putReq)
	if putRec.Code != http.StatusOK {
		t.Fatalf("PUT failed with code %d: %s", putRec.Code, putRec.Body.String())
	}

	etag := putRec.Header().Get("ETag")
	if etag == "" {
		t.Errorf("Expected ETag header, got empty")
	}

	// 2. HEAD Object (simulate HeadObject)
	headReq := httptest.NewRequest(http.MethodHead, "/s3/media-library/documents/sample.pdf", nil)
	headRec := httptest.NewRecorder()
	s3GW.ServeHTTP(headRec, headReq)
	if headRec.Code != http.StatusOK {
		t.Fatalf("HEAD failed with code %d", headRec.Code)
	}
	if headRec.Header().Get("Content-Type") != "application/pdf" {
		t.Errorf("Content-Type mismatch: %s", headRec.Header().Get("Content-Type"))
	}

	// 3. GET Object (simulate GetObject stream)
	getReq := httptest.NewRequest(http.MethodGet, "/s3/media-library/documents/sample.pdf", nil)
	getRec := httptest.NewRecorder()
	s3GW.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("GET failed with code %d: %s", getRec.Code, getRec.Body.String())
	}

	downloaded, _ := io.ReadAll(getRec.Body)
	if !bytes.Equal(downloaded, bookContent) {
		t.Errorf("Downloaded content mismatch: got %s, expected %s", string(downloaded), string(bookContent))
	}

	// 4. DELETE Object
	delReq := httptest.NewRequest(http.MethodDelete, "/s3/media-library/documents/sample.pdf", nil)
	delRec := httptest.NewRecorder()
	s3GW.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("DELETE failed with code %d", delRec.Code)
	}
}
