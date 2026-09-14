import { notFound } from "next/navigation";
import { esDeLaClinica } from "@/lib/consultorio/guardia";
import { TENANTS } from "@/lib/tenants";
import { Bandeja, type ChatDemo } from "@/components/consultorio/Bandeja";
import { Encabezado } from "@/components/consultorio/Encabezado";

export const dynamic = "force-dynamic";

// La bandeja de muestra de la clínica.
//
// Sale de la semilla del propio cliente (lib/tenants/seeds/consultorio.ts), que
// es la misma gente que aparece en el resto del demo: quien pregunta por su
// ayuno en WhatsApp es la que está en la lista de la doctora. Que sean los
// mismos nombres no es casualidad, es lo que hace que el demo se sostenga.
export default async function PaginaMensajes() {
  if (!(await esDeLaClinica())) notFound();

  const { seed, labels } = TENANTS.consultorio;
  const nombreDe = (id?: string) =>
    id === "ia"
      ? `${TENANTS.consultorio.ai?.nombre ?? "Asistente"} (IA)`
      : (seed.staff.find((s) => s.id === id)?.nombre ?? "Equipo");

  const chats: ChatDemo[] = seed.conversations.map((c) => {
    const contacto = seed.contacts.find((x) => x.id === c.contactId);
    return {
      id: c.id,
      nombre: contacto?.nombre ?? "Sin nombre",
      canal: c.canal as ChatDemo["canal"],
      departamento: seed.departments.find((d) => d.id === c.departamento)?.nombre ?? "",
      estado: c.estado,
      noLeidos: c.noLeidos,
      ultimo: c.ultimoMensajeTs,
      mensajes: seed.messages
        .filter((m) => m.conversationId === c.id)
        .map((m) => ({
          id: m.id,
          autor: m.autor,
          quien: m.autor === "cliente" ? (contacto?.nombre ?? "") : nombreDe(m.staffId),
          texto: m.texto,
          ts: m.ts,
        })),
    };
  });

  const sinLeer = chats.reduce((n, c) => n + c.noLeidos, 0);

  return (
    <div className="cons flex min-h-0 flex-1 flex-col">
      <Encabezado
        titulo="Bandeja"
        detalle={`${chats.length} conversaciones de ${labels.contactoPlural}${
          sinLeer > 0 ? ` · ${sinLeer} sin leer` : ""
        }`}
      />
      <Bandeja chats={chats} />
    </div>
  );
}
