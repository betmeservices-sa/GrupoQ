/** El encabezado de cada sección del módulo: título, una línea de contexto y acciones. */
export function Encabezado({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="no-imprimir flex flex-wrap items-end justify-between gap-3 border-b border-[var(--linea)] bg-[var(--panel)] px-6 py-5">
      <div className="min-w-0">
        <h1 className="font-serif text-[24px] leading-tight text-[var(--texto)]">{titulo}</h1>
        {detalle && <p className="mt-0.5 text-[13.5px] text-[var(--texto-2)]">{detalle}</p>}
      </div>
      {children}
    </div>
  );
}
