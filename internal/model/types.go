package model

import "time"

type ProviderType string

const (
	ProviderGoogleDrive ProviderType = "google-drive"
	ProviderR2          ProviderType = "cloudflare-r2"
	ProviderS3          ProviderType = "amazon-s3"
	ProviderOneDrive    ProviderType = "onedrive"
	ProviderTelegram    ProviderType = "telegram"
	ProviderMock        ProviderType = "mock"
)

type ConnectionStatus string

const (
	ConnectionConnected ConnectionStatus = "connected"
	ConnectionExpired   ConnectionStatus = "expired"
	ConnectionError     ConnectionStatus = "error"
)

type AuthType string

const (
	AuthOAuth2         AuthType = "oauth2"
	AuthServiceAccount AuthType = "service_account"
	AuthStaticKey      AuthType = "static_key"
)

// Connection stores credential info to connect to an upstream cloud provider.
type Connection struct {
	ID                   string           `json:"id"`
	Name                 string           `json:"name"`
	Provider             ProviderType     `json:"provider"`
	AuthType             AuthType         `json:"auth_type"`
	Status               ConnectionStatus `json:"status"`
	Email                string           `json:"email,omitempty"`
	IsDefault            bool             `json:"is_default"`
	CredentialsEncrypted string           `json:"-"`
	CreatedAt            time.Time        `json:"created_at"`
	UpdatedAt            time.Time        `json:"updated_at"`
}

// Drive represents a logical root/bucket exposed by Omni-Drive.
type Drive struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	ConnectionID string    `json:"connection_id"`
	RootFolderID string    `json:"root_folder_id"`
	Status       string    `json:"status"` // "active" | "disabled"
	TotalBytes   int64     `json:"total_bytes"`
	UsedBytes    int64     `json:"used_bytes"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// FileMetadata represents a file or directory in the Virtual File System.
type FileMetadata struct {
	ID             string    `json:"id"`
	DriveID        string    `json:"drive_id"`
	ProviderFileID string    `json:"provider_file_id"`
	ParentID       string    `json:"parent_id"`
	Name           string    `json:"name"`
	Path           string    `json:"path"`
	Kind           string    `json:"kind"` // "file" | "folder"
	MimeType       string    `json:"mime_type"`
	SizeBytes      int64     `json:"size_bytes"`
	ETag           string    `json:"etag"`
	ModifiedAt     time.Time `json:"modified_at"`
}

// ShareLink is a public or signed gateway link for sharing files.
type ShareLink struct {
	ID            string     `json:"id"`
	Token         string     `json:"token"`
	DriveID       string     `json:"drive_id"`
	FileID        string     `json:"file_id"`
	FileName      string     `json:"file_name"`
	MimeType      string     `json:"mime_type"`
	SizeBytes     int64      `json:"size_bytes"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	MaxDownloads  int        `json:"max_downloads"`
	DownloadCount int        `json:"download_count"`
	CreatedAt     time.Time  `json:"created_at"`
}

// APIKey allows downstream services to authenticate.
type APIKey struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Prefix     string     `json:"prefix"`
	KeyHash    string     `json:"-"`
	Scopes     string     `json:"scopes"` // Comma-separated: "read,write,s3"
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
}

// QuotaInfo represents storage capacity metrics.
type QuotaInfo struct {
	UsedBytes  int64  `json:"used_bytes"`
	TotalBytes int64  `json:"total_bytes"`
	UserEmail  string `json:"user_email,omitempty"`
}

type UserRole string

const (
	RoleSuperAdmin UserRole = "superadmin"
	RoleAdmin      UserRole = "admin"
	RoleViewer     UserRole = "viewer"
)

// User represents a system operator or administrator.
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	Role         UserRole  `json:"role"`
	IsRoot       bool      `json:"is_root"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Session represents an authenticated web UI login session.
type Session struct {
	Token     string    `json:"token"`
	UserID    string    `json:"user_id"`
	UserEmail string    `json:"user_email"`
	Role      UserRole  `json:"role"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// ActivityLog records operations for audit trails and security tracking.
type ActivityLog struct {
	ID        string    `json:"id"`
	UserEmail string    `json:"user_email"`
	Action    string    `json:"action"`
	Resource  string    `json:"resource"`
	Status    string    `json:"status"`
	IPAddress string    `json:"ip_address"`
	CreatedAt time.Time `json:"created_at"`
}

// Transfer represents a file transfer job in the active queue or history.
type Transfer struct {
	ID         string     `json:"id"`
	Type       string     `json:"type"` // "upload" | "download" | "sync"
	FileName   string     `json:"file_name"`
	DriveName  string     `json:"drive_name"`
	SizeBytes  int64      `json:"size_bytes"`
	Status     string     `json:"status"` // "queued" | "running" | "completed" | "failed"
	Progress   int        `json:"progress"`
	Error      string     `json:"error,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
}

