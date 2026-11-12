"use client";

import { useEffect, useState } from "react";
import { Share2, Trash2, Copy, Check, ExternalLink, AlertCircle } from "lucide-react";
import { api, ShareLink } from "@/lib/api";

export default function SharesPage() {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    api.getShares()
      .then((sList) => {
        setShares(sList);
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

  const copyUrl = (token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Tautan Publik &amp; Aset Terbagi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tautan publik aman untuk streaming aset media, cover buku, dan bundle game di aplikasi downstream.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 space-y-3 animate-pulse">
          <div className="h-10 bg-secondary rounded-lg" />
          <div className="h-10 bg-secondary rounded-lg" />
        </div>
      ) : shares.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-border rounded-xl bg-card space-y-3">
          <Share2 className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">Belum Ada Tautan Publik</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Buka menu File Explorer dan klik tombol Share pada file untuk membuat tautan publik baru.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/50 text-xs font-semibold text-muted-foreground border-b border-border uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nama File</th>
                  <th className="py-3 px-4">Token Tautan</th>
                  <th className="py-3 px-4">Ukuran</th>
                  <th className="py-3 px-4">Diunduh</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shares.map((s) => (
                  <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground truncate max-w-xs">
                      {s.file_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-primary truncate max-w-[200px]">
                      /s/{s.token}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                      {formatBytes(s.size_bytes)}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {s.download_count} kali
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => copyUrl(s.token)}
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Salin Tautan"
                          aria-label={`Salin tautan ${s.file_name}`}
                        >
                          {copiedToken === s.token ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <a
                          href={`/s/${s.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Buka Tautan"
                          aria-label={`Buka tautan ${s.file_name}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
