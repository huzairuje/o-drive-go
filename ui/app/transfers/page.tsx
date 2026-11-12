"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Upload,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
} from "lucide-react";
import { api, Transfer } from "@/lib/api";

type FilterTab = "all" | "upload" | "download";

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [loading, setLoading] = useState(true);

  const loadTransfers = () => {
    setLoading(true);
    api
      .getTransfers(filter === "all" ? undefined : filter)
      .then((data) => {
        setTransfers(data);
        setLoading(false);
      })
      .catch(() => {
        setTransfers([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadTransfers();
  }, [filter]);

  const activeQueue = transfers.filter(
    (t) => t.status === "queued" || t.status === "running"
  );
  const history = transfers.filter(
    (t) => t.status === "completed" || t.status === "failed"
  );

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header matching Screenshot 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Transfers
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Queued, running and completed jobs across every provider adapter.
          </p>
        </div>

        {/* Right controls: filter tabs + Queue upload button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filter === "all"
                  ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-900"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("upload")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filter === "upload"
                  ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-900"
              }`}
            >
              Uploads
            </button>
            <button
              type="button"
              onClick={() => setFilter("download")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filter === "download"
                  ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-900"
              }`}
            >
              Downloads
            </button>
          </div>

          <a
            href="/explorer"
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Queue upload</span>
          </a>
        </div>
      </div>

      {/* Card 1: Active queue matching Screenshot 4 */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800 font-semibold text-xs text-slate-900 dark:text-zinc-100">
          Active queue
        </div>
        <div className="p-8">
          {activeQueue.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500 text-center font-medium">
              Nothing in the queue right now.
            </p>
          ) : (
            <div className="space-y-3">
              {activeQueue.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl border border-slate-200/60 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 dark:text-zinc-100">
                      {t.file_name}
                    </span>
                    <span className="text-[11px] text-blue-600 font-mono">
                      {t.progress}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${t.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{t.drive_name}</span>
                    <span>{formatBytes(t.size_bytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card 2: History matching Screenshot 4 */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800 font-semibold text-xs text-slate-900 dark:text-zinc-100">
          History
        </div>
        <div className="p-8">
          {history.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500 text-center font-semibold text-slate-700 dark:text-zinc-300">
              No completed or failed jobs yet
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800 -my-4">
              {history.map((t) => (
                <div
                  key={t.id}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-4">
                    <p className="font-medium text-slate-900 dark:text-zinc-100 truncate">
                      {t.file_name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {t.drive_name} &bull; {formatBytes(t.size_bytes)} &bull;{" "}
                      {new Date(t.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                      t.status === "completed"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
