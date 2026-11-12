"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  FolderTree,
  Upload,
  Search,
  Trash2,
  Download,
  Share2,
  FileText,
  FileImage,
  FileAudio,
  FileArchive,
  File,
  Folder,
  X,
  Copy,
  Check,
  LayoutList,
  LayoutGrid,
  Clock,
  Star,
  Image as ImageIcon,
  ChevronDown,
} from "lucide-react";
import { api, Drive, FileMetadata, ShareLink } from "@/lib/api";
import { Portal } from "@/components/portal";

type CategoryTab = "all" | "recent" | "favorites" | "documents" | "images" | "trash";

export default function ExplorerPage() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState<string>("");
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [category, setCategory] = useState<CategoryTab>("all");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Share modal state
  const [shareFile, setShareFile] = useState<FileMetadata | null>(null);
  const [shareResult, setShareResult] = useState<ShareLink | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getDrives()
      .then((dList) => {
        setDrives(dList);
        if (dList.length > 0) {
          setSelectedDriveId(dList[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const loadFiles = (driveId: string) => {
    if (!driveId) return;
    setLoading(true);
    api.getFiles(driveId)
      .then((fList) => {
        setFiles(fList);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedDriveId) {
      loadFiles(selectedDriveId);
    }
  }, [selectedDriveId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !selectedDriveId) return;

    setUploading(true);
    setError(null);
    try {
      const file = fileList[0];
      await api.uploadFile(selectedDriveId, file);
      loadFiles(selectedDriveId);
    } catch (err: any) {
      setError("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!confirm(`Delete file "${fileName}"?`)) return;
    try {
      await api.deleteFile(selectedDriveId, fileId);
      loadFiles(selectedDriveId);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleCreateShare = async (f: FileMetadata) => {
    try {
      const link = await api.createShare({
        drive_id: selectedDriveId,
        file_id: f.id,
        file_name: f.name,
        mime_type: f.mime_type,
        size_bytes: f.size_bytes,
      });
      setShareResult(link);
    } catch (err: any) {
      alert("Failed to create share link: " + err.message);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (mime: string, kind: string) => {
    if (kind === "folder") return <Folder className="w-4 h-4 text-blue-500" />;
    if (mime.includes("image")) return <FileImage className="w-4 h-4 text-emerald-500" />;
    if (mime.includes("audio")) return <FileAudio className="w-4 h-4 text-amber-500" />;
    if (mime.includes("pdf") || mime.includes("document") || mime.includes("text")) return <FileText className="w-4 h-4 text-rose-500" />;
    if (mime.includes("zip") || mime.includes("tar") || mime.includes("compressed")) return <FileArchive className="w-4 h-4 text-purple-500" />;
    return <File className="w-4 h-4 text-slate-400" />;
  };

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (category === "documents") return f.mime_type.includes("pdf") || f.mime_type.includes("text") || f.mime_type.includes("document");
    if (category === "images") return f.mime_type.includes("image");
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header matching Screenshot 1 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Explorer
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Every document across every connected drive, in one place.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              viewMode === "list"
                ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300"
            }`}
            title="List view"
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              viewMode === "grid"
                ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300"
            }`}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Category Card */}
        <div className="md:col-span-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-sm space-y-1">
          {(
            [
              { key: "all", label: "All files", icon: FolderTree },
              { key: "recent", label: "Recent", icon: Clock },
              { key: "favorites", label: "Favorites", icon: Star },
              { key: "documents", label: "Documents", icon: FileText },
              { key: "images", label: "Images", icon: ImageIcon },
              { key: "trash", label: "Trash", icon: Trash2 },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = category === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setCategory(item.key)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-colors font-medium text-left ${
                  active
                    ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 font-semibold"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60"
                }`}
              >
                <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right File Section */}
        <div className="md:col-span-9 space-y-4">
          {/* Top Search & Filter Bar matching Screenshot 1 */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search names and tags across every drive"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-800 dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Type Filter */}
              <div className="relative">
                <select className="appearance-none pl-3 pr-7 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 font-medium focus:outline-none shadow-sm cursor-pointer">
                  <option>All types</option>
                  <option>Documents</option>
                  <option>Images</option>
                  <option>Archives</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Drives Dropdown */}
              <div className="relative">
                <select
                  value={selectedDriveId}
                  onChange={(e) => setSelectedDriveId(e.target.value)}
                  className="appearance-none pl-3 pr-7 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 font-medium focus:outline-none shadow-sm cursor-pointer"
                >
                  {drives.length === 0 && <option value="">All drives</option>}
                  {drives.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Sort Dropdown */}
              <div className="relative">
                <select className="appearance-none pl-3 pr-7 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 font-medium focus:outline-none shadow-sm cursor-pointer">
                  <option>Name</option>
                  <option>Size</option>
                  <option>Date modified</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Upload trigger */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !selectedDriveId}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? "Uploading..." : "Upload"}</span>
              </button>
            </div>
          </div>

          {/* Breadcrumb matching Screenshot 1 */}
          <div className="text-xs text-slate-400 font-mono pl-1">
            root
          </div>

          {/* Files container */}
          {drives.length === 0 ? (
            /* Screenshot 1 Empty State: No connected providers */
            <div className="p-16 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 text-center flex flex-col items-center justify-center">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                No connected providers
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm">
                Connect an account on the{" "}
                <Link href="/connections" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Connections page
                </Link>{" "}
                to populate the explorer.
              </p>
            </div>
          ) : filteredFiles.length === 0 ? (
            /* Empty drive state */
            <div className="p-16 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 text-center flex flex-col items-center justify-center">
              <FolderTree className="w-8 h-8 text-slate-400 mb-2" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                Drive is empty
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Upload files using the button above or stream files via S3 gateway.
              </p>
            </div>
          ) : viewMode === "list" ? (
            /* File Table List View */
            <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Name</th>
                    <th className="py-2.5 px-4 font-semibold hidden sm:table-cell">Type</th>
                    <th className="py-2.5 px-4 font-semibold">Size</th>
                    <th className="py-2.5 px-4 font-semibold hidden md:table-cell">Modified</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredFiles.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                      <td className="py-3 px-4 font-medium flex items-center gap-2.5">
                        {getFileIcon(f.mime_type, f.kind)}
                        <span className="truncate max-w-xs">{f.name}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-zinc-400 font-mono hidden sm:table-cell">
                        {f.mime_type}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-zinc-400 font-mono">
                        {formatBytes(f.size_bytes)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-zinc-400 hidden md:table-cell">
                        {new Date(f.modified_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`/api/v1/files/download/${f.id}?drive_id=${selectedDriveId}`}
                            download={f.name}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
                            title="Download file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setShareFile(f);
                              handleCreateShare(f);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-blue-600"
                            title="Create share link"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFile(f.id, f.name)}
                            className="p-1 rounded text-slate-400 hover:text-red-600"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredFiles.map((f) => (
                <div
                  key={f.id}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    {getFileIcon(f.mime_type, f.kind)}
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(f.id, f.name)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate" title={f.name}>
                      {f.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {formatBytes(f.size_bytes)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {shareFile && shareResult && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                Share Link Created
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShareFile(null);
                  setShareResult(null);
                }}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Anyone with this link can view or download this file directly:
            </p>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400 truncate">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/s/${shareResult.token}`
                  : `/s/${shareResult.token}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/s/${shareResult.token}`;
                  navigator.clipboard.writeText(url);
                  setCopiedShare(true);
                  setTimeout(() => setCopiedShare(false), 2000);
                }}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-200"
              >
                {copiedShare ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </Portal>
      )}
    </div>
  );
}
