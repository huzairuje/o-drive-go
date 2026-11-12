"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Folder,
  Home,
  HardDrive,
  FolderTree,
  Link2,
  Globe,
  ArrowLeftRight,
  RefreshCw,
  Share2,
  Zap,
  Activity,
  Sliders,
  Shield,
  Code2,
  Users,
  Search,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  User as UserIcon,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { api, User } from "@/lib/api";

type SectionKey = "home" | "files" | "activity" | "settings";

interface SubItem {
  label: string;
  href: string;
  icon: any;
}

const SECTION_CONFIG: Record<
  SectionKey,
  { label: string; rootHref: string; items: SubItem[] }
> = {
  home: {
    label: "HOME",
    rootHref: "/",
    items: [{ label: "Dashboard", href: "/", icon: Home }],
  },
  files: {
    label: "FILES",
    rootHref: "/explorer",
    items: [
      { label: "Explorer", href: "/explorer", icon: FolderTree },
      { label: "Drives", href: "/drives", icon: HardDrive },
      { label: "Connections", href: "/connections", icon: Link2 },
      { label: "WordPress", href: "/wordpress", icon: Globe },
    ],
  },
  activity: {
    label: "ACTIVITY",
    rootHref: "/transfers",
    items: [
      { label: "Transfers", href: "/transfers", icon: ArrowLeftRight },
      { label: "Backup & Sync", href: "/backup-sync", icon: RefreshCw },
      { label: "Shares", href: "/shares", icon: Share2 },
      { label: "Automations", href: "/automations", icon: Zap },
      { label: "Activity", href: "/activity", icon: Activity },
    ],
  },
  settings: {
    label: "SETTINGS",
    rootHref: "/settings",
    items: [
      { label: "General", href: "/settings?tab=general", icon: Sliders },
      { label: "Security & Password", href: "/settings?tab=security", icon: Shield },
      { label: "Developer", href: "/settings?tab=developer", icon: Code2 },
      { label: "Users & RBAC", href: "/settings?tab=rbac", icon: Users },
    ],
  },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine current path using both Next.js pathname and window.location for SSR/hydration resilience
  const currentPath =
    pathname ||
    (typeof window !== "undefined" ? window.location.pathname : "");

  const isLoginPage =
    currentPath === "/login" ||
    currentPath === "/login/" ||
    Boolean(currentPath?.startsWith("/login")) ||
    (typeof window !== "undefined" && window.location.pathname.includes("/login"));

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(isLoginPage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine active primary section based on currentPath
  let activeSection: SectionKey = "home";
  if (
    currentPath?.startsWith("/explorer") ||
    currentPath?.startsWith("/drives") ||
    currentPath?.startsWith("/connections") ||
    currentPath?.startsWith("/wordpress")
  ) {
    activeSection = "files";
  } else if (
    currentPath?.startsWith("/transfers") ||
    currentPath?.startsWith("/backup-sync") ||
    currentPath?.startsWith("/shares") ||
    currentPath?.startsWith("/automations") ||
    currentPath?.startsWith("/activity")
  ) {
    activeSection = "activity";
  } else if (currentPath?.startsWith("/settings")) {
    activeSection = "settings";
  }

  useEffect(() => {
    if (isLoginPage) {
      setAuthChecked(true);
      return;
    }

    api
      .getMe()
      .then((res) => {
        setCurrentUser(res.user);
        setAuthChecked(true);
      })
      .catch(() => {
        setAuthChecked(true);
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.includes("/login")
        ) {
          window.location.href = "/login/";
        }
      });
  }, [pathname, isLoginPage]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    window.location.href = "/login/";
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400 text-sm">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading ODrive...</span>
        </div>
      </div>
    );
  }

  const currentSectionConfig = SECTION_CONFIG[activeSection];
  const userInitials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "SA";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 antialiased">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 h-14 border-b border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 flex items-center justify-between">
        {/* Left: Brand + Section Tabs */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-slate-900 dark:text-zinc-100 hover:opacity-90"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Folder className="w-4 h-4 fill-white/20" />
            </div>
            <span className="font-bold tracking-tight text-base">ODrive</span>
          </Link>

          {/* Primary Top Nav Tabs */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Sections">
            {(
              [
                { key: "home", label: "Home", href: "/" },
                { key: "files", label: "Files", href: "/explorer" },
                { key: "activity", label: "Activity", href: "/transfers" },
                { key: "settings", label: "Settings", href: "/settings" },
              ] as const
            ).map((tab) => {
              const active = activeSection === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 font-semibold"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Search + Profile + Theme */}
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative hidden sm:block w-56 md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search across every drive"
              className="w-full pl-8 pr-3 py-1.5 rounded-full border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <ThemeToggle />

          {/* User profile badge & dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700/60 text-xs font-medium text-slate-700 dark:text-zinc-200 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 flex items-center justify-center font-bold text-[10px]">
                {userInitials}
              </div>
              <span className="hidden lg:inline max-w-[140px] truncate">
                {currentUser?.email || "admin"}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Profile Dropdown */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-2 z-50 text-xs">
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-zinc-800">
                  <div className="font-semibold text-slate-900 dark:text-zinc-100">
                    {currentUser?.name || "Super Administrator"}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate mt-0.5">
                    {currentUser?.email}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                      {currentUser?.role === "superadmin"
                        ? "Super Admin"
                        : currentUser?.role === "admin"
                        ? "Administrator"
                        : "Viewer"}
                    </span>
                    {currentUser?.is_root && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                        PROTECTED ROOT
                      </span>
                    )}
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings?tab=rbac"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  >
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>Manage Users &amp; RBAC</span>
                  </Link>
                  <Link
                    href="/settings?tab=general"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  >
                    <Sliders className="w-4 h-4 text-slate-400" />
                    <span>Settings</span>
                  </Link>
                </div>

                <div className="border-t border-slate-100 dark:border-zinc-800 pt-1 mt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
            {(
              [
                { key: "home", label: "Home", href: "/" },
                { key: "files", label: "Files", href: "/explorer" },
                { key: "activity", label: "Activity", href: "/transfers" },
                { key: "settings", label: "Settings", href: "/settings" },
              ] as const
            ).map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2 rounded-lg text-xs font-medium text-center ${
                  activeSection === tab.key
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-2 mb-1">
              {currentSectionConfig.label}
            </div>
            {currentSectionConfig.items.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium ${
                    active
                      ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 font-semibold"
                      : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex w-full">
        {/* Contextual Collapsible Sub-Sidebar (Desktop) */}
        <aside
          className={`hidden md:flex flex-col border-r border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all duration-200 shrink-0 ${
            sidebarCollapsed ? "w-16" : "w-52"
          }`}
        >
          {/* Sidebar Section Header */}
          <div className="h-10 px-4 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80">
            {!sidebarCollapsed && (
              <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                {currentSectionConfig.label}
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 ml-auto"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-3.5 h-3.5" />
              ) : (
                <PanelLeftClose className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Sidebar Nav Items */}
          <nav className="p-2 space-y-1" aria-label="Sub Navigation">
            {currentSectionConfig.items.map((item) => {
              const Icon = item.icon;
              // Check active status
              let active = false;
              if (item.href.includes("?tab=")) {
                const targetTab = item.href.split("?tab=")[1];
                if (typeof window !== "undefined") {
                  const urlParams = new URLSearchParams(window.location.search);
                  const currentTab = urlParams.get("tab") || "general";
                  active = pathname === "/settings" && currentTab === targetTab;
                } else {
                  active = false;
                }
              } else {
                active =
                  pathname === item.href ||
                  (item.href !== "/" && pathname?.startsWith(item.href));
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors ${
                    active
                      ? "bg-blue-100/80 text-blue-900 dark:bg-blue-950/70 dark:text-blue-200 font-semibold"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100/70 dark:hover:bg-zinc-800/50 font-medium"
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content View */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
