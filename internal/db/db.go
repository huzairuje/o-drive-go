package db

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"

	"github.com/huzairuje/o-drive-go/internal/model"
)

//go:embed schema.sql
var schemaSQL string

var (
	ErrNotFound              = errors.New("record not found")
	ErrCannotDeleteRootAdmin = errors.New("root super admin cannot be deleted or demoted")
	ErrCannotDeleteSelf      = errors.New("cannot delete own account")
)

type Store struct {
	db     *sql.DB
	driver string // "sqlite" or "pgx"
}

// Open initializes database connection (SQLite by default, or PostgreSQL if DSN starts with postgres://).
func Open(dsn string) (*Store, error) {
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}
	if dsn == "" {
		dsn = "./data/omni-drive.db"
	}

	var (
		db         *sql.DB
		driverName string
		err        error
	)

	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		driverName = "pgx"
		db, err = sql.Open("pgx", dsn)
		if err != nil {
			return nil, fmt.Errorf("open postgres db: %w", err)
		}
		db.SetMaxOpenConns(25)
		db.SetMaxIdleConns(10)
		db.SetConnMaxLifetime(time.Hour)
	} else {
		driverName = "sqlite"
		dir := filepath.Dir(dsn)
		if err := os.MkdirAll(dir, 0750); err != nil {
			return nil, fmt.Errorf("create db directory %s: %w", dir, err)
		}
		sqliteDSN := fmt.Sprintf("%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)", dsn)
		db, err = sql.Open("sqlite", sqliteDSN)
		if err != nil {
			return nil, fmt.Errorf("open sqlite db: %w", err)
		}
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(5)
		db.SetConnMaxLifetime(time.Hour)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("ping db (%s): %w", driverName, err)
	}

	if _, err := db.ExecContext(ctx, schemaSQL); err != nil {
		return nil, fmt.Errorf("execute schema migrations on %s: %w", driverName, err)
	}

	return &Store{db: db, driver: driverName}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) Driver() string {
	return s.driver
}

// rebind transforms '?' placeholders to '$1, $2, ...' for PostgreSQL.
func (s *Store) rebind(query string) string {
	if s.driver != "pgx" {
		return query
	}
	var b strings.Builder
	paramIdx := 1
	for i := 0; i < len(query); i++ {
		if query[i] == '?' {
			b.WriteByte('$')
			b.WriteString(strconv.Itoa(paramIdx))
			paramIdx++
		} else {
			b.WriteByte(query[i])
		}
	}
	return b.String()
}

func (s *Store) SaveConnection(ctx context.Context, c *model.Connection) error {
	now := time.Now().UTC()
	if c.CreatedAt.IsZero() {
		c.CreatedAt = now
	}
	c.UpdatedAt = now

	query := `
	INSERT INTO connections (id, name, provider, auth_type, status, email, credentials_encrypted, created_at, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		name = excluded.name,
		status = excluded.status,
		email = excluded.email,
		credentials_encrypted = excluded.credentials_encrypted,
		updated_at = excluded.updated_at
	`
	_, err := s.db.ExecContext(ctx, s.rebind(query), c.ID, c.Name, c.Provider, c.AuthType, c.Status, c.Email, c.CredentialsEncrypted, c.CreatedAt, c.UpdatedAt)
	return err
}

func (s *Store) GetConnection(ctx context.Context, id string) (*model.Connection, error) {
	query := `SELECT id, name, provider, auth_type, status, email, credentials_encrypted, created_at, updated_at FROM connections WHERE id = ?`
	row := s.db.QueryRowContext(ctx, s.rebind(query), id)
	var c model.Connection
	err := row.Scan(&c.ID, &c.Name, &c.Provider, &c.AuthType, &c.Status, &c.Email, &c.CredentialsEncrypted, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &c, err
}

func (s *Store) ListConnections(ctx context.Context) ([]model.Connection, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, name, provider, auth_type, status, email, credentials_encrypted, created_at, updated_at FROM connections ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Connection
	for rows.Next() {
		var c model.Connection
		if err := rows.Scan(&c.ID, &c.Name, &c.Provider, &c.AuthType, &c.Status, &c.Email, &c.CredentialsEncrypted, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

func (s *Store) DeleteConnection(ctx context.Context, id string) error {
	query := `DELETE FROM connections WHERE id = ?`
	_, err := s.db.ExecContext(ctx, s.rebind(query), id)
	return err
}

func (s *Store) SaveDrive(ctx context.Context, d *model.Drive) error {
	now := time.Now().UTC()
	if d.CreatedAt.IsZero() {
		d.CreatedAt = now
	}
	d.UpdatedAt = now

	query := `
	INSERT INTO drives (id, name, slug, connection_id, root_folder_id, status, total_bytes, used_bytes, created_at, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		name = excluded.name,
		slug = excluded.slug,
		connection_id = excluded.connection_id,
		root_folder_id = excluded.root_folder_id,
		status = excluded.status,
		total_bytes = excluded.total_bytes,
		used_bytes = excluded.used_bytes,
		updated_at = excluded.updated_at
	`
	_, err := s.db.ExecContext(ctx, s.rebind(query), d.ID, d.Name, d.Slug, d.ConnectionID, d.RootFolderID, d.Status, d.TotalBytes, d.UsedBytes, d.CreatedAt, d.UpdatedAt)
	return err
}

func (s *Store) GetDrive(ctx context.Context, id string) (*model.Drive, error) {
	query := `SELECT id, name, slug, connection_id, root_folder_id, status, total_bytes, used_bytes, created_at, updated_at FROM drives WHERE id = ?`
	row := s.db.QueryRowContext(ctx, s.rebind(query), id)
	var d model.Drive
	err := row.Scan(&d.ID, &d.Name, &d.Slug, &d.ConnectionID, &d.RootFolderID, &d.Status, &d.TotalBytes, &d.UsedBytes, &d.CreatedAt, &d.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &d, err
}

func (s *Store) GetDriveBySlug(ctx context.Context, slug string) (*model.Drive, error) {
	query := `SELECT id, name, slug, connection_id, root_folder_id, status, total_bytes, used_bytes, created_at, updated_at FROM drives WHERE slug = ?`
	row := s.db.QueryRowContext(ctx, s.rebind(query), slug)
	var d model.Drive
	err := row.Scan(&d.ID, &d.Name, &d.Slug, &d.ConnectionID, &d.RootFolderID, &d.Status, &d.TotalBytes, &d.UsedBytes, &d.CreatedAt, &d.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &d, err
}

func (s *Store) ListDrives(ctx context.Context) ([]model.Drive, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, name, slug, connection_id, root_folder_id, status, total_bytes, used_bytes, created_at, updated_at FROM drives ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Drive
	for rows.Next() {
		var d model.Drive
		if err := rows.Scan(&d.ID, &d.Name, &d.Slug, &d.ConnectionID, &d.RootFolderID, &d.Status, &d.TotalBytes, &d.UsedBytes, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, d)
	}
	return list, rows.Err()
}

func (s *Store) DeleteDrive(ctx context.Context, id string) error {
	query := `DELETE FROM drives WHERE id = ?`
	_, err := s.db.ExecContext(ctx, s.rebind(query), id)
	return err
}

func (s *Store) SaveFile(ctx context.Context, f *model.FileMetadata) error {
	if f.ModifiedAt.IsZero() {
		f.ModifiedAt = time.Now().UTC()
	}

	query := `
	INSERT INTO files (id, drive_id, provider_file_id, parent_id, name, path, kind, mime_type, size_bytes, etag, modified_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		name = excluded.name,
		path = excluded.path,
		mime_type = excluded.mime_type,
		size_bytes = excluded.size_bytes,
		etag = excluded.etag,
		modified_at = excluded.modified_at
	`
	_, err := s.db.ExecContext(ctx, s.rebind(query), f.ID, f.DriveID, f.ProviderFileID, f.ParentID, f.Name, f.Path, f.Kind, f.MimeType, f.SizeBytes, f.ETag, f.ModifiedAt)
	return err
}

func (s *Store) GetFile(ctx context.Context, driveID, fileID string) (*model.FileMetadata, error) {
	query := `SELECT id, drive_id, provider_file_id, parent_id, name, path, kind, mime_type, size_bytes, etag, modified_at FROM files WHERE drive_id = ? AND id = ?`
	row := s.db.QueryRowContext(ctx, s.rebind(query), driveID, fileID)
	var f model.FileMetadata
	err := row.Scan(&f.ID, &f.DriveID, &f.ProviderFileID, &f.ParentID, &f.Name, &f.Path, &f.Kind, &f.MimeType, &f.SizeBytes, &f.ETag, &f.ModifiedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &f, err
}

func (s *Store) GetFileByPath(ctx context.Context, driveID, path string) (*model.FileMetadata, error) {
	query := `SELECT id, drive_id, provider_file_id, parent_id, name, path, kind, mime_type, size_bytes, etag, modified_at FROM files WHERE drive_id = ? AND path = ?`
	row := s.db.QueryRowContext(ctx, s.rebind(query), driveID, path)
	var f model.FileMetadata
	err := row.Scan(&f.ID, &f.DriveID, &f.ProviderFileID, &f.ParentID, &f.Name, &f.Path, &f.Kind, &f.MimeType, &f.SizeBytes, &f.ETag, &f.ModifiedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &f, err
}

func (s *Store) ListFilesByParent(ctx context.Context, driveID, parentID string) ([]model.FileMetadata, error) {
	query := `SELECT id, drive_id, provider_file_id, parent_id, name, path, kind, mime_type, size_bytes, etag, modified_at FROM files WHERE drive_id = ? AND parent_id = ? ORDER BY kind DESC, name ASC`
	rows, err := s.db.QueryContext(ctx, s.rebind(query), driveID, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.FileMetadata
	for rows.Next() {
		var f model.FileMetadata
		if err := rows.Scan(&f.ID, &f.DriveID, &f.ProviderFileID, &f.ParentID, &f.Name, &f.Path, &f.Kind, &f.MimeType, &f.SizeBytes, &f.ETag, &f.ModifiedAt); err != nil {
			return nil, err
		}
		list = append(list, f)
	}
	return list, rows.Err()
}

func (s *Store) DeleteFile(ctx context.Context, driveID, fileID string) error {
	query := `DELETE FROM files WHERE drive_id = ? AND id = ?`
	_, err := s.db.ExecContext(ctx, s.rebind(query), driveID, fileID)
	return err
}

func (s *Store) DeleteFileByPath(ctx context.Context, driveID, path string) error {
	query := `DELETE FROM files WHERE drive_id = ? AND path = ?`
	_, err := s.db.ExecContext(ctx, s.rebind(query), driveID, path)
	return err
}

func (s *Store) SaveShare(ctx context.Context, sh *model.ShareLink) error {
	if sh.CreatedAt.IsZero() {
		sh.CreatedAt = time.Now().UTC()
	}
	query := `
	INSERT INTO shares (id, token, drive_id, file_id, file_name, mime_type, size_bytes, expires_at, max_downloads, download_count, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(token) DO UPDATE SET
		download_count = excluded.download_count
	`
	_, err := s.db.ExecContext(ctx, s.rebind(query), sh.ID, sh.Token, sh.DriveID, sh.FileID, sh.FileName, sh.MimeType, sh.SizeBytes, sh.ExpiresAt, sh.MaxDownloads, sh.DownloadCount, sh.CreatedAt)
	return err
}

func (s *Store) GetShareByToken(ctx context.Context, token string) (*model.ShareLink, error) {
	query := `SELECT id, token, drive_id, file_id, file_name, mime_type, size_bytes, expires_at, max_downloads, download_count, created_at FROM shares WHERE token = ?`
	row := s.db.QueryRowContext(ctx, s.rebind(query), token)
	var sh model.ShareLink
	err := row.Scan(&sh.ID, &sh.Token, &sh.DriveID, &sh.FileID, &sh.FileName, &sh.MimeType, &sh.SizeBytes, &sh.ExpiresAt, &sh.MaxDownloads, &sh.DownloadCount, &sh.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &sh, err
}

func (s *Store) IncrementShareDownload(ctx context.Context, token string) error {
	query := `UPDATE shares SET download_count = download_count + 1 WHERE token = ?`
	_, err := s.db.ExecContext(ctx, s.rebind(query), token)
	return err
}

func (s *Store) ListShares(ctx context.Context) ([]model.ShareLink, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, token, drive_id, file_id, file_name, mime_type, size_bytes, expires_at, max_downloads, download_count, created_at FROM shares ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.ShareLink
	for rows.Next() {
		var sh model.ShareLink
		if err := rows.Scan(&sh.ID, &sh.Token, &sh.DriveID, &sh.FileID, &sh.FileName, &sh.MimeType, &sh.SizeBytes, &sh.ExpiresAt, &sh.MaxDownloads, &sh.DownloadCount, &sh.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, sh)
	}
	return list, rows.Err()
}

func (s *Store) DeleteShare(ctx context.Context, id string) error {
	query := `DELETE FROM shares WHERE id = ?`
	_, err := s.db.ExecContext(ctx, s.rebind(query), id)
	return err
}

func (s *Store) SaveAPIKey(ctx context.Context, k *model.APIKey) error {
	if k.CreatedAt.IsZero() {
		k.CreatedAt = time.Now().UTC()
	}
	query := `
	INSERT INTO api_keys (id, name, prefix, key_hash, scopes, created_at, last_used_at)
	VALUES (?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		name = excluded.name,
		scopes = excluded.scopes,
		last_used_at = excluded.last_used_at
	`
	_, err := s.db.ExecContext(ctx, s.rebind(query), k.ID, k.Name, k.Prefix, k.KeyHash, k.Scopes, k.CreatedAt, k.LastUsedAt)
	return err
}

func (s *Store) GetAPIKeyByHash(ctx context.Context, keyHash string) (*model.APIKey, error) {
	query := `SELECT id, name, prefix, key_hash, scopes, created_at, last_used_at FROM api_keys WHERE key_hash = ?`
	row := s.db.QueryRowContext(ctx, s.rebind(query), keyHash)
	var k model.APIKey
	err := row.Scan(&k.ID, &k.Name, &k.Prefix, &k.KeyHash, &k.Scopes, &k.CreatedAt, &k.LastUsedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &k, err
}

func (s *Store) ListAPIKeys(ctx context.Context) ([]model.APIKey, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, name, prefix, key_hash, scopes, created_at, last_used_at FROM api_keys ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.APIKey
	for rows.Next() {
		var k model.APIKey
		if err := rows.Scan(&k.ID, &k.Name, &k.Prefix, &k.KeyHash, &k.Scopes, &k.CreatedAt, &k.LastUsedAt); err != nil {
			return nil, err
		}
		list = append(list, k)
	}
	return list, rows.Err()
}

func (s *Store) DeleteAPIKey(ctx context.Context, id string) error {
	query := `DELETE FROM api_keys WHERE id = ?`
	_, err := s.db.ExecContext(ctx, s.rebind(query), id)
	return err
}

func (s *Store) UpdateAPIKeyLastUsed(ctx context.Context, id string) error {
	now := time.Now().UTC()
	query := `UPDATE api_keys SET last_used_at = ? WHERE id = ?`
	_, err := s.db.ExecContext(ctx, s.rebind(query), now, id)
	return err
}

func (s *Store) GetSetting(ctx context.Context, key string) (string, error) {
	query := `SELECT value FROM app_settings WHERE key = ?`
	row := s.db.QueryRowContext(ctx, s.rebind(query), key)
	var val string
	err := row.Scan(&val)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	return val, err
}

func (s *Store) SetSetting(ctx context.Context, key, val string) error {
	now := time.Now().UTC()
	query := `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
	_, err := s.db.ExecContext(ctx, s.rebind(query), key, val, now)
	return err
}

func (s *Store) GetDefaultConnectionID(ctx context.Context) string {
	val, err := s.GetSetting(ctx, "default_connection_id")
	if err != nil || val == "" {
		return "mock-conn"
	}
	return val
}

func (s *Store) SetDefaultConnection(ctx context.Context, connectionID string) error {
	if err := s.SetSetting(ctx, "default_connection_id", connectionID); err != nil {
		return err
	}
	now := time.Now().UTC()
	query := `UPDATE drives SET connection_id = ?, updated_at = ?`
	_, err := s.db.ExecContext(ctx, s.rebind(query), connectionID, now)
	return err
}

func isRootAdminEmail(email string) bool {
	if email == "" {
		return false
	}
	rootEmail := os.Getenv("ODRIVE_ROOT_EMAIL")
	if rootEmail == "" {
		rootEmail = os.Getenv("OMNI_ROOT_EMAIL")
	}
	if rootEmail == "" {
		rootEmail = "admin@example.local"
	}
	return email == rootEmail
}

func (s *Store) SaveUser(ctx context.Context, u *model.User) error {
	now := time.Now().UTC()
	if u.CreatedAt.IsZero() {
		u.CreatedAt = now
	}
	u.UpdatedAt = now

	if isRootAdminEmail(u.Email) {
		u.IsRoot = true
		u.Role = model.RoleSuperAdmin
	}

	query := `
	INSERT INTO users (id, email, password_hash, name, role, is_root, created_at, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		email = excluded.email,
		password_hash = CASE WHEN excluded.password_hash != '' THEN excluded.password_hash ELSE users.password_hash END,
		name = excluded.name,
		role = CASE WHEN users.is_root THEN 'superadmin' ELSE excluded.role END,
		is_root = CASE WHEN excluded.is_root THEN TRUE ELSE users.is_root END,
		updated_at = excluded.updated_at
	`
	_, err := s.db.ExecContext(ctx, s.rebind(query), u.ID, u.Email, u.PasswordHash, u.Name, string(u.Role), u.IsRoot, u.CreatedAt, u.UpdatedAt)
	return err
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (*model.User, error) {
	query := `SELECT id, email, password_hash, name, role, is_root, created_at, updated_at FROM users WHERE email = ?`
	row := s.db.QueryRowContext(ctx, s.rebind(query), email)
	var u model.User
	var roleStr string
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &roleStr, &u.IsRoot, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	u.Role = model.UserRole(roleStr)
	return &u, err
}

func (s *Store) GetUserByID(ctx context.Context, id string) (*model.User, error) {
	query := `SELECT id, email, password_hash, name, role, is_root, created_at, updated_at FROM users WHERE id = ?`
	row := s.db.QueryRowContext(ctx, s.rebind(query), id)
	var u model.User
	var roleStr string
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &roleStr, &u.IsRoot, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	u.Role = model.UserRole(roleStr)
	return &u, err
}

func (s *Store) UpdateUserPassword(ctx context.Context, userID, newHash string) error {
	now := time.Now().UTC()
	query := `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`
	_, err := s.db.ExecContext(ctx, s.rebind(query), newHash, now, userID)
	return err
}

func (s *Store) ListUsers(ctx context.Context) ([]model.User, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, email, password_hash, name, role, is_root, created_at, updated_at FROM users ORDER BY is_root DESC, created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.User
	for rows.Next() {
		var u model.User
		var roleStr string
		if err := rows.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &roleStr, &u.IsRoot, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		u.Role = model.UserRole(roleStr)
		list = append(list, u)
	}
	return list, rows.Err()
}

func (s *Store) DeleteUser(ctx context.Context, id, callerEmail string) error {
	u, err := s.GetUserByID(ctx, id)
	if err != nil {
		return err
	}
	if u.IsRoot || isRootAdminEmail(u.Email) {
		return ErrCannotDeleteRootAdmin
	}
	if u.Email == callerEmail {
		return ErrCannotDeleteSelf
	}
	query := `DELETE FROM users WHERE id = ?`
	_, err = s.db.ExecContext(ctx, s.rebind(query), id)
	return err
}

func (s *Store) CreateSession(ctx context.Context, sess *model.Session) error {
	if sess.CreatedAt.IsZero() {
		sess.CreatedAt = time.Now().UTC()
	}
	query := `
	INSERT INTO sessions (token, user_id, user_email, role, expires_at, created_at)
	VALUES (?, ?, ?, ?, ?, ?)
	ON CONFLICT(token) DO UPDATE SET
		expires_at = excluded.expires_at
	`
	_, err := s.db.ExecContext(ctx, s.rebind(query), sess.Token, sess.UserID, sess.UserEmail, string(sess.Role), sess.ExpiresAt, sess.CreatedAt)
	return err
}

func (s *Store) GetSession(ctx context.Context, token string) (*model.Session, error) {
	query := `SELECT token, user_id, user_email, role, expires_at, created_at FROM sessions WHERE token = ? AND expires_at > ?`
	row := s.db.QueryRowContext(ctx, s.rebind(query), token, time.Now().UTC())
	var sess model.Session
	var roleStr string
	err := row.Scan(&sess.Token, &sess.UserID, &sess.UserEmail, &roleStr, &sess.ExpiresAt, &sess.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	sess.Role = model.UserRole(roleStr)
	return &sess, err
}

func (s *Store) DeleteSession(ctx context.Context, token string) error {
	query := `DELETE FROM sessions WHERE token = ?`
	_, err := s.db.ExecContext(ctx, s.rebind(query), token)
	return err
}

func (s *Store) CleanupExpiredSessions(ctx context.Context) error {
	query := `DELETE FROM sessions WHERE expires_at <= ?`
	_, err := s.db.ExecContext(ctx, s.rebind(query), time.Now().UTC())
	return err
}

func (s *Store) LogActivity(ctx context.Context, a *model.ActivityLog) error {
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now().UTC()
	}
	query := `INSERT INTO activity_logs (id, user_email, action, resource, status, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.ExecContext(ctx, s.rebind(query), a.ID, a.UserEmail, a.Action, a.Resource, a.Status, a.IPAddress, a.CreatedAt)
	return err
}

func (s *Store) ListActivities(ctx context.Context, limit int) ([]model.ActivityLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	query := `SELECT id, user_email, action, resource, status, ip_address, created_at FROM activity_logs ORDER BY created_at DESC LIMIT ?`
	rows, err := s.db.QueryContext(ctx, s.rebind(query), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.ActivityLog
	for rows.Next() {
		var a model.ActivityLog
		if err := rows.Scan(&a.ID, &a.UserEmail, &a.Action, &a.Resource, &a.Status, &a.IPAddress, &a.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

func (s *Store) SaveTransfer(ctx context.Context, t *model.Transfer) error {
	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now().UTC()
	}
	query := `
	INSERT INTO transfers (id, type, file_name, drive_name, size_bytes, status, progress, error_message, created_at, finished_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		status = excluded.status,
		progress = excluded.progress,
		error_message = excluded.error_message,
		finished_at = excluded.finished_at
	`
	_, err := s.db.ExecContext(ctx, s.rebind(query), t.ID, t.Type, t.FileName, t.DriveName, t.SizeBytes, t.Status, t.Progress, t.Error, t.CreatedAt, t.FinishedAt)
	return err
}

func (s *Store) ListTransfers(ctx context.Context, filterType string) ([]model.Transfer, error) {
	var (
		rows *sql.Rows
		err  error
	)
	if filterType != "" && filterType != "all" {
		query := `SELECT id, type, file_name, drive_name, size_bytes, status, progress, error_message, created_at, finished_at FROM transfers WHERE type = ? ORDER BY created_at DESC`
		rows, err = s.db.QueryContext(ctx, s.rebind(query), filterType)
	} else {
		query := `SELECT id, type, file_name, drive_name, size_bytes, status, progress, error_message, created_at, finished_at FROM transfers ORDER BY created_at DESC`
		rows, err = s.db.QueryContext(ctx, query)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Transfer
	for rows.Next() {
		var t model.Transfer
		var errMsg sql.NullString
		var finAt sql.NullTime
		if err := rows.Scan(&t.ID, &t.Type, &t.FileName, &t.DriveName, &t.SizeBytes, &t.Status, &t.Progress, &errMsg, &t.CreatedAt, &finAt); err != nil {
			return nil, err
		}
		if errMsg.Valid {
			t.Error = errMsg.String
		}
		if finAt.Valid {
			t.FinishedAt = &finAt.Time
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

func (s *Store) GetDashboardStats(ctx context.Context) (map[string]interface{}, error) {
	var connCount, driveCount, totalUsedBytes, activeTransfers, failedJobs, activeShares int64

	_ = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM connections`).Scan(&connCount)
	_ = s.db.QueryRowContext(ctx, `SELECT COUNT(*), COALESCE(SUM(used_bytes), 0) FROM drives`).Scan(&driveCount, &totalUsedBytes)
	_ = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM transfers WHERE status IN ('queued', 'running')`).Scan(&activeTransfers)
	_ = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM transfers WHERE status = 'failed'`).Scan(&failedJobs)
	_ = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM shares`).Scan(&activeShares)

	return map[string]interface{}{
		"storage_used_bytes": totalUsedBytes,
		"connections_count":  connCount,
		"drives_count":       driveCount,
		"active_transfers":   activeTransfers,
		"failed_transfers":   failedJobs,
		"active_shares":      activeShares,
		"automations_count":  0,
		"providers_healthy":  connCount,
		"providers_total":    connCount,
	}, nil
}

