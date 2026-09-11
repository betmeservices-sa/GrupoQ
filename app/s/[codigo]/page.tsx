import { sucursalPorCodigo } from "@/lib/consultorio/almacen";
import { FilaSucursal } from "@/components/consultorio/FilaSucursal";

export const dynamic = "force-dynamic";

// La página que abre el paciente al escanear el QR de la entrada del
// laboratorio. Pública y sin sesión: quien llega no tiene cuenta.
export default async function PaginaSucursal({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const sucursal = sucursalPorCodigo(codigo);

  if (!sucursal) {
    return (
      <div className="cons cons-pagina">
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
          <div className="tarjeta px-6 py-7 text-center">
            <h1 className="font-serif text-[22px] text-[var(--texto)]">Este código no existe</h1>
            <p className="mx-auto mt-2 max-w-[32ch] text-[15px] leading-relaxed text-[var(--texto-2)]">
              Puede que sea de otra sucursal. Preguntá en el mostrador.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="cons cons-pagina">
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-6 text-center">
          <h1 className="font-serif text-[26px] leading-tight text-[var(--texto)]">
            {sucursal.nombre}
          </h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--texto-2)]">
            {sucursal.direccion}
          </p>
          <p className="text-[12.5px] text-[var(--texto-3)]">{sucursal.horario}</p>
        </header>
        <FilaSucursal sucursal={sucursal} />
      </main>
    </div>
  );
}
