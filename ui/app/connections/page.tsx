"use client";

import { useEffect, useState } from "react";
import { Link2, Plus, Trash2, CheckCircle2, AlertCircle, X, ChevronLeft, Shield, Star } from "lucide-react";
import { api, Connection } from "@/lib/api";
import { Portal } from "@/components/portal";

type ProviderId = "google-drive" | "cloudflare-r2" | "amazon-s3" | "onedrive" | "telegram";

interface ProviderOption {
  id: ProviderId;
  name: string;
  subtitle: string;
  iconBg: string;
  renderIcon: () => React.ReactNode;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: "google-drive",
    name: "Google Drive",
    subtitle: "Docs, Sheets and shared drives",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/50 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400",
    renderIcon: () => (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5z" fill="#0066DA" />
        <path d="M16.29 3.5H7.71l6.56 11.5h8.58z" fill="#00AC47" />
        <path d="M22.85 15l-3.43 6H4.58L8 15z" fill="#EA4335" />
      </svg>
    ),
  },
  {
    id: "cloudflare-r2",
    name: "Cloudflare R2",
    subtitle: "Zero egress S3-compatible buckets",
    iconBg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200/50 dark:border-amber-800/40 text-amber-500",
    renderIcon: () => (
      <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.8 11.6c-.3-2.6-2.5-4.6-5.2-4.6-2 0-3.8 1.1-4.7 2.8-.4-.1-.8-.2-1.3-.2-2 0-3.6 1.6-3.6 3.6 0 .3 0 .7.1 1-.1 0-.3-.1-.4-.1C2.1 14.1 1 15.2 1 16.6c0 1.4 1.1 2.5 2.6 2.5h15.2c2.3 0 4.2-1.9 4.2-4.2 0-2.1-1.6-3.9-3.7-4.2l-.5-.1z"/>
      </svg>
    ),
  },
  {
    id: "amazon-s3",
    name: "Amazon S3",
    subtitle: "Buckets across every AWS region",
    iconBg: "bg-orange-50 dark:bg-orange-950/40 border-orange-200/50 dark:border-orange-800/40 text-orange-500",
    renderIcon: () => (
      <svg className="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zm0 3c3.87 0 7 1.12 7 2.5S15.87 10 12 10 5 8.88 5 7.5 8.13 5 12 5zm0 15c-3.87 0-7-1.12-7-2.5v-2.3c1.78 1.09 4.26 1.8 7 1.8s5.22-.71 7-1.8v2.3c0 1.38-3.13 2.5-7 2.5zm0-5c-3.87 0-7-1.12-7-2.5v-2.3c1.78 1.09 4.26 1.8 7 1.8s5.22-.71 7-1.8v2.3c0 1.38-3.13 2.5-7 2.5z"/>
      </svg>
    ),
  },
  {
    id: "onedrive",
    name: "OneDrive",
    subtitle: "Microsoft 365 personal and business",
    iconBg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200/50 dark:border-blue-800/40 text-blue-500",
    renderIcon: () => (
      <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
      </svg>
    ),
  },
  {
    id: "telegram",
    name: "Telegram",
    subtitle: "Unlimited chat-backed object storage",
    iconBg: "bg-sky-50 dark:bg-sky-950/40 border-sky-200/50 dark:border-sky-800/40 text-sky-500",
    renderIcon: () => (
      <svg className="w-5 h-5 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
      </svg>
    ),
  },
];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wizard state: false | "choose" | "configure"
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<"choose" | "configure">("choose");
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption>(PROVIDERS[0]);

  // Common fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Google Drive specific
  const [authMode, setAuthMode] = useState<"oauth2" | "service_account">("oauth2");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");

  // Cloudflare R2 specific
  const [r2AccountId, setR2AccountId] = useState("");
  const [r2AccessKey, setR2AccessKey] = useState("");
  const [r2SecretKey, setR2SecretKey] = useState("");
  const [r2Bucket, setR2Bucket] = useState("");

  // Amazon S3 specific
  const [s3Region, setS3Region] = useState("us-east-1");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");

  // OneDrive specific
  const [oneDriveClientId, setOneDriveClientId] = useState("");
  const [oneDriveSecret, setOneDriveSecret] = useState("");
  const [oneDriveRefreshToken, setOneDriveRefreshToken] = useState("");

  // Telegram specific
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const loadData = () => {
    setLoading(true);
    api.getConnections()
      .then((cList) => {
        setConnections(cList);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  const handleOpenModal = () => {
    setModalStep("choose");
    setModalOpen(true);
    setError(null);
  };

  const handleSelectProvider = (p: ProviderOption) => {
    setSelectedProvider(p);
    setName(p.name + " Storage");
    setModalStep("configure");
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let credentialsPayload: any = {};
    let authType = "static_key";

    if (selectedProvider.id === "google-drive") {
      authType = authMode;
      if (authMode === "oauth2") {
        credentialsPayload = {
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        };
      } else {
        credentialsPayload = {
          service_account_json: serviceAccountJson,
        };
      }
    } else if (selectedProvider.id === "cloudflare-r2") {
      credentialsPayload = {
        account_id: r2AccountId,
        access_key_id: r2AccessKey,
        secret_access_key: r2SecretKey,
        bucket: r2Bucket,
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      };
    } else if (selectedProvider.id === "amazon-s3") {
      credentialsPayload = {
        region: s3Region,
        access_key_id: s3AccessKey,
        secret_access_key: s3SecretKey,
        bucket: s3Bucket,
      };
    } else if (selectedProvider.id === "onedrive") {
      credentialsPayload = {
        client_id: oneDriveClientId,
        client_secret: oneDriveSecret,
        refresh_token: oneDriveRefreshToken,
      };
    } else if (selectedProvider.id === "telegram") {
      credentialsPayload = {
        bot_token: telegramBotToken,
        chat_id: telegramChatId,
      };
    }

    try {
      await api.createConnection({
        name: name || selectedProvider.name,
        provider: selectedProvider.id,
        auth_type: authType,
        email: email,
        credentials: credentialsPayload,
      });

      setModalOpen(false);
      // Reset fields
      setName("");
      setEmail("");
      setClientId("");
      setClientSecret("");
      setRefreshToken("");
      setServiceAccountJson("");
      setR2AccountId("");
      setR2AccessKey("");
      setR2SecretKey("");
      setR2Bucket("");
      setS3AccessKey("");
      setS3SecretKey("");
      setS3Bucket("");
      setTelegramBotToken("");
      setTelegramChatId("");
      loadData();
    } catch (err: any) {
      setError(`Gagal menghubungkan ${selectedProvider.name}: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const handleSetDefault = async (id: string, connName: string) => {
    try {
      setSettingDefaultId(id);
      await api.setDefaultConnection(id);
      loadData();
    } catch (err: any) {
      alert("Gagal menjadikan default: " + err.message);
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleDelete = async (id: string, connName: string) => {
    if (!confirm(`Hapus koneksi "${connName}"? Virtual drive yang terhubung akan nonaktif.`)) return;
    try {
      await api.deleteConnection(id);
      loadData();
    } catch (err: any) {
      alert("Gagal menghapus koneksi: " + err.message);
    }
  };

  const getProviderIcon = (providerStr: string) => {
    const found = PROVIDERS.find((p) => p.id === providerStr);
    if (found) return found.renderIcon();
    return <Link2 className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Page Header matching Screenshot 2 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Connections</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Every provider account linked to this workspace. Unlimited accounts per provider.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add connection</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Connections List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          <div className="h-32 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl" />
          <div className="h-32 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl" />
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-20 px-4 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl bg-white/50 dark:bg-zinc-900/40 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-slate-400">
            <Link2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-zinc-100">No connected providers</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
              Link your storage provider accounts (Google Drive, Cloudflare R2, Amazon S3, etc.) to start managing files.
            </p>
          </div>
          <button
            onClick={handleOpenModal}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors"
          >
            Connect an Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connections.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex items-start justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-center shrink-0">
                    {getProviderIcon(c.provider)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                      {c.name.replace(" (Default)", "")}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{c.email || c.provider}</p>
                  </div>
                </div>

                <div className="text-[11px] space-y-1 font-mono text-slate-500 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Provider:</span>
                    <span className="font-medium text-slate-700 dark:text-zinc-300 capitalize">{c.provider}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Auth:</span>
                    <span className="font-medium text-slate-700 dark:text-zinc-300">{c.auth_type}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>CONNECTED</span>
                  </div>

                  {c.is_default ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
                      <Star className="w-3 h-3 fill-current text-blue-600 dark:text-blue-400" />
                      <span>DEFAULT</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={settingDefaultId === c.id}
                      onClick={() => handleSetDefault(c.id, c.name)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors"
                      title="Jadikan provider penyimpanan utama untuk seluruh virtual drive"
                    >
                      <Star className="w-3 h-3 text-slate-400" />
                      <span>{settingDefaultId === c.id ? "Menyimpan..." : "Jadikan Default"}</span>
                    </button>
                  )}
                </div>
              </div>

              {c.id !== "mock-conn" && (
                <button
                  onClick={() => handleDelete(c.id, c.name)}
                  className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Delete Connection"
                  aria-label={`Delete connection ${c.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Wizard */}
      {modalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Step 1: Choose a Provider (Matching Screenshot 2 exactly) */}
            {modalStep === "choose" ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Choose a provider</h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Every provider goes through the same adapter interface: add as many accounts as you like.
                    </p>
                  </div>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors shrink-0"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProvider(p)}
                      className="w-full p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-all flex items-center gap-3.5 text-left group"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105 ${p.iconBg}`}>
                        {p.renderIcon()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {p.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                          {p.subtitle}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Step 2: Configure Selected Provider */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setModalStep("choose")}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                    Connect {selectedProvider.name}
                  </span>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateConnection} className="space-y-3.5 text-xs">
                  {/* Account Label */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-zinc-300">Account Label</label>
                    <input
                      type="text"
                      required
                      placeholder={`e.g. My ${selectedProvider.name} Storage`}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Provider: Google Drive */}
                  {selectedProvider.id === "google-drive" && (
                    <>
                      {/* Auth Mode Toggle */}
                      <div className="flex rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 p-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setAuthMode("oauth2")}
                          className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                            authMode === "oauth2"
                              ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm"
                              : "text-slate-500 dark:text-zinc-400 hover:text-slate-900"
                          }`}
                        >
                          Google OAuth 2.0
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthMode("service_account")}
                          className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                            authMode === "service_account"
                              ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm"
                              : "text-slate-500 dark:text-zinc-400 hover:text-slate-900"
                          }`}
                        >
                          Service Account JSON
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">Google Email</label>
                        <input
                          type="email"
                          placeholder="admin@example.local"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {authMode === "oauth2" ? (
                        <>
                          <div className="space-y-1">
                            <label className="font-semibold text-slate-700 dark:text-zinc-300">Client ID</label>
                            <input
                              type="text"
                              required
                              placeholder="123456789-abcdef.apps.googleusercontent.com"
                              value={clientId}
                              onChange={(e) => setClientId(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="font-semibold text-slate-700 dark:text-zinc-300">Client Secret</label>
                            <input
                              type="password"
                              required
                              placeholder="GOCSPX-xxxxxxxxxxxxxxxx"
                              value={clientSecret}
                              onChange={(e) => setClientSecret(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="font-semibold text-slate-700 dark:text-zinc-300">Refresh Token</label>
                            <input
                              type="password"
                              required
                              placeholder="1//04xxxxxxxxxxxxxxxxxxxxxxxx"
                              value={refreshToken}
                              onChange={(e) => setRefreshToken(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-700 dark:text-zinc-300">Service Account Key JSON</label>
                          <textarea
                            rows={5}
                            required
                            placeholder='{"type": "service_account", "project_id": "...", "private_key": "..."}'
                            value={serviceAccountJson}
                            onChange={(e) => setServiceAccountJson(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Provider: Cloudflare R2 */}
                  {selectedProvider.id === "cloudflare-r2" && (
                    <>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">Cloudflare Account ID</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 3f316a47df3c1e1f161cb7df94230a63"
                          value={r2AccountId}
                          onChange={(e) => setR2AccountId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">R2 Bucket Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. media-library-assets"
                          value={r2Bucket}
                          onChange={(e) => setR2Bucket(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">Access Key ID</label>
                        <input
                          type="text"
                          required
                          placeholder="R2 Access Key"
                          value={r2AccessKey}
                          onChange={(e) => setR2AccessKey(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">Secret Access Key</label>
                        <input
                          type="password"
                          required
                          placeholder="R2 Secret Key"
                          value={r2SecretKey}
                          onChange={(e) => setR2SecretKey(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Provider: Amazon S3 */}
                  {selectedProvider.id === "amazon-s3" && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-700 dark:text-zinc-300">Region</label>
                          <input
                            type="text"
                            required
                            placeholder="ap-southeast-1"
                            value={s3Region}
                            onChange={(e) => setS3Region(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-700 dark:text-zinc-300">Bucket Name</label>
                          <input
                            type="text"
                            required
                            placeholder="my-s3-bucket"
                            value={s3Bucket}
                            onChange={(e) => setS3Bucket(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">Access Key ID</label>
                        <input
                          type="text"
                          required
                          placeholder="AKIA..."
                          value={s3AccessKey}
                          onChange={(e) => setS3AccessKey(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">Secret Access Key</label>
                        <input
                          type="password"
                          required
                          placeholder="Secret Access Key"
                          value={s3SecretKey}
                          onChange={(e) => setS3SecretKey(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Provider: OneDrive */}
                  {selectedProvider.id === "onedrive" && (
                    <>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">Microsoft Email</label>
                        <input
                          type="email"
                          placeholder="user@outlook.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">Azure Client ID</label>
                        <input
                          type="text"
                          required
                          placeholder="Azure App Client ID"
                          value={oneDriveClientId}
                          onChange={(e) => setOneDriveClientId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">Client Secret</label>
                        <input
                          type="password"
                          required
                          placeholder="Client Secret"
                          value={oneDriveSecret}
                          onChange={(e) => setOneDriveSecret(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">Refresh Token</label>
                        <input
                          type="password"
                          required
                          placeholder="Refresh Token"
                          value={oneDriveRefreshToken}
                          onChange={(e) => setOneDriveRefreshToken(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Provider: Telegram */}
                  {selectedProvider.id === "telegram" && (
                    <>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">Telegram Bot Token</label>
                        <input
                          type="password"
                          required
                          placeholder="123456789:ABCDefghIJKLmnOPQRstuvw"
                          value={telegramBotToken}
                          onChange={(e) => setTelegramBotToken(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-zinc-300">Target Channel or Chat ID</label>
                        <input
                          type="text"
                          required
                          placeholder="-1001234567890"
                          value={telegramChatId}
                          onChange={(e) => setTelegramChatId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setModalStep("choose")}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-semibold text-xs transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-50"
                    >
                      {submitting ? "Encrypting & Saving..." : "Save Connection"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </Portal>
      )}
    </div>
  );
}
