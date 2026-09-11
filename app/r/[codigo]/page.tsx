import { doctorPorCodigo } from "@/lib/consultorio/almacen";
import { Registro } from "@/components/consultorio/Registro";

export const dynamic = "force-dynamic";

// La página que abre el paciente al escanear.
//
// Pública y sin sesión, porque quien la abre no tiene cuenta ni la va a tener.
// De quién es el paciente lo decide el CÓDIGO de la URL, no un campo del
// formulario: así nadie puede registrarse en la lista de otro doctor.
export default async function PaginaRegistro({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const doctor = doctorPorCodigo(codigo);

  if (!doctor) {
    return (
      <div className="cons cons-pagina">
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
          <div className="documento px-6 py-7 text-center">
            <h1 className="font-serif text-[23px] text-[var(--texto)]">Este código no existe</h1>
            <p className="mx-auto mt-2 max-w-[32ch] text-[15px] leading-relaxed text-[var(--texto-2)]">
              Puede que el doctor haya generado uno nuevo. Pedile que te comparta el código otra
              vez.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="cons cons-pagina">
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="documento px-6 py-7">
          <header className="membrete pb-3 text-center">
            <h1 className="font-serif text-[24px] leading-tight text-[var(--texto)]">
              {doctor.nombre}
            </h1>
            <p className="mt-0.5 text-[13px] text-[var(--texto-2)]">
              {doctor.especialidad} · {doctor.registro}
            </p>
          </header>
          <p className="mt-5 text-center font-serif text-[17px] leading-relaxed text-[var(--texto)]">
            Llená tus datos y quedás registrado en la consulta.
          </p>
          <p className="mt-1 text-center text-[13.5px] text-[var(--texto-3)]">
            Toma menos de un minuto.
          </p>
          <Registro codigo={doctor.codigo} />
        </div>
      </main>
    </div>
  );
}
