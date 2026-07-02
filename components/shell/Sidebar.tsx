"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Inbox, Megaphone, MessagesSquare, Settings, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRole, type ModuleId } from "@/lib/roles";
import { staff, ME } from "@/lib/data/seed";
import { Avatar } from "@/components/ui/Avatar";
import { Brand } from "./Brand";
import { RoleSwitcher } from "./RoleSwitcher";
import { Reloj } from "./Reloj";

interface NavItem {
  id: ModuleId;
  href: string;
  label: string;
  Icon: LucideIcon;
}

const NAV: NavItem[] = [
  { id: "bandeja", href: "/", label: "Bandeja", Icon: Inbox },
  { id: "interno", href: "/interno", label: "Chat interno", Icon: MessagesSquare },
  { id: "redes", href: "/redes", label: "Redes sociales", Icon: Megaphone },
  { id: "dashboard", href: "/dashboard", label: "Dashboard", Icon: BarChart3 },
  { id: "settings", href: "/settings", label: "Configuración", Icon: Settings },
];

export function Sidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { def } = useRole();
  const yo = staff.find((s) => s.id === ME)!;

  const visibles = NAV.filter((item) => def.ve.includes(item.id));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-card transition-transform lg:static lg:z-auto lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-4">
        <Brand />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar menú"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94a3b4] hover:bg-surface lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <div className="border-b border-line px-3 py-2.5">
        <Reloj />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibles.map(({ id, href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={id}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                active
                  ? "bg-brand text-white shadow-sm shadow-brand/25"
                  : "text-[#5b6b80] hover:bg-surface hover:text-[#0f1b2d]",
              )}
            >
              <Icon size={18} strokeWidth={2.1} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-line p-3">
        <RoleSwitcher />
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <Avatar iniciales={yo.iniciales} size={34} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-[#0f1b2d]">{yo.nombre}</p>
            <p className="truncate text-[11px] text-[#94a3b4]">{def.nombre} · en línea</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
