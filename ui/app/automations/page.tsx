"use client";

import { Zap, Play, Clock, ArrowRight } from "lucide-react";

export default function AutomationsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          Automations
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Event-driven triggers, cleanup policies, and automatic quota rebalancing rules.
        </p>
      </div>

      <div className="p-12 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 text-center flex flex-col items-center justify-center">
        <Zap className="w-8 h-8 text-slate-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
          No Automations Configured
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm">
          Configure automated triggers such as automatic image optimization or cold storage archiving.
        </p>
      </div>
    </div>
  );
}
