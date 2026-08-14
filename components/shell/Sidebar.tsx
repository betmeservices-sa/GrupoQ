"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BedDouble, Bot, Building2, CalendarClock, CalendarDays, ConciergeBell, Contact, Filter, Inbox, LogOut, Megaphone, MessagesSquare, PhoneCall, Settings, Share2, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRole, type ModuleId } from "@/lib/roles";
import { activeTenantId } from "@/lib/tenants/active";
import { veModuloVoz } from "@/lib/tenants/voz";
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
  { id: "hoy", href: "/hoy", label: "Hoy", Icon: ConciergeBell },
  { id: "contactos", href: "/contactos", label: "Contactos", Icon: Contact },
  { id: "habitaciones", href: "/habitaciones", label: "Habitaciones", Icon: BedDouble },
  { id: "calendario", href: "/calendario", label: "Calendario", Icon: CalendarDays },
  { id: "pipeline", href: "/pipeline", label: "Pipeline", Icon: Filter },
  { id: "visitas", href: "/visitas", label: "Visitas", Icon: CalendarClock },
  { id: "cartera", href: "/cartera", label: "Cartera", Icon: Building2 },
  { id: "publicacion", href: "/publicacion", label: "Publicación", Icon: Share2 },
  { id: "interno", href: "/interno", label: "Chat interno", Icon: MessagesSquare },
  { id: "redes", href: "/redes", label: "Redes sociales", Icon: Megaphone },
  { id: "dashboard", href: "/dashboard", label: "Dashboard", Icon: BarChart3 },
  { id: "llamadas", href: "/llamadas", label: "Llamadas", Icon: PhoneCall },
  { id: "agentes", href: "/agentes", label: "Agentes", Icon: Bot },
  { id: "settings", href: "/settings", label: "Configuración", Icon: Settings },
];

export function Sidebar({
  open = false,
  onClose,
  onLogout,
}: {
  open?: boolean;
  onClose?: () => void;
  onLogout?: () => void;
}) {
  const pathname = usePathname();
  const { def } = useRole();
  const yo = staff.find((s) => s.id === ME)!;

  // "llamadas" y "agentes" los ve quien tiene voz contratada: la agencia
  // (miagentia) con la cuenta completa y sus costos, y cada cliente con su
  // agente y su vista por plan. Un tenant sin agente declarado no ve el modulo.
  // "hoy", "habitaciones" y "calendario" se apoyan en el sistema de reservas del
  // hotel: solo el hotel.
  // "pipeline", "visitas", "cartera" y "publicacion" son el tablero del agente
  // inmobiliario: solo la inmobiliaria.
  const tenant = activeTenantId();
  const veLlamadas = veModuloVoz(tenant);
  const veAgentes = veLlamadas;
  const veHotel = tenant === "hotel";
  const veInmobiliaria = tenant === "inmobiliaria";
  const visibles = NAV.filter(
    (item) =>
      def.ve.includes(item.id) &&
      (item.id !== "llamadas" || veLlamadas) &&
      (item.id !== "agentes" || veAgentes) &&
      (item.id !== "habitaciones" || veHotel) &&
      (item.id !== "calendario" || veHotel) &&
      (item.id !== "hoy" || veHotel) &&
      (item.id !== "pipeline" || veInmobiliaria) &&
      (item.id !== "visitas" || veInmobiliaria) &&
      (item.id !== "cartera" || veInmobiliaria) &&
      (item.id !== "publicacion" || veInmobiliaria),
  );

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
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] hover:bg-surface lg:hidden"
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
                  : "text-[var(--text-2)] hover:bg-surface hover:text-[var(--text)]",
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
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-[var(--text)]">{yo.nombre}</p>
            <p className="truncate text-[11px] text-[var(--text-3)]">En línea</p>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-3)] transition hover:bg-red-50 hover:text-[#a32923]"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
