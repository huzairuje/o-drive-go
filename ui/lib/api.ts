// API Client for Omni-Drive Go

export interface User {
  id: string;
  email: string;
  name: string;
  role: "superadmin" | "admin" | "viewer";
  is_root: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ActivityLog {
  id: string;
  user_email: string;
  action: string;
  resource: string;
  status: string;
  ip_address: string;
  created_at: string;
}

export interface Transfer {
  id: string;
  type: string;
  file_name: string;
  drive_name: string;
  size_bytes: number;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  error?: string;
  created_at: string;
  finished_at?: string;
}

export interface DashboardStats {
  storage_used_bytes: number;
  connections_count: number;
  drives_count: number;
  active_transfers: number;
  failed_transfers: number;
  active_shares: number;
  automations_count: number;
  providers_healthy: number;
  providers_total: number;
}

export interface Connection {
  id: string;
  name: string;
  provider: string;
  auth_type: string;
  status: string;
  email?: string;
  is_default?: boolean;
  created_at: string;
}

export interface Drive {
  id: string;
  name: string;
  slug: string;
  connection_id: string;
  root_folder_id: string;
  status: string;
  total_bytes: number;
  used_bytes: number;
  created_at: string;
}

export interface FileMetadata {
  id: string;
  drive_id: string;
  provider_file_id: string;
  parent_id: string;
  name: string;
  path: string;
  kind: "file" | "folder";
  mime_type: string;
  size_bytes: number;
  etag: string;
  modified_at: string;
}

export interface ShareLink {
  id: string;
  token: string;
  drive_id: string;
  file_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  max_downloads: number;
  download_count: number;
  created_at: string;
}

export interface APIKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  created_at: string;
  last_used_at?: string;
}

const BASE_URL = "";

async function fetchJSON<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `HTTP error ${res.status}`;
    try {
      const err = await res.json();
      if (err.error) msg = err.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  getHealth: () => fetchJSON<{ status: string; service: string; version: string }>("/api/v1/health"),

  // Authentication & RBAC
  login: (data: { email: string; password: string }) =>
    fetchJSON<{ token: string; user: User }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => fetchJSON<{ status: string }>("/api/v1/auth/logout", { method: "POST" }),
  getMe: () => fetchJSON<{ user: User }>("/api/v1/auth/me"),
  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
    fetchJSON<{ status: string }>("/api/v1/auth/password", { method: "POST", body: JSON.stringify(data) }),
  getUsers: () => fetchJSON<User[]>("/api/v1/users"),
  createUser: (data: { email: string; name: string; password: string; role: string }) =>
    fetchJSON<User>("/api/v1/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id: string) => fetchJSON<{ status: string }>(`/api/v1/users/${id}`, { method: "DELETE" }),

  // Stats, Activity & Transfers
  getStats: () => fetchJSON<DashboardStats>("/api/v1/stats"),
  getActivities: () => fetchJSON<ActivityLog[]>("/api/v1/activity"),
  getTransfers: (type?: string) => fetchJSON<Transfer[]>(`/api/v1/transfers${type ? `?type=${encodeURIComponent(type)}` : ""}`),
  createTransfer: (data: Partial<Transfer>) =>
    fetchJSON<Transfer>("/api/v1/transfers", { method: "POST", body: JSON.stringify(data) }),

  // Drives
  getDrives: () => fetchJSON<Drive[]>("/api/v1/drives"),
  createDrive: (data: { name: string; slug: string; connection_id: string; root_folder_id?: string }) =>
    fetchJSON<Drive>("/api/v1/drives", { method: "POST", body: JSON.stringify(data) }),
  deleteDrive: (id: string) => fetchJSON<{ ok: boolean }>(`/api/v1/drives/${id}`, { method: "DELETE" }),

  // Connections
  getConnections: () => fetchJSON<Connection[]>("/api/v1/connections"),
  createConnection: (data: { name: string; provider: string; auth_type: string; email?: string; credentials: any }) =>
    fetchJSON<Connection>("/api/v1/connections", { method: "POST", body: JSON.stringify(data) }),
  setDefaultConnection: (id: string) =>
    fetchJSON<{ status: string; default_connection_id: string; message: string }>(`/api/v1/connections/${id}/default`, {
      method: "POST",
    }),
  deleteConnection: (id: string) => fetchJSON<{ ok: boolean }>(`/api/v1/connections/${id}`, { method: "DELETE" }),

  // Files
  getFiles: (driveId: string, parentId?: string) =>
    fetchJSON<FileMetadata[]>(`/api/v1/files?drive_id=${encodeURIComponent(driveId)}${parentId ? `&parent_id=${encodeURIComponent(parentId)}` : ""}`),
  deleteFile: (driveId: string, fileId: string) =>
    fetchJSON<{ ok: boolean }>(`/api/v1/files/${fileId}?drive_id=${encodeURIComponent(driveId)}`, { method: "DELETE" }),
  uploadFile: async (driveId: string, file: File, parentId?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    const endpoint = `/api/v1/files/upload?drive_id=${encodeURIComponent(driveId)}${parentId ? `&parent_id=${encodeURIComponent(parentId)}` : ""}`;
    const res = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Upload failed with status ${res.status}`);
    }
    return res.json() as Promise<FileMetadata>;
  },

  // Shares
  getShares: () => fetchJSON<ShareLink[]>("/api/v1/shares"),
  createShare: (data: { drive_id: string; file_id: string; file_name: string; mime_type: string; size_bytes: number; max_downloads?: number }) =>
    fetchJSON<ShareLink>("/api/v1/shares", { method: "POST", body: JSON.stringify(data) }),

  // API Keys
  getKeys: () => fetchJSON<APIKey[]>("/api/v1/keys"),
  createKey: (data: { name: string; scopes?: string }) =>
    fetchJSON<{ key: APIKey; secret: string }>("/api/v1/keys", { method: "POST", body: JSON.stringify(data) }),
  deleteKey: (id: string) => fetchJSON<{ ok: boolean }>(`/api/v1/keys/${id}`, { method: "DELETE" }),
};
