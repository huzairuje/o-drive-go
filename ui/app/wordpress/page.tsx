"use client";

import { Globe, HardDrive, Link2 } from "lucide-react";

export default function WordPressPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          WordPress Integration
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Connect WordPress media libraries directly to ODrive cloud storage backends.
        </p>
      </div>

      <div className="p-12 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 text-center flex flex-col items-center justify-center">
        <Globe className="w-8 h-8 text-slate-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
          WordPress Media Offloading
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm">
          Offload wp-content/uploads transparently via standard S3-compatible endpoints configured in wp-config.php.
        </p>
      </div>
    </div>
  );
}
