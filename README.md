# ODrive Go

ODrive Go is an open-source cloud storage relay, streaming gateway, and unified virtual file system written in Go, featuring an embedded Next.js web management console.

It unifies multiple upstream storage providers (Google Drive, Cloudflare R2, Amazon S3, and local storage) behind a single API surface, an S3-compatible gateway, and an administrative dashboard.

## Key Capabilities

- Unified Multi-Cloud Storage: Mount Google Drive personal/workspace accounts, Cloudflare R2, AWS S3 buckets, and local disks under unified virtual drive paths.
- S3-Compatible Gateway: Standard HTTP PUT, GET, HEAD, and DELETE operations under `/s3/{bucket}/{key}` with zero-copy streaming.
- Streaming Relay: Upload and download files without buffering full payloads into server RAM.
- Byte-Range Streaming: Supports HTTP 206 Partial Content for video playback, media streaming, and resumable downloads.
- Embedded Web Console: Modern Next.js interface embedded directly inside the compiled Go binary through `embed.FS`.
- Zero External Runtime Dependencies: Runs as a single self-contained binary on Linux, macOS, and Windows.
- Credential Security: Provider tokens, client secrets, and service account keys are encrypted at rest using AES-256-GCM.
- Role-Based Access Control: Root superadmin protection, secondary admin roles, and granular per-service API keys.
- Dual Database Engine: Native support for PostgreSQL in production and pure-Go SQLite for development or edge deployments.

## Architecture

```
Downstream Clients and Apps
  |
  +--> Web Management UI (Embedded Next.js Console on :8090)
  +--> REST API (/api/v1/files, /api/v1/drives, /api/v1/connections)
  +--> S3 Gateway (/s3/{bucket}/{key})
        |
        v
   ODrive Core Relay Engine (Go)
        |
        +--> AES-256-GCM Credential Vault
        +--> Virtual File System (PostgreSQL / SQLite)
        |
        v
   Upstream Storage Providers
        +--> Google Drive (OAuth 2.0 / Service Account)
        +--> Cloudflare R2
        +--> Amazon S3
        +--> Local / Mock Storage
```

## Quick Start

### 1. Run via Docker Compose (Recommended)

Clone the repository and launch the container stack:

```bash
git clone git@github.com:huzairuje/o-drive-go.git
cd o-drive-go

# Copy environment template
cp .env.example .env

# Start ODrive and PostgreSQL
docker compose up -d
```

Open `http://localhost:8090` in your browser.

Default credentials:
- Email: `admin@example.local`
- Password: `replace-with-a-secure-password` (configured in `.env`)

### 2. Run from Source

Prerequisites:
- Go 1.22 or higher
- Node.js 18 or higher (only needed when rebuilding UI assets)

```bash
# 1. Build Next.js UI and compile standalone binary
./scripts/build.sh

# 2. Run with SQLite (zero configuration required)
./bin/odrive -addr :8090 -db ./data/odrive.db

# Or run with PostgreSQL
./bin/odrive -addr :8090 -db "postgres://user:password@localhost:5432/odrive?sslmode=disable"
```

## Configuration

All configuration can be set via environment variables or command-line flags.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8090` | HTTP listen port |
| `ODRIVE_SECRET_KEY` | - | 32-character master key used for AES-256-GCM credential encryption |
| `DATABASE_URL` | - | PostgreSQL connection string or SQLite file path |
| `ODRIVE_ROOT_EMAIL` | `admin@example.local` | Protected root superadmin email |
| `ODRIVE_ROOT_PASSWORD` | auto-generated | Initial password for the root administrator |
| `GDRIVE_CLIENT_ID` | - | Google Cloud OAuth 2.0 Client ID |
| `GDRIVE_CLIENT_SECRET` | - | Google Cloud OAuth 2.0 Client Secret |
| `GDRIVE_REDIRECT_URL` | - | OAuth redirect callback URL |

## S3-Compatible Gateway

ODrive exposes an S3-compatible interface for client applications.

Configure your standard S3 SDK (AWS SDK, Boto3, MinIO Client, etc.) with:

```env
AWS_ACCESS_KEY_ID=odrv_live_app_...
AWS_SECRET_ACCESS_KEY=odrv_live_app_...
AWS_ENDPOINT_URL=http://localhost:8090/s3
AWS_REGION=us-east-1
S3_USE_PATH_STYLE=true
```

Supported operations:
- `PUT /s3/{bucket}/{key}`: Upload an object with zero-copy stream relay.
- `GET /s3/{bucket}/{key}`: Download an object with support for HTTP Range headers.
- `HEAD /s3/{bucket}/{key}`: Query metadata, content length, and ETag.
- `DELETE /s3/{bucket}/{key}`: Remove an object from the virtual file system.

## REST API Overview

Authentication: Session cookie (via Web UI) or `X-Omni-Key: <api_key>` header.

### Endpoints

- `GET /health` or `GET /api/v1/health`: System health status and version.
- `POST /api/v1/auth/login`: Authenticate and obtain session cookie.
- `POST /api/v1/auth/logout`: Destroy active session.
- `GET /api/v1/drives`: List configured virtual drives.
- `POST /api/v1/drives`: Create a virtual drive mapped to a connection.
- `GET /api/v1/connections`: List storage provider connections.
- `POST /api/v1/connections`: Add a storage provider connection.
- `POST /api/v1/connections/{id}/default`: Set connection as primary default.
- `GET /api/v1/files?drive_id={id}`: List files and folders.
- `POST /api/v1/files/upload?drive_id={id}`: Multipart streaming file upload.
- `GET /api/v1/files/download/{file_or_path}?drive_id={id}`: Stream file download.
- `DELETE /api/v1/files/{file_id}?drive_id={id}`: Delete a file.
- `GET /api/v1/shares`: List public share links.
- `POST /api/v1/shares`: Create a public download share token.
- `GET /s/{token}`: Public download link (no authentication required).
- `GET /api/v1/keys`: List service API keys.
- `POST /api/v1/keys`: Generate a new scoped service API key.
- `DELETE /api/v1/keys/{id}`: Revoke an API key.

## Development

Run backend and frontend independently during development:

```bash
# Terminal 1: Run frontend dev server
cd ui
npm run dev

# Terminal 2: Run Go backend with SQLite
go run ./cmd/odrive -addr :8090 -db ./data/dev.db
```

Run test suite:

```bash
go test -v ./...
```

## License

This project is licensed under the MIT License.
