"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgePercent, MessagesSquare as MsgSq, TicketCheck, BarChart3, BedDouble, Bot, BotOff, Building2, CalendarClock, CalendarDays, ConciergeBell, Contact, Filter, HandCoins, IdCard, Inbox, LogOut, Megaphone, MessagesSquare, PhoneCall, PhoneOutgoing, Settings, Share2, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRole, type ModuleId } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { sinLeerPorCanal, useInterno } from "@/lib/interno-bridge";
import { activeTenantId } from "@/lib/tenants/active";
import { veModuloVoz } from "@/lib/tenants/voz";
import { veTickets } from "@/lib/tickets-tenant";
import { staff, ME } from "@/lib/data/seed";
import { Avatar, inicialesDe } from "@/components/ui/Avatar";
import { useYo, useYoNombre } from "@/lib/yo";
import { ClienteSwitcher } from "./ClienteSwitcher";
import { Brand } from "./Brand";
import { RoleSwitcher } from "./RoleSwitcher";
import { CambiarClave } from "./CambiarClave";
import { Reloj } from "./Reloj";

interface NavItem {
  id: ModuleId;
  href: string;
  label: string;
  Icon: LucideIcon;
}

const NAV: NavItem[] = [
  { id: "bandeja", href: "/", label: "Bandeja", Icon: Inbox },
  { id: "mis-chats", href: "/mis-chats", label: "Mis chats", Icon: BotOff },
  { id: "tickets", href: "/tickets", label: "Tickets", Icon: TicketCheck },
  { id: "hoy", href: "/hoy", label: "Hoy", Icon: ConciergeBell },
  { id: "contactos", href: "/contactos", label: "Contactos", Icon: Contact },
  { id: "habitaciones", href: "/habitaciones", label: "Habitaciones", Icon: BedDouble },
  { id: "calendario", href: "/calendario", label: "Calendario", Icon: CalendarDays },
  { id: "pipeline", href: "/pipeline", label: "Pipeline", Icon: Filter },
  { id: "visitas", href: "/visitas", label: "Visitas", Icon: CalendarClock },
  { id: "cartera", href: "/cartera", label: "Cartera", Icon: Building2 },
  { id: "publicacion", href: "/publicacion", label: "Publicación", Icon: Share2 },
  { id: "cobros", href: "/cobros", label: "Cartera de mora", Icon: HandCoins },
  { id: "campanas", href: "/campanas", label: "Campañas", Icon: PhoneOutgoing },
  { id: "interno", href: "/interno", label: "Chat interno", Icon: MessagesSquare },
  { id: "redes", href: "/redes", label: "Redes sociales", Icon: Megaphone },
  { id: "comentarios", href: "/comentarios", label: "Comentarios", Icon: MsgSq },
  { id: "promociones", href: "/promociones", label: "Promociones", Icon: BadgePercent },
  { id: "perfil", href: "/perfil", label: "Perfil del agente", Icon: IdCard },
  { id: "sofia", href: "/sofia", label: "Probar a Sofía", Icon: Bot },
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
  // Quien entró: su ficha si la tiene (Verónica, Olga, Jaime), y su nombre de
  // la sesión aunque no tenga ficha (cuenta de la agencia). Antes el pie decía
  // siempre "Gerente de Marketing", la ficha genérica del tenant.
  const yoId = useYo();
  const nombreSesion = useYoNombre();
  const ficha = staff.find((s) => s.id === yoId) ?? staff.find((s) => s.id === ME)!;
  const yo = nombreSesion
    ? { nombre: nombreSesion, iniciales: inicialesDe(nombreSesion) }
    : { nombre: ficha.nombre, iniciales: ficha.iniciales };

  // "llamadas" y "agentes" los ve quien tiene voz contratada: la agencia
  // (miagentia) con la cuenta completa y sus costos, y cada cliente con su
  // agente y su vista por plan. Un tenant sin agente declarado no ve el modulo.
  // "hoy", "habitaciones" y "calendario" se apoyan en el sistema de reservas del
  // hotel: solo el hotel.
  // "pipeline", "visitas", "cartera" y "publicacion" son el tablero del agente
  // inmobiliario: solo la inmobiliaria.
  // "cobros" y "campanas" son la cartera en mora y el marcador por lotes del
  // banco: solo Promerica.
  const tenant = activeTenantId();
  const veLlamadas = veModuloVoz(tenant);
  const veAgentes = veLlamadas;
  const veHotel = tenant === "hotel";
  const veInmobiliaria = tenant === "inmobiliaria";
  const veCobros = tenant === "promerica";
  // "promociones" y "perfil" son el tablero con el que Yali maneja a su agente:
  // lo que enciende en Promociones es lo único que el agente puede ofrecer, y
  // Perfil le muestra en cuatro tarjetas cómo está configurado.
  const veYali = tenant === "yaly";
  // "tickets" es el tablero de casos que el agente no resuelve solo. Que
  // clientes lo tienen, y con que tipos y areas, vive en lib/tickets-tenant.
  const tieneTickets = veTickets(tenant);
  // El banco es un centro de COBRANZA: no publica en redes. Recibe mensajes de
  // Instagram y Facebook (eso sigue en la bandeja), pero no programa contenido.
  const veRedes = tenant !== "promerica";
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
      (item.id !== "publicacion" || veInmobiliaria) &&
      (item.id !== "cobros" || veCobros) &&
      (item.id !== "campanas" || veCobros) &&
      (item.id !== "redes" || veRedes) &&
      (item.id !== "comentarios" || veRedes) &&
      (item.id !== "mis-chats" || veYali) &&
      (item.id !== "tickets" || tieneTickets) &&
      (item.id !== "promociones" || veYali) &&
      (item.id !== "perfil" || veYali) &&
      (item.id !== "sofia" || veYali),
  );

  // Los avisos del menu: lo que espera respuesta en cada modulo.
  //
  // Sin esto hay que entrar a mirar si paso algo, y en un turno de trabajo eso
  // significa que un mensaje puede quedarse horas sin que nadie se entere.
  const { state } = useStore();
  const { estado: interno } = useInterno();
  const pendientes: Partial<Record<ModuleId, number>> = {
    "mis-chats": state.conversations
      .filter((c) => c.asignadoA === ficha.id && c.noLeidos > 0)
      .reduce((n, c) => n + c.noLeidos, 0),
    interno: Object.values(sinLeerPorCanal(interno)).reduce((n, x) => n + x, 0),
  };

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

      {/* min-h-0 + scroll: con diez modulos en el menu y un monitor bajo, el
          menu crecia hasta empujar fuera de pantalla el "Ver como" y el boton
          de cerrar sesion, que viven al pie. Ahora scrollea el menu y el pie
          se queda clavado. */}
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
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
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {(pendientes[id] ?? 0) > 0 && (
                <span
                  className={cn(
                    "flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold",
                    active ? "bg-white/25 text-white" : "bg-[#dc2626] text-white",
                  )}
                >
                  {(pendientes[id] ?? 0) > 9 ? "9+" : pendientes[id]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-line p-3">
        <CambiarClave />
        <ClienteSwitcher />
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
