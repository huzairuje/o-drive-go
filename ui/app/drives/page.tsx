"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HardDrive, Plus, Trash2, FolderTree, ExternalLink, X, AlertCircle } from "lucide-react";
import { api, Drive, Connection } from "@/lib/api";
import { Portal } from "@/components/portal";

export default function DrivesPage() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formConnId, setFormConnId] = useState("");
  const [formFolderId, setFormFolderId] = useState("root");
  const [submitting, setSubmitting] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([api.getDrives(), api.getConnections()])
      .then(([d, c]) => {
        setDrives(d);
        setConnections(c);
        if (c.length > 0 && !formConnId) {
          setFormConnId(c[0].id);
        }
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formSlug || !formConnId) return;

    setSubmitting(true);
    try {
      await api.createDrive({
        name: formName,
        slug: formSlug.toLowerCase().replace(/[^a-z0-9-_]/g, "-"),
        connection_id: formConnId,
        root_folder_id: formFolderId || "root",
      });
      setShowModal(false);
      setFormName("");
      setFormSlug("");
      loadData();
    } catch (err: any) {
      alert("Gagal membuat drive: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus drive "${name}"?`)) return;
    try {
      await api.deleteDrive(id);
      loadData();
    } catch (err: any) {
      alert("Gagal menghapus drive: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Kelola Drive Sistem</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daftar virtual drive dan bucket penyimpanan yang dialokasikan untuk downstream services.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          type="button"
          className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center gap-2 min-h-[44px] self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Drive Baru</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          <div className="h-40 bg-card border border-border rounded-xl" />
          <div className="h-40 bg-card border border-border rounded-xl" />
        </div>
      ) : drives.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-border rounded-xl bg-card space-y-4">
          <HardDrive className="w-12 h-12 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-base">Belum Ada Drive Terdaftar</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Buat drive baru untuk mulai menghubungkan Google Drive dengan endpoint S3 atau REST API.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 min-h-[44px]"
          >
            Buat Drive Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {drives.map((d) => (
            <div key={d.id} className="p-5 rounded-xl border border-border bg-card shadow-panel space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-lg bg-secondary text-primary flex items-center justify-center font-bold">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-success/10 text-success border border-success/20">
                    {d.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-foreground">{d.name}</h3>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">slug: {d.slug}</p>
                </div>
                <div className="text-xs space-y-1 pt-2 border-t border-border/60">
                  <div className="flex justify-between text-muted-foreground">
                    <span>S3 Endpoint:</span>
                    <span className="font-mono text-foreground font-medium">/s3/{d.slug}/</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Root Folder:</span>
                    <span className="font-mono text-foreground">{d.root_folder_id}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <Link
                  href={`/explorer/?drive_id=${d.id}`}
                  className="flex-1 px-3 py-2 rounded-md bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  <FolderTree className="w-3.5 h-3.5 text-primary" />
                  <span>Jelajahi File</span>
                </Link>
                <button
                  onClick={() => handleDelete(d.id, d.name)}
                  className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="Hapus Drive"
                  aria-label={`Hapus drive ${d.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog Form Tambah Drive */}
      {showModal && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lift space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-foreground">Tambah Drive Baru</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground min-h-[36px] min-w-[36px] flex items-center justify-center"
                aria-label="Tutup dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Nama Drive</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Personal Documents & Media"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!formSlug) {
                      setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "-"));
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Slug (S3 Bucket Identifier)</label>
                <input
                  type="text"
                  required
                  placeholder="personal-vault"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Koneksi Akun Penyimpanan</label>
                <select
                  value={formConnId}
                  onChange={(e) => setFormConnId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.provider})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Google Drive Root Folder ID (Opsional)</label>
                <input
                  type="text"
                  placeholder="root"
                  value={formFolderId}
                  onChange={(e) => setFormFolderId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground">
                  Gunakan "root" untuk direktori utama atau isi ID folder Google Drive spesifik.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-secondary text-sm font-medium min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 min-h-[44px]"
                >
                  {submitting ? "Menyimpan..." : "Simpan Drive"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
      )}
    </div>
  );
}
