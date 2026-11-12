"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Database,
  Zap,
  ArrowUpDown,
  Link2,
  Activity,
  ArrowRight,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api, DashboardStats, Transfer, ActivityLog } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getStats().catch(() => null),
      api.getTransfers().catch(() => []),
      api.getActivities().catch(() => []),
    ]).then(([st, tr, ac]) => {
      if (st) setStats(st);
      if (tr) setTransfers(tr.slice(0, 5));
      if (ac) setActivities(ac.slice(0, 5));
      setLoading(false);
    });
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          Dashboard
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
          Live overview of your workspace: every number below comes from your actual drives, transfers and shares.
        </p>
      </div>

      {/* 6 Stats Cards Grid (3x2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. STORAGE USED */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>STORAGE USED</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-zinc-100 font-mono">
            {formatBytes(stats?.storage_used_bytes || 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {stats?.connections_count || 0} connections
          </div>
        </div>

        {/* 2. DRIVES & CONNECTIONS */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>DRIVES &amp; CONNECTIONS</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-zinc-100 font-mono">
            {stats ? `${stats.drives_count} / ${stats.connections_count}` : "0 / 0"}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            drives / connections
          </div>
        </div>

        {/* 3. ACTIVE TRANSFERS */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>ACTIVE TRANSFERS</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-zinc-100 font-mono">
            {stats?.active_transfers || 0}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {stats?.failed_transfers || 0} failed jobs
          </div>
        </div>

        {/* 4. ACTIVE SHARES */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <Link2 className="w-3.5 h-3.5 text-slate-400" />
            <span>ACTIVE SHARES</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-zinc-100 font-mono">
            {stats?.active_shares || 0}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {stats?.active_shares || 0} total
          </div>
        </div>

        {/* 5. AUTOMATIONS */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-slate-400" />
            <span>AUTOMATIONS</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-zinc-100 font-mono">
            {stats?.automations_count || 0}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {stats?.automations_count || 0} configured
          </div>
        </div>

        {/* 6. PROVIDER HEALTH */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>PROVIDER HEALTH</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-zinc-100 font-mono">
            {stats ? `${stats.providers_healthy}/${stats.providers_total}` : "0/0"}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {stats && stats.providers_total > 0 ? "All providers synced" : "No sync yet"}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Transfers & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent transfers */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Recent transfers
            </h2>
            <Link
              href="/transfers"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex-1 py-6 flex flex-col justify-center">
            {transfers.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 text-center">
                No transfers yet. Move a file in the Explorer to see it here.
              </p>
            ) : (
              <div className="space-y-2.5">
                {transfers.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/60"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-medium text-slate-900 dark:text-zinc-100 truncate">
                        {t.file_name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        {t.drive_name} &bull; {formatBytes(t.size_bytes)}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        t.status === "completed"
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          : t.status === "failed"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
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

        {/* Recent activity */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Recent activity
            </h2>
            <Link
              href="/activity"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex-1 py-6 flex flex-col justify-center">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 text-center">
                Nothing recorded yet: connect a drive to get started.
              </p>
            ) : (
              <div className="space-y-2.5">
                {activities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/60"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-zinc-100 truncate">
                        <span>{a.action}</span>
                        <span className="text-[11px] text-slate-400 font-mono truncate">
                          ({a.resource})
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                        {a.user_email} &bull; {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        a.status === "success"
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
