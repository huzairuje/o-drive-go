"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sliders,
  Shield,
  Code2,
  Users,
  Plus,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Server,
  Key,
} from "lucide-react";
import { api, APIKey, User } from "@/lib/api";
import { Portal } from "@/components/portal";

type SettingsTab = "general" | "security" | "developer" | "rbac";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as SettingsTab | null;
  const activeTab: SettingsTab = tabParam || "general";

  // General settings state (matching Screenshot 2)
  const [displayName, setDisplayName] = useState("Root Super Admin");
  const [workspaceName, setWorkspaceName] = useState("My Workspace");
  const [concurrentTransfers, setConcurrentTransfers] = useState("3");
  const [savedSettingsNotice, setSavedSettingsNotice] = useState(false);

  // Feature flags toggles (matching Screenshot 2)
  const [featureFlags, setFeatureFlags] = useState({
    gdrive: true,
    r2: true,
    s3: true,
    onedrive: false,
    telegram: false,
    uploadEngine: true,
    vfs: true,
    metadataIndex: true,
    localSearch: true,
    crossMove: false,
  });

  // Developer tab state
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [scopes, setScopes] = useState("read,write,s3");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Users & RBAC state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("admin");
  const [rbacError, setRbacError] = useState<string | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "developer") {
      loadKeys();
    } else if (activeTab === "rbac") {
      loadUsers();
    }
  }, [activeTab]);

  const loadKeys = () => {
    setKeysLoading(true);
    api.getKeys()
      .then((k) => {
        setKeys(k);
        setKeysLoading(false);
      })
      .catch(() => setKeysLoading(false));
  };

  const loadUsers = () => {
    setUsersLoading(true);
    api.getUsers()
      .then((u) => {
        setUsers(u);
        setUsersLoading(false);
      })
      .catch((err) => {
        setRbacError(err.message);
        setUsersLoading(false);
      });
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSettingsNotice(true);
    setTimeout(() => setSavedSettingsNotice(false), 2500);
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName) return;
    try {
      const res = await api.createKey({ name: keyName, scopes });
      setNewSecret(res.secret);
      setKeyName("");
      loadKeys();
    } catch (err: any) {
      alert("Failed to create API key: " + err.message);
    }
  };

  const handleDeleteKey = async (id: string, name: string) => {
    if (!confirm(`Revoke API key "${name}"?`)) return;
    try {
      await api.deleteKey(id);
      loadKeys();
    } catch (err: any) {
      alert("Failed to delete key: " + err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setRbacError(null);
    try {
      await api.createUser({
        email: newUserEmail,
        name: newUserName,
        password: newUserPassword,
        role: newUserRole,
      });
      setShowUserModal(false);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      loadUsers();
    } catch (err: any) {
      setRbacError(err.message);
    }
  };

  const handleDeleteUser = async (id: string, email: string, isRoot: boolean) => {
    if (isRoot) {
      alert("Root super administrator is protected and cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to delete user "${email}"?`)) return;
    try {
      await api.deleteUser(id);
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (newPassword.length < 8) {
      setPwdError("New password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("New passwords do not match");
      return;
    }

    setPwdLoading(true);
    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setPwdSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwdError(err.message || "Failed to update password");
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Configure workspace parameters, cloud adapters, security vault, and RBAC accounts.
        </p>
      </div>

      {/* GENERAL TAB (Faithful to Screenshot 2) */}
      {activeTab === "general" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Card 1: Workspace & Profile */}
            <div className="lg:col-span-7 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mb-4">
                Workspace &amp; Profile
              </h2>
              <form onSubmit={handleSaveGeneral} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Workspace name
                  </label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="My Workspace"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Concurrent transfers
                  </label>
                  <input
                    type="number"
                    value={concurrentTransfers}
                    onChange={(e) => setConcurrentTransfers(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-sm"
                  >
                    Save settings
                  </button>
                  {savedSettingsNotice && (
                    <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
                      <Check className="w-3.5 h-3.5" />
                      Settings updated
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Card 2: Registered Adapters */}
            <div className="lg:col-span-5 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mb-4">
                Registered adapters
              </h2>
              <div className="space-y-3">
                {[
                  { name: "Google Drive", slug: "google-drive", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  { name: "Cloudflare R2", slug: "r2", badgeColor: "bg-amber-50 text-amber-700 border-amber-200" },
                  { name: "Amazon S3", slug: "s3", badgeColor: "bg-orange-50 text-orange-700 border-orange-200" },
                  { name: "OneDrive", slug: "onedrive", badgeColor: "bg-blue-50 text-blue-700 border-blue-200" },
                  { name: "Telegram", slug: "telegram", badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200" },
                ].map((adapter) => (
                  <div
                    key={adapter.slug}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border ${adapter.badgeColor}`}>
                        {adapter.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                          {adapter.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {adapter.slug}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                      active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card 3: Feature Flags */}
          <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Feature flags
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {[
                { key: "gdrive", title: "Google Drive", desc: "OAuth-backed Google Drive adapter." },
                { key: "r2", title: "Cloudflare R2", desc: "S3-compatible R2 adapter." },
                { key: "s3", title: "Amazon S3", desc: "SigV4 S3 adapter." },
                { key: "onedrive", title: "OneDrive", desc: "Microsoft Graph adapter." },
                { key: "telegram", title: "Telegram", desc: "Bot API storage adapter." },
                { key: "uploadEngine", title: "Upload engine", desc: "Queued uploads with retry and cancel." },
                { key: "vfs", title: "Virtual filesystem", desc: "User-facing paths mapped to provider IDs." },
                { key: "metadataIndex", title: "Metadata index", desc: "Local index for instant browse." },
                { key: "localSearch", title: "Local search", desc: "Search the index without provider APIs." },
                { key: "crossMove", title: "Cross-provider move", desc: "Move files between two connections in one job." },
              ].map((flag) => {
                const isChecked = (featureFlags as any)[flag.key];
                return (
                  <div
                    key={flag.key}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                        {flag.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {flag.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFeatureFlags({
                          ...featureFlags,
                          [flag.key]: !isChecked,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isChecked ? "bg-blue-600" : "bg-slate-200 dark:bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isChecked ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECURITY & PASSWORD TAB */}
      {activeTab === "security" && (
        <div className="space-y-6">
          {/* Change Password Card */}
          <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Change Password
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Update the login password for your administrator account.
              </p>
            </div>

            {pwdError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/60 text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5 max-w-md text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  {pwdLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>

          {/* Master Encryption Vault Card */}
          <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Master Encryption Vault
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Provider credentials and OAuth refresh tokens are encrypted at rest using AES-256-GCM authenticated cipher with a 96-bit random nonce per record.
            </p>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Vault Cipher:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">AES-256-GCM (Hardware Accelerated)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Relay Strategy:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">Zero-Buffer (io.Pipe / HTTP Stream)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Disk Footprint:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">0 bytes cached (Direct to Upstream)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEVELOPER TAB */}
      {activeTab === "developer" && (
        <div className="space-y-6">
          {/* API Keys Table */}
          <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Active API Keys
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Service credentials for downstream apps and automated background workers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create API Key</span>
              </button>
            </div>

            {keysLoading ? (
              <p className="text-xs text-slate-400">Loading keys...</p>
            ) : keys.length === 0 ? (
              <p className="text-xs text-slate-400">No API keys generated yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 border-b border-slate-100 dark:border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Prefix</th>
                      <th className="py-2.5 px-3">Scopes</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {keys.map((k) => (
                      <tr key={k.id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-zinc-200">{k.name}</td>
                        <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400">{k.prefix}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{k.scopes}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteKey(k.id, k.name)}
                            className="p-1 rounded text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* S3 Gateway Specs */}
          <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              S3 Gateway Specification
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Downstream applications can point their standard S3 client directly to ODrive:
            </p>
            <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto">
{`# Client Application .env configuration
STORAGE_DRIVER=s3
S3_ENDPOINT=http://127.0.0.1:8090/s3
S3_BUCKET=media-library
S3_REGION=us-east-1
S3_USE_SSL=false`}
            </pre>
          </div>
        </div>
      )}

      {/* USERS & RBAC TAB (Requested by User) */}
      {activeTab === "rbac" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Role-Based Access Control (RBAC)
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Manage administrators and operators. Protected root super administrators cannot be deleted or demoted.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUserModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add User</span>
              </button>
            </div>

            {rbacError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rbacError}</span>
              </div>
            )}

            {usersLoading ? (
              <p className="text-xs text-slate-400">Loading user accounts...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">User / Email</th>
                      <th className="py-2.5 px-4 font-semibold">Name</th>
                      <th className="py-2.5 px-4 font-semibold">Role</th>
                      <th className="py-2.5 px-4 font-semibold">Security Status</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {users.map((u) => {
                      const isProtected = u.is_root;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-zinc-100">
                            {u.email}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                            {u.name}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                              {u.role === "superadmin"
                                ? "Super Admin"
                                : u.role === "admin"
                                ? "Admin"
                                : "Viewer"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {isProtected ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                                <Lock className="w-3 h-3" />
                                PROTECTED ROOT
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Normal</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isProtected ? (
                              <span className="text-[11px] text-slate-400 italic">
                                Permanent
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id, u.email, u.is_root)}
                                className="p-1 rounded text-slate-400 hover:text-red-600 transition-colors"
                                title="Delete user"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      {showUserModal && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                Add New User Account
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="admin2@example.local"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Operational Administrator"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Strong password"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="admin">Administrator</option>
                  <option value="superadmin">Super Administrator</option>
                  <option value="viewer">Viewer (Read-only)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
      )}

      {/* Modal: Create Key */}
      {showKeyModal && !newSecret && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                Generate API Key
              </h3>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Service / Application Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Primary App Relay"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Scopes
                </label>
                <input
                  type="text"
                  value={scopes}
                  onChange={(e) => setScopes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
      )}

      {/* Dialog: Key Secret Created */}
      {newSecret && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
              Save Your API Key
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              This secret is only shown once. Copy and store it securely in your application environment:
            </p>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-900 dark:text-zinc-100 truncate select-all">
                {newSecret}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(newSecret);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => {
                  setNewSecret(null);
                  setShowKeyModal(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </Portal>
      )}
    </div>
  );
}
