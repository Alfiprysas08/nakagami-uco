"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Boxes, ClipboardList, LayoutDashboard, LogOut, Menu, ReceiptText, ShieldCheck, Users, WalletCards, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/layout/auth-provider";
import { Button } from "@/components/ui/button";
import type { Role } from "@/types/domain";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "ranger"] },
  { href: "/mitra", label: "Mitra", icon: Users, roles: ["admin", "ranger"] },
  { href: "/collection", label: "Collection", icon: ClipboardList, roles: ["admin", "ranger"] },
  { href: "/inventory", label: "Inventory", icon: Boxes, roles: ["admin", "ranger"] },
  { href: "/field-expense", label: "Field Expense", icon: ReceiptText, roles: ["admin", "ranger"] },
  { href: "/transaksi", label: "Transaksi", icon: WalletCards, roles: ["admin"] },
  { href: "/monthly-report", label: "Monthly Report", icon: BarChart3, roles: ["admin"] }
] satisfies Array<{ href: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }>;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser, loading, authError, logout } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !appUser) router.replace(`/login${authError ? `?reason=${encodeURIComponent(authError)}` : ""}`);
  }, [loading, appUser, authError, router]);

  useEffect(() => setOpen(false), [pathname]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-300">Memuat sesi...</div>;
  if (!appUser) return null;

  const allowed = items.filter((item) => item.roles.includes(appUser.role));

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  const nav = (
    <nav className="grid gap-1">
      {allowed.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-11 items-center gap-3 rounded-md px-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white",
              active && "bg-emerald-700/25 text-emerald-100"
            )}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-[var(--border)] bg-[var(--sidebar)] p-5 lg:block">
        <div className="mb-8">
          <div className="text-lg font-semibold">Nakagami UCO</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-emerald-300">{appUser.role}</div>
        </div>
        {nav}
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/70 lg:hidden">
          <aside className="h-full w-72 border-r border-[var(--border)] bg-[var(--sidebar)] p-5">
            <button className="mb-5 flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)]" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <main className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[#09120f]/90 px-4 backdrop-blur lg:px-8">
          <button className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] lg:hidden" onClick={() => setOpen(true)}>
            <Menu size={18} />
          </button>
          <div className="hidden items-center gap-2 text-sm text-slate-300 lg:flex">
            <ShieldCheck size={16} className="text-emerald-300" />
            {appUser.email || appUser.displayName || appUser.uid}
          </div>
          <Button className="h-9 border-slate-700 bg-transparent px-3 hover:bg-white/5" onClick={onLogout}>
            <LogOut size={16} /> Logout
          </Button>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
