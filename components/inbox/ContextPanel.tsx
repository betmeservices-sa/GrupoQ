"use client";

import { Phone, AtSign, StickyNote, Building2, UserCheck, Activity, X } from "lucide-react";
import { departments, staff } from "@/lib/data/seed";
import { depto } from "@/lib/format";
import { telefonoBonito } from "@/lib/phone";
import { Avatar, inicialesDe } from "@/components/ui/Avatar";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { VentanaIndicator } from "./VentanaIndicator";
import type {
  Contact,
  Conversation,
  ConversationStatus,
  DepartmentId,
} from "@/lib/data/types";

const ESTADOS: { id: ConversationStatus; label: string }[] = [
  { id: "nuevo", label: "Nuevo" },
  { id: "en_progreso", label: "En progreso" },
  { id: "resuelto", label: "Resuelto" },
];

export function ContextPanel({
  conversation,
  contact,
  onAsignar,
  onEstado,
  onDepartamento,
  onClose,
  ultimoEntranteTs,
}: {
  conversation: Conversation;
  contact: Contact;
  onAsignar: (staffId: string) => void;
  onEstado: (estado: ConversationStatus) => void;
  onDepartamento: (deptId: DepartmentId) => void;
  onClose?: () => void;
  ultimoEntranteTs?: string;
}) {
  const d = depto(conversation.departamento);

  return (
    <aside className="relative flex h-full w-full shrink-0 flex-col gap-4 overflow-y-auto border-l border-line bg-card px-4 py-5 lg:w-72">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-[#94a3b4] hover:bg-surface lg:hidden"
        >
          <X size={18} />
        </button>
      )}
      <div className="flex flex-col items-center text-center">
        <Avatar iniciales={inicialesDe(contact.nombre)} size={64} color={d.color} />
        <p className="mt-2.5 text-[15px] font-bold text-[#0f1b2d]">{contact.nombre}</p>
        <div className="mt-1">
          <ChannelBadge channel={contact.canal} showLabel />
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-surface/60 p-3 text-[13px]">
        {contact.telefono && (
          <Row Icon={Phone} label={telefonoBonito(contact.telefono)} />
        )}
        {contact.handle && <Row Icon={AtSign} label={contact.handle} />}
        {contact.notas && <Row Icon={StickyNote} label={contact.notas} multiline />}
      </div>

      <VentanaIndicator
        ultimoEntranteTs={ultimoEntranteTs}
        visible={contact.canal === "whatsapp"}
      />

      <Field Icon={UserCheck} label="Asignar a">
        <select
          value={conversation.asignadoA ?? ""}
          onChange={(e) => onAsignar(e.target.value)}
          className="w-full cursor-pointer rounded-lg border border-line bg-white px-2.5 py-2 text-[13px] font-medium text-[#0f1b2d] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        >
          <option value="" disabled>
            Sin asignar
          </option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </Field>

      <Field Icon={Activity} label="Estado">
        <div className="flex gap-1.5">
          {ESTADOS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onEstado(e.id)}
              className={
                "flex-1 rounded-lg px-1.5 py-1.5 text-[11.5px] font-semibold transition " +
                (conversation.estado === e.id
                  ? "bg-brand text-white"
                  : "bg-surface text-[#5b6b80] hover:bg-surface-2")
              }
            >
              {e.label}
            </button>
          ))}
        </div>
      </Field>

      <Field Icon={Building2} label="Departamento">
        <select
          value={conversation.departamento}
          onChange={(e) => onDepartamento(e.target.value as DepartmentId)}
          className="w-full cursor-pointer rounded-lg border border-line bg-white px-2.5 py-2 text-[13px] font-medium text-[#0f1b2d] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        >
          {departments.map((dep) => (
            <option key={dep.id} value={dep.id}>
              {dep.nombre}
            </option>
          ))}
        </select>
      </Field>
    </aside>
  );
}

function Row({
  Icon,
  label,
  multiline,
}: {
  Icon: typeof Phone;
  label: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-[#5b6b80]">
      <Icon size={15} className="mt-0.5 shrink-0 text-[#94a3b4]" />
      <span className={multiline ? "leading-relaxed" : "truncate"}>{label}</span>
    </div>
  );
}

function Field({
  Icon,
  label,
  children,
}: {
  Icon: typeof Phone;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b4]">
        <Icon size={13} />
        {label}
      </p>
      {children}
    </div>
  );
}
