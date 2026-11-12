package gdrive

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/huzairuje/o-drive-go/internal/model"
	"github.com/huzairuje/o-drive-go/internal/provider"
)

const (
	apiBaseURL    = "https://www.googleapis.com/drive/v3"
	uploadBaseURL = "https://www.googleapis.com/upload/drive/v3"
)

type GDriveProvider struct {
	tokenManager *TokenManager
	httpClient   *http.Client
}

func NewGDriveProvider(creds Credentials) *GDriveProvider {
	return &GDriveProvider{
		tokenManager: NewTokenManager(creds),
		httpClient: &http.Client{
			Timeout: 0, // No timeout for streaming uploads/downloads
		},
	}
}

func (g *GDriveProvider) Name() string {
	return "google-drive"
}

func (g *GDriveProvider) TokenManager() *TokenManager {
	return g.tokenManager
}

func (g *GDriveProvider) doAuthRequest(ctx context.Context, method, endpoint string, body io.Reader, headers map[string]string) (*http.Response, error) {
	token, err := g.tokenManager.GetToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("auth error: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

type driveFileItem struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	MimeType    string   `json:"mimeType"`
	Size        string   `json:"size"`
	ModifiedAt  string   `json:"modifiedTime"`
	Parents     []string `json:"parents"`
	MD5Checksum string   `json:"md5Checksum"`
}

func parseTime(raw string) time.Time {
	if raw == "" {
		return time.Now().UTC()
	}
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Now().UTC()
	}
	return t
}

func normalizeFolderID(folderID string) string {
	if folderID == "" || folderID == "root" || strings.HasPrefix(folderID, "root-") {
		return "root"
	}
	return folderID
}

func (g *GDriveProvider) List(ctx context.Context, folderID string) ([]model.FileMetadata, error) {
	folderID = normalizeFolderID(folderID)

	var query string
	if folderID == "root" {
		query = "('root' in parents or sharedWithMe = true) and trashed = false"
	} else {
		query = fmt.Sprintf("'%s' in parents and trashed = false", folderID)
	}
	fields := "files(id,name,mimeType,size,modifiedTime,parents,md5Checksum)"
	endpoint := fmt.Sprintf("%s/files?q=%s&fields=%s&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true", apiBaseURL, url.QueryEscape(query), url.QueryEscape(fields))

	resp, err := g.doAuthRequest(ctx, "GET", endpoint, nil, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("list files failed (%d): %s", resp.StatusCode, string(body))
	}

	var res struct {
		Files []driveFileItem `json:"files"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}

	var list []model.FileMetadata
	for _, item := range res.Files {
		size, _ := strconv.ParseInt(item.Size, 10, 64)
		kind := "file"
		if item.MimeType == "application/vnd.google-apps.folder" {
			kind = "folder"
		}
		parent := folderID
		if len(item.Parents) > 0 {
			parent = item.Parents[0]
		}

		list = append(list, model.FileMetadata{
			ID:             item.ID,
			ProviderFileID: item.ID,
			ParentID:       parent,
			Name:           item.Name,
			Path:           "/" + item.Name,
			Kind:           kind,
			MimeType:       item.MimeType,
			SizeBytes:      size,
			ETag:           item.MD5Checksum,
			ModifiedAt:     parseTime(item.ModifiedAt),
		})
	}
	return list, nil
}

func (g *GDriveProvider) Search(ctx context.Context, query string) ([]model.FileMetadata, error) {
	q := fmt.Sprintf("name contains '%s' and trashed = false", query)
	fields := "files(id,name,mimeType,size,modifiedTime,parents,md5Checksum)"
	endpoint := fmt.Sprintf("%s/files?q=%s&fields=%s&pageSize=50", apiBaseURL, url.QueryEscape(q), url.QueryEscape(fields))

	resp, err := g.doAuthRequest(ctx, "GET", endpoint, nil, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("search failed with status %d", resp.StatusCode)
	}

	var res struct {
		Files []driveFileItem `json:"files"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}

	var list []model.FileMetadata
	for _, item := range res.Files {
		size, _ := strconv.ParseInt(item.Size, 10, 64)
		kind := "file"
		if item.MimeType == "application/vnd.google-apps.folder" {
			kind = "folder"
		}
		list = append(list, model.FileMetadata{
			ID:             item.ID,
			ProviderFileID: item.ID,
			Name:           item.Name,
			Kind:           kind,
			MimeType:       item.MimeType,
			SizeBytes:      size,
			ETag:           item.MD5Checksum,
			ModifiedAt:     parseTime(item.ModifiedAt),
		})
	}
	return list, nil
}

func (g *GDriveProvider) CreateFolder(ctx context.Context, parentID, name string) (*model.FileMetadata, error) {
	parentID = normalizeFolderID(parentID)

	meta := map[string]interface{}{
		"name":     name,
		"mimeType": "application/vnd.google-apps.folder",
		"parents":  []string{parentID},
	}
	body, _ := json.Marshal(meta)

	endpoint := apiBaseURL + "/files?fields=id,name,mimeType,modifiedTime&supportsAllDrives=true"
	resp, err := g.doAuthRequest(ctx, "POST", endpoint, bytes.NewReader(body), map[string]string{
		"Content-Type": "application/json",
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("create folder failed (%d): %s", resp.StatusCode, string(respBody))
	}

	var item driveFileItem
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return nil, err
	}

	return &model.FileMetadata{
		ID:             item.ID,
		ProviderFileID: item.ID,
		ParentID:       parentID,
		Name:           item.Name,
		Path:           "/" + item.Name,
		Kind:           "folder",
		MimeType:       item.MimeType,
		ModifiedAt:     parseTime(item.ModifiedAt),
	}, nil
}

// UploadStream uploads data to Google Drive using the Resumable Upload protocol.
// This is pure zero-buffer streaming: incoming bytes from reader are piped directly
// to Google's upload session without touching local server storage.
func (g *GDriveProvider) UploadStream(ctx context.Context, parentID, name, mimeType string, size int64, r io.Reader) (*model.FileMetadata, error) {
	parentID = normalizeFolderID(parentID)
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	if parentID == "root" && g.tokenManager.creds.ServiceAccountJSON != "" {
		// Discover if there is a shared folder available to use as storage root
		resp, err := g.doAuthRequest(ctx, "GET", apiBaseURL+"/files?q=sharedWithMe=true+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name)&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true", nil, nil)
		if err == nil && resp.StatusCode == http.StatusOK {
			var searchRes struct {
				Files []struct {
					ID   string `json:"id"`
					Name string `json:"name"`
				} `json:"files"`
			}
			_ = json.NewDecoder(resp.Body).Decode(&searchRes)
			resp.Body.Close()
			if len(searchRes.Files) > 0 {
				parentID = searchRes.Files[0].ID
				log.Printf("[INFO] Auto-routed upload to shared Google Drive folder: %s (%s)", searchRes.Files[0].Name, parentID)
			} else {
				var sa struct {
					ClientEmail string `json:"client_email"`
				}
				_ = json.Unmarshal([]byte(g.tokenManager.creds.ServiceAccountJSON), &sa)
				emailToShare := sa.ClientEmail
				if emailToShare == "" {
					emailToShare = "service account Anda"
				}
				return nil, fmt.Errorf("Google Service Account tidak memiliki kuota mandiri. Silakan buka Google Drive pribadi Anda, buat folder (misal: 'Cloud Storage'), lalu klik Bagikan (Share) folder tersebut ke: %s dengan role Editor", emailToShare)
			}
		}
	}

	initMeta := map[string]interface{}{
		"name":    name,
		"parents": []string{parentID},
	}
	initBody, _ := json.Marshal(initMeta)

	initEndpoint := uploadBaseURL + "/files?uploadType=resumable&fields=id,name,mimeType,size,modifiedTime,md5Checksum&supportsAllDrives=true"
	initHeaders := map[string]string{
		"Content-Type":          "application/json; charset=UTF-8",
		"X-Upload-Content-Type": mimeType,
	}
	if size > 0 {
		initHeaders["X-Upload-Content-Length"] = strconv.FormatInt(size, 10)
	}

	initResp, err := g.doAuthRequest(ctx, "POST", initEndpoint, bytes.NewReader(initBody), initHeaders)
	if err != nil {
		return nil, fmt.Errorf("initiate upload session: %w", err)
	}
	defer initResp.Body.Close()

	if initResp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(initResp.Body)
		return nil, fmt.Errorf("initiate upload failed (%d): %s", initResp.StatusCode, string(b))
	}

	uploadURL := initResp.Header.Get("Location")
	if uploadURL == "" {
		return nil, errors.New("google drive did not return upload Location header")
	}

	uploadReq, err := http.NewRequestWithContext(ctx, "PUT", uploadURL, r)
	if err != nil {
		return nil, fmt.Errorf("create stream upload request: %w", err)
	}
	uploadReq.Header.Set("Content-Type", mimeType)
	if size > 0 {
		uploadReq.ContentLength = size
	}

	uploadResp, err := g.httpClient.Do(uploadReq)
	if err != nil {
		return nil, fmt.Errorf("stream upload execution: %w", err)
	}
	defer uploadResp.Body.Close()

	if uploadResp.StatusCode != http.StatusOK && uploadResp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(uploadResp.Body)
		return nil, fmt.Errorf("stream upload failed (%d): %s", uploadResp.StatusCode, string(b))
	}

	var item driveFileItem
	if err := json.NewDecoder(uploadResp.Body).Decode(&item); err != nil {
		return nil, fmt.Errorf("decode upload response: %w", err)
	}

	fileSize, _ := strconv.ParseInt(item.Size, 10, 64)
	return &model.FileMetadata{
		ID:             item.ID,
		ProviderFileID: item.ID,
		ParentID:       parentID,
		Name:           item.Name,
		Path:           "/" + item.Name,
		Kind:           "file",
		MimeType:       item.MimeType,
		SizeBytes:      fileSize,
		ETag:           item.MD5Checksum,
		ModifiedAt:     parseTime(item.ModifiedAt),
	}, nil
}

// DownloadStream streams the file directly from Google Drive to the caller.
// Supports HTTP Range header (bytes=x-y) for partial content streaming.
func (g *GDriveProvider) DownloadStream(ctx context.Context, providerFileID string, rangeHeader string) (io.ReadCloser, provider.ContentInfo, error) {
	endpoint := fmt.Sprintf("%s/files/%s?alt=media&supportsAllDrives=true", apiBaseURL, providerFileID)

	headers := make(map[string]string)
	if rangeHeader != "" {
		headers["Range"] = rangeHeader
	}

	resp, err := g.doAuthRequest(ctx, "GET", endpoint, nil, headers)
	if err != nil {
		return nil, provider.ContentInfo{}, fmt.Errorf("download request: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, provider.ContentInfo{}, fmt.Errorf("download failed (%d): %s", resp.StatusCode, string(body))
	}

	contentLength, _ := strconv.ParseInt(resp.Header.Get("Content-Length"), 10, 64)
	info := provider.ContentInfo{
		ContentType:   resp.Header.Get("Content-Type"),
		ContentLength: contentLength,
		ContentRange:  resp.Header.Get("Content-Range"),
		ETag:          resp.Header.Get("ETag"),
		StatusCode:    resp.StatusCode,
	}

	return resp.Body, info, nil
}

func (g *GDriveProvider) Delete(ctx context.Context, providerFileID string) error {
	endpoint := fmt.Sprintf("%s/files/%s?supportsAllDrives=true", apiBaseURL, providerFileID)
	resp, err := g.doAuthRequest(ctx, "DELETE", endpoint, nil, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete failed (%d): %s", resp.StatusCode, string(b))
	}
	return nil
}

func (g *GDriveProvider) GetQuota(ctx context.Context) (*model.QuotaInfo, error) {
	endpoint := apiBaseURL + "/about?fields=storageQuota,user"
	resp, err := g.doAuthRequest(ctx, "GET", endpoint, nil, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("get quota failed with status %d", resp.StatusCode)
	}

	var res struct {
		StorageQuota struct {
			Usage string `json:"usage"`
			Limit string `json:"limit"`
		} `json:"storageQuota"`
		User struct {
			EmailAddress string `json:"emailAddress"`
		} `json:"user"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}

	used, _ := strconv.ParseInt(res.StorageQuota.Usage, 10, 64)
	total, _ := strconv.ParseInt(res.StorageQuota.Limit, 10, 64)

	return &model.QuotaInfo{
		UsedBytes:  used,
		TotalBytes: total,
		UserEmail:  res.User.EmailAddress,
	}, nil
}
