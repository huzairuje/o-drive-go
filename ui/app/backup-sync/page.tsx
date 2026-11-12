"use client";

import { RefreshCw, Cloud, HardDrive, CheckCircle2 } from "lucide-react";

export default function BackupSyncPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          Backup &amp; Sync
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Automated replication pipelines between local storage, Google Drive, and S3 compatible targets.
        </p>
      </div>

      <div className="p-12 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 text-center flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-slate-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
          Continuous Sync Active
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm">
          Files written through the S3 Relay Gateway (/s3) or uploaded via REST are streamed directly to upstream Google Drive.
        </p>
      </div>
    </div>
  );
}
