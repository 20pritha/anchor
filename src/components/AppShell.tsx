"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChatIcon,
  MemoryIcon,
  ActivityIcon,
  PeopleIcon,
  InfoIcon,
  MenuIcon,
  CloseIcon,
} from "@/components/icons";

const NAV = [
  { href: "/", label: "Chat", Icon: ChatIcon },
  { href: "/memory", label: "Memory", Icon: MemoryIcon },
  { href: "/recent", label: "Recent activity", Icon: ActivityIcon },
  { href: "/caregiver", label: "Caregiver", Icon: PeopleIcon },
  { href: "/about", label: "About", Icon: InfoIcon },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className="flex items-center gap-3 rounded-full px-4 py-2.5 text-[1.05rem] font-semibold transition-colors"
            style={{
              background: active ? "var(--md-secondary-container)" : "transparent",
              color: active ? "var(--md-on-secondary-container)" : "var(--md-on-surface-variant)",
            }}
          >
            <Icon className="h-6 w-6 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-4 flex items-center gap-2.5 px-2 pt-1">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold"
          style={{ background: "var(--md-primary)", color: "var(--md-on-primary)" }}
        >
          ⚓
        </span>
        <div className="leading-tight">
          <div className="text-xl font-bold">Anchor</div>
          <div className="text-xs" style={{ color: "var(--md-on-surface-variant)" }}>
            Memory companion
          </div>
        </div>
      </div>

      <NavList pathname={pathname} onNavigate={onNavigate} />

      <div className="mt-auto px-2 pt-4">
        <p
          className="rounded-2xl px-3 py-2.5 text-[0.8rem] leading-snug"
          style={{
            background: "var(--md-surface-container-high)",
            color: "var(--md-on-surface-variant)",
          }}
        >
          Anchor is <strong>not a medical device</strong> — just a memory companion.
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Persistent sidebar (desktop) */}
      <aside
        className="sticky top-0 hidden h-screen w-[264px] shrink-0 border-r md:block"
        style={{ borderColor: "var(--md-outline-variant)", background: "var(--md-surface-container-low)" }}
      >
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-2.5 md:hidden"
          style={{ borderColor: "var(--md-outline-variant)", background: "var(--md-surface-container-low)" }}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="rounded-full p-1.5"
            style={{ color: "var(--md-on-surface-variant)" }}
          >
            <MenuIcon />
          </button>
          <span className="text-xl font-bold">Anchor</span>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="absolute left-0 top-0 h-full w-[280px] shadow-2xl"
            style={{ background: "var(--md-surface-container-low)" }}
          >
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="rounded-full p-1.5"
                style={{ color: "var(--md-on-surface-variant)" }}
              >
                <CloseIcon />
              </button>
            </div>
            <SidebarContent pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
