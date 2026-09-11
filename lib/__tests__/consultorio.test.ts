// El tenant del Centro Médico San Benito y su módulo clínico.
//
// Lo que se cuida acá no es la pantalla, es lo que se rompería sin ruido: que
// la contraseña nueva no le robe el dashboard a otro cliente, que un examen que
// nadie pidió no termine en el récord de alguien, y que la fila cuente bien a
// quién le toca (un "sos el 4" equivocado se descubre con la sala llena).
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_LOGINS, TENANTS, isTenantId, resolveTenantByLogin } from "@/lib/tenants";
import { VE, moduloDeRuta, puedeVerRuta } from "@/lib/modulos";
import { agrupar, esExamen, preparacion } from "@/lib/consultorio/examenes";
import {
  abrirTurno,
  cerrarTurno,
  crearTurno,
  cuantosDelante,
  doctorPorCodigo,
  listarDoctores,
  sucursalPorCodigo,
  turnoPorCodigo,
  turnosDe,
} from "@/lib/consultorio/almacen";
import { resumenDeHoy, valorDe } from "@/lib/consultorio/estadisticas";

const SUCURSAL = "suc_escalon";

// El almacén cae a memoria del proceso cuando no hay Supabase (que es el caso
// en las pruebas), y esa memoria cuelga de globalThis para sobrevivir al
// recargado en caliente. Se limpia antes de cada prueba para que una fila no se
// le pegue a la siguiente.
beforeEach(() => {
  (globalThis as unknown as { __consultorio?: unknown }).__consultorio = {
    pacientes: [],
    documentos: [],
    turnos: [],
  };
});

describe("tenant consultorio", () => {
  it("la contraseña demol entra a la clínica", () => {
    expect(resolveTenantByLogin("demoagentia", "demol")).toBe("consultorio");
  });

  it("no le roba la contraseña a ninguno de los otros", () => {
    expect(resolveTenantByLogin("demoagentia", "demoh")).toBe("hospital");
    expect(resolveTenantByLogin("demoagentia", "demoi")).toBe("grupoq");
    expect(resolveTenantByLogin("demoagentia", "demoj")).toBe("excel");
    expect(resolveTenantByLogin("demoagentia", "demok")).toBe("miagentia");
  });

  it("usa el mismo usuario que los demás y una sola contraseña", () => {
    const suyas = DEMO_LOGINS.filter((l) => l.tenant === "consultorio");
    expect(suyas).toHaveLength(1);
    expect(suyas[0].usuario).toBe("demoagentia");
  });

  it("está registrado como cliente de verdad", () => {
    expect(isTenantId("consultorio")).toBe(true);
    expect(TENANTS.consultorio.brand.nombre).toBe("Centro Médico San Benito");
    expect(TENANTS.consultorio.labels.contacto).toBe("paciente");
  });

  it("clasifica los mensajes con etiquetas de clínica, no de otro rubro", () => {
    expect(TENANTS.consultorio.tags).toContain("Exámenes de laboratorio");
    expect(TENANTS.consultorio.tags).not.toContain("Interés Ginecología");
  });
});

describe("quién ve el módulo clínico", () => {
  it("las dos rutas son módulos propios", () => {
    expect(moduloDeRuta("/consultorio")).toBe("consultorio");
    expect(moduloDeRuta("/consultorio/paciente/pac_1")).toBe("consultorio");
    expect(moduloDeRuta("/laboratorio")).toBe("laboratorio");
  });

  it("el médico ve su consultorio pero no el mostrador del laboratorio", () => {
    expect(puedeVerRuta("medico", "/consultorio")).toBe(true);
    expect(puedeVerRuta("medico", "/laboratorio")).toBe(false);
  });

  it("recepción mueve la fila", () => {
    expect(puedeVerRuta("recepcion", "/laboratorio")).toBe(true);
  });

  it("no le agrega módulos al rol de atención, que es de otro cliente", () => {
    expect(VE.atencion).not.toContain("consultorio");
    expect(VE.atencion).not.toContain("laboratorio");
  });
});

describe("los códigos de los QR", () => {
  it("cada doctor tiene el suyo y no se cruzan", () => {
    const codigos = listarDoctores().map((d) => d.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(doctorPorCodigo("AM4K2P")?.id).toBe("dr_moran");
    expect(doctorPorCodigo("ER7T9M")?.id).toBe("dr_rivas");
  });

  it("el código se lee sin importar cómo lo escriban", () => {
    expect(doctorPorCodigo(" am4k2p ")?.id).toBe("dr_moran");
    expect(sucursalPorCodigo("lab4es")?.id).toBe("suc_escalon");
  });

  it("un código inventado no cae en nadie", () => {
    expect(doctorPorCodigo("XXXXXX")).toBeNull();
    expect(sucursalPorCodigo("XXXXXX")).toBeNull();
  });
});

describe("el catálogo de exámenes", () => {
  it("solo existe lo que está en la lista", () => {
    expect(esExamen("hemograma")).toBe(true);
    expect(esExamen("polvo_de_hadas")).toBe(false);
  });

  it("agrupa por área para que la hoja se lea como se piensa", () => {
    const grupos = agrupar(["glucosa", "hemograma"]);
    expect(grupos.map((g) => g.area)).toEqual(["Hematología", "Química sanguínea"]);
  });

  it("con dos ayunos distintos manda el más largo", () => {
    const avisos = preparacion(["glucosa", "hemograma"]);
    expect(avisos.join(" ")).toMatch(/ayuno de 8 horas/);
    expect(avisos.filter((a) => a.includes("ayuno"))).toHaveLength(1);
  });
});

describe("la fila del laboratorio", () => {
  const tomar = (nombre: string, examenes: string[]) =>
    crearTurno({
      sucursalId: SUCURSAL,
      nombre,
      telefono: "70000000",
      correo: "",
      examenes,
    });

  it("numera por sucursal empezando en 1", async () => {
    const a = await tomar("Ana", ["hemograma"]);
    const b = await tomar("Beto", ["glucosa"]);
    expect([a.numero, b.numero]).toEqual([1, 2]);
  });

  it("cuenta solo a los que siguen esperando delante de uno", async () => {
    await tomar("Ana", ["hemograma"]);
    await tomar("Beto", ["glucosa"]);
    const c = await tomar("Carla", ["tipeo"]);
    expect(await cuantosDelante(c)).toBe(2);

    // A la primera la pasan al mostrador: deja de estorbar en la cuenta.
    const fila = await turnosDe(SUCURSAL);
    await abrirTurno(fila[0].id);
    expect(await cuantosDelante(c)).toBe(1);
  });

  it("abrir el récord arranca el cronómetro", async () => {
    const a = await tomar("Ana", ["hemograma"]);
    const abierto = await abrirTurno(a.id);
    expect(abierto?.estado).toBe("atendiendo");
    expect(abierto?.abierto).not.toBeNull();
  });

  it("abrir a otro le para el reloj al anterior y lo devuelve a la fila", async () => {
    const a = await tomar("Ana", ["hemograma"]);
    const b = await tomar("Beto", ["glucosa"]);
    await abrirTurno(a.id);
    await abrirTurno(b.id);
    const fila = await turnosDe(SUCURSAL);
    const ana = fila.find((t) => t.nombre === "Ana")!;
    expect(ana.estado).toBe("esperando");
    expect(ana.abierto).toBeNull();
  });

  it("continuar deja pendiente lo que no se hizo, finalizar cierra", async () => {
    const a = await tomar("Ana", ["hemograma", "glucosa", "tipeo"]);
    await abrirTurno(a.id);
    const seguido = await cerrarTurno(a.id, ["hemograma", "glucosa"], false, null);
    expect(seguido?.estado).toBe("pendiente");
    expect(seguido?.hechos).toEqual(["hemograma", "glucosa"]);
    expect(seguido?.abierto).toBeNull();

    await abrirTurno(a.id);
    const cerrado = await cerrarTurno(a.id, ["hemograma", "glucosa", "tipeo"], true, 46);
    expect(cerrado?.estado).toBe("atendido");
    expect(cerrado?.hechos).toHaveLength(3);
  });

  it("no se puede marcar como hecho un examen que la persona no pidió", async () => {
    const a = await tomar("Ana", ["hemograma"]);
    await abrirTurno(a.id);
    const cerrado = await cerrarTurno(a.id, ["hemograma", "tipeo", "polvo_de_hadas"], true, 12);
    expect(cerrado?.hechos).toEqual(["hemograma"]);
  });

  it("la fila de una sucursal no se mezcla con la de la otra", async () => {
    await tomar("Ana", ["hemograma"]);
    const otra = await crearTurno({
      sucursalId: "suc_santa_tecla",
      nombre: "Beto",
      telefono: "70000001",
      correo: "",
      examenes: ["glucosa"],
    });
    expect(otra.numero).toBe(1);
    expect((await turnosDe(SUCURSAL)).map((t) => t.nombre)).toEqual(["Ana"]);
  });
});

describe("la facturación del mostrador", () => {
  const tomar = (nombre: string, examenes: string[]) =>
    crearTurno({ sucursalId: SUCURSAL, nombre, telefono: "70000000", correo: "", examenes });

  it("cada visita trae su propio código, con la forma ABCDE-123456", async () => {
    const a = await tomar("Ana", ["hemograma"]);
    const b = await tomar("Beto", ["glucosa"]);
    expect(a.codigo).toMatch(/^[A-Z]{5}-\d{6}$/);
    expect(a.codigo).not.toBe(b.codigo);
  });

  it("con el código se encuentra a quien lo enseña en el mostrador", async () => {
    const a = await tomar("Ana", ["hemograma"]);
    expect((await turnoPorCodigo(SUCURSAL, a.codigo.toLowerCase()))?.id).toBe(a.id);
    expect(await turnoPorCodigo(SUCURSAL, "ZZZZZ-000000")).toBeNull();
    // El código de una sucursal no abre el récord en la otra.
    expect(await turnoPorCodigo("suc_santa_tecla", a.codigo)).toBeNull();
  });

  it("finalizar emite factura y guarda el monto", async () => {
    const a = await tomar("Ana", ["hemograma", "glucosa"]);
    await abrirTurno(a.id);
    const cerrado = await cerrarTurno(a.id, ["hemograma", "glucosa"], true, 18.5);
    expect(cerrado?.monto).toBe(18.5);
    expect(cerrado?.factura).toMatch(/^ES-\d{6}-001$/);
  });

  it("el correlativo corre por sucursal y no se repite", async () => {
    const a = await tomar("Ana", ["hemograma"]);
    const b = await tomar("Beto", ["glucosa"]);
    await abrirTurno(a.id);
    const uno = await cerrarTurno(a.id, ["hemograma"], true, 12);
    await abrirTurno(b.id);
    const dos = await cerrarTurno(b.id, ["glucosa"], true, 6);
    expect(uno?.factura).toMatch(/-001$/);
    expect(dos?.factura).toMatch(/-002$/);

    const otra = await crearTurno({
      sucursalId: "suc_santa_tecla",
      nombre: "Caro",
      telefono: "70000001",
      correo: "",
      examenes: ["tipeo"],
    });
    await abrirTurno(otra.id);
    const tres = await cerrarTurno(otra.id, ["tipeo"], true, 8);
    expect(tres?.factura).toMatch(/^ST-\d{6}-001$/);
  });

  it("continuar no factura: lo que falta también se cobra", async () => {
    const a = await tomar("Ana", ["hemograma", "glucosa"]);
    await abrirTurno(a.id);
    const seguido = await cerrarTurno(a.id, ["hemograma"], false, 12);
    expect(seguido?.factura).toBeNull();
    expect(seguido?.monto).toBe(12);
  });

  it("una visita ya facturada conserva su número si se vuelve a abrir", async () => {
    const a = await tomar("Ana", ["hemograma"]);
    await abrirTurno(a.id);
    const primera = await cerrarTurno(a.id, ["hemograma"], true, 12);
    await abrirTurno(a.id);
    const otra = await cerrarTurno(a.id, ["hemograma"], true, 15);
    expect(otra?.factura).toBe(primera?.factura);
    expect(otra?.monto).toBe(15);
  });

  it("el catálogo propone un precio, pero manda lo que cobró recepción", async () => {
    const a = await tomar("Ana", ["hemograma", "glucosa"]);
    expect(valorDe(a.examenes)).toBe(18);
    await abrirTurno(a.id);
    await cerrarTurno(a.id, ["hemograma", "glucosa"], true, 15);
    const resumen = resumenDeHoy(await turnosDe(SUCURSAL));
    expect(resumen.ingresos).toBe(15);
  });
});
