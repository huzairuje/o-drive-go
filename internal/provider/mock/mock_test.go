package mock

import (
	"bytes"
	"context"
	"io"
	"testing"
)

func TestMockStreamingUploadAndDownload(t *testing.T) {
	p := NewMockProvider()
	ctx := context.Background()

	testContent := []byte("Hello ODrive! This is streamed via ODrive Go.")
	r := bytes.NewReader(testContent)

	meta, err := p.UploadStream(ctx, "mock-root", "welcome.txt", "text/plain", int64(len(testContent)), r)
	if err != nil {
		t.Fatalf("UploadStream failed: %v", err)
	}

	if meta.Name != "welcome.txt" || meta.SizeBytes != int64(len(testContent)) {
		t.Errorf("Metadata mismatch: %+v", meta)
	}

	body, info, err := p.DownloadStream(ctx, meta.ProviderFileID, "")
	if err != nil {
		t.Fatalf("DownloadStream failed: %v", err)
	}
	defer body.Close()

	downloaded, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("ReadAll failed: %v", err)
	}

	if !bytes.Equal(downloaded, testContent) {
		t.Errorf("Downloaded content mismatch. Expected: %s, got: %s", string(testContent), string(downloaded))
	}

	if info.ContentType != "text/plain" || info.ContentLength != int64(len(testContent)) {
		t.Errorf("Info mismatch: %+v", info)
	}

	// Test List
	files, err := p.List(ctx, "mock-root")
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(files) != 1 {
		t.Errorf("Expected 1 file, got %d", len(files))
	}

	// Test Delete
	if err := p.Delete(ctx, meta.ProviderFileID); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	filesAfter, _ := p.List(ctx, "mock-root")
	if len(filesAfter) != 0 {
		t.Errorf("Expected 0 files after delete, got %d", len(filesAfter))
	}
}
