"use client";

import { useEffect, useState } from "react";
import { Activity, Shield, RefreshCw } from "lucide-react";
import { api, ActivityLog } from "@/lib/api";

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = () => {
    setLoading(true);
    api
      .getActivities()
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch(() => {
        setLogs([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Activity
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Audit logs of authentication, file movements, and security actions.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchLogs}
          className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 text-xs flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3 animate-pulse">
            <div className="h-8 bg-slate-100 dark:bg-zinc-800 rounded-lg" />
            <div className="h-8 bg-slate-100 dark:bg-zinc-800 rounded-lg" />
            <div className="h-8 bg-slate-100 dark:bg-zinc-800 rounded-lg" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center">
            <Shield className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              No activity logs recorded yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">User</th>
                  <th className="py-2.5 px-4 font-semibold">Action</th>
                  <th className="py-2.5 px-4 font-semibold">Resource</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold hidden md:table-cell">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-zinc-100">
                      {log.user_email}
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-zinc-300 font-mono">
                      {log.resource}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          log.status === "success"
                            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono hidden md:table-cell">
                      {log.ip_address || "127.0.0.1"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
