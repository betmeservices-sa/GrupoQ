// El tenant del Centro Médico San Benito y su módulo clínico.
//
// Lo que se cuida acá no es la pantalla, es lo que se rompería sin ruido: que
// la contraseña nueva no le robe el dashboard a otro cliente, que un examen que
// nadie pidió no termine en el récord de alguien, y que la fila cuente bien a
// quién le toca (un "sos el 4" equivocado se descubre con la sala llena).
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_LOGINS, TENANTS, isTenantId, resolveTenantByLogin } from "@/lib/tenants";
import { MODULOS_CLINICA, VE, moduloDeRuta, puedeVerRuta } from "@/lib/modulos";
import { agrupar, esExamen, preparacion } from "@/lib/consultorio/examenes";
import {
  abrirTurno,
  cerrarTurno,
  crearTurno,
  cuantosDelante,
  doctorPorCodigo,
  documentosDePacientes,
  guardarDocumento,
  listarDoctores,
  listarSucursales,
  pacientesPorCorreo,
  registrarPaciente,
  sucursalPorCodigo,
  turnoPorCodigo,
  turnosDe,
} from "@/lib/consultorio/almacen";
import { resumenDeHoy, valorDe } from "@/lib/consultorio/estadisticas";
import { armarPortal, demasiados, normalizarCorreo, patronExacto } from "@/lib/consultorio/portal";
import { armarCorreo } from "@/lib/consultorio/correo";
import type { Documento } from "@/lib/consultorio/tipos";

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

  it("cada pantalla de la clínica está en la lista que la esconde a los demás", () => {
    // Sin esto, un módulo nuevo de la clínica sale en el menú de todos los
    // clientes: pasó con jefatura, imagenología y la bandeja de muestra.
    for (const ruta of ["/consultorio", "/laboratorio", "/laboratorio/jefatura", "/imagenologia", "/imagenologia/procesos", "/mensajes"]) {
      expect(MODULOS_CLINICA).toContain(moduloDeRuta(ruta));
    }
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
    expect(esExamen("e01001")).toBe(true);
    expect(esExamen("polvo_de_hadas")).toBe(false);
  });

  it("agrupa por área para que la hoja se lea como se piensa", () => {
    const grupos = agrupar(["e03001", "e01001"]);
    expect(grupos.map((g) => g.area)).toEqual(["Hematología", "Química sanguínea"]);
  });

  it("con dos ayunos distintos manda el más largo", () => {
    const avisos = preparacion(["e03001", "e01001"]);
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
    const a = await tomar("Ana", ["e01001"]);
    const b = await tomar("Beto", ["e03001"]);
    expect([a.numero, b.numero]).toEqual([1, 2]);
  });

  it("cuenta solo a los que siguen esperando delante de uno", async () => {
    await tomar("Ana", ["e01001"]);
    await tomar("Beto", ["e03001"]);
    const c = await tomar("Carla", ["e02001"]);
    expect(await cuantosDelante(c)).toBe(2);

    // A la primera la pasan al mostrador: deja de estorbar en la cuenta.
    const fila = await turnosDe(SUCURSAL);
    await abrirTurno(fila[0].id);
    expect(await cuantosDelante(c)).toBe(1);
  });

  it("abrir el récord arranca el cronómetro", async () => {
    const a = await tomar("Ana", ["e01001"]);
    const abierto = await abrirTurno(a.id);
    expect(abierto?.estado).toBe("atendiendo");
    expect(abierto?.abierto).not.toBeNull();
  });

  it("abrir a otro le para el reloj al anterior y lo devuelve a la fila", async () => {
    const a = await tomar("Ana", ["e01001"]);
    const b = await tomar("Beto", ["e03001"]);
    await abrirTurno(a.id);
    await abrirTurno(b.id);
    const fila = await turnosDe(SUCURSAL);
    const ana = fila.find((t) => t.nombre === "Ana")!;
    expect(ana.estado).toBe("esperando");
    expect(ana.abierto).toBeNull();
  });

  it("continuar deja pendiente lo que no se hizo, finalizar cierra", async () => {
    const a = await tomar("Ana", ["e01001", "e03001", "e02001"]);
    await abrirTurno(a.id);
    const seguido = await cerrarTurno(a.id, ["e01001", "e03001"], false, null);
    expect(seguido?.estado).toBe("pendiente");
    expect(seguido?.hechos).toEqual(["e01001", "e03001"]);
    expect(seguido?.abierto).toBeNull();

    await abrirTurno(a.id);
    const cerrado = await cerrarTurno(a.id, ["e01001", "e03001", "e02001"], true, 46);
    expect(cerrado?.estado).toBe("atendido");
    expect(cerrado?.hechos).toHaveLength(3);
  });

  it("no se puede marcar como hecho un examen que la persona no pidió", async () => {
    const a = await tomar("Ana", ["e01001"]);
    await abrirTurno(a.id);
    const cerrado = await cerrarTurno(a.id, ["e01001", "e02001", "polvo_de_hadas"], true, 12);
    expect(cerrado?.hechos).toEqual(["e01001"]);
  });

  it("la fila de una sucursal no se mezcla con la de la otra", async () => {
    await tomar("Ana", ["e01001"]);
    const otra = await crearTurno({
      sucursalId: "suc_santa_tecla",
      nombre: "Beto",
      telefono: "70000001",
      correo: "",
      examenes: ["e03001"],
    });
    expect(otra.numero).toBe(1);
    expect((await turnosDe(SUCURSAL)).map((t) => t.nombre)).toEqual(["Ana"]);
  });
});

describe("la facturación del mostrador", () => {
  const tomar = (nombre: string, examenes: string[]) =>
    crearTurno({ sucursalId: SUCURSAL, nombre, telefono: "70000000", correo: "", examenes });

  it("cada visita trae su propio código, con la forma ABCDE-123456", async () => {
    const a = await tomar("Ana", ["e01001"]);
    const b = await tomar("Beto", ["e03001"]);
    expect(a.codigo).toMatch(/^[A-Z]{5}-\d{6}$/);
    expect(a.codigo).not.toBe(b.codigo);
  });

  it("con el código se encuentra a quien lo enseña en el mostrador", async () => {
    const a = await tomar("Ana", ["e01001"]);
    expect((await turnoPorCodigo(SUCURSAL, a.codigo.toLowerCase()))?.id).toBe(a.id);
    expect(await turnoPorCodigo(SUCURSAL, "ZZZZZ-000000")).toBeNull();
    // El código de una sucursal no abre el récord en la otra.
    expect(await turnoPorCodigo("suc_santa_tecla", a.codigo)).toBeNull();
  });

  it("finalizar emite factura y guarda el monto", async () => {
    const a = await tomar("Ana", ["e01001", "e03001"]);
    await abrirTurno(a.id);
    const cerrado = await cerrarTurno(a.id, ["e01001", "e03001"], true, 18.5);
    expect(cerrado?.monto).toBe(18.5);
    expect(cerrado?.factura).toMatch(/^ES-\d{6}-001$/);
  });

  it("el correlativo corre por sucursal y no se repite", async () => {
    const a = await tomar("Ana", ["e01001"]);
    const b = await tomar("Beto", ["e03001"]);
    await abrirTurno(a.id);
    const uno = await cerrarTurno(a.id, ["e01001"], true, 12);
    await abrirTurno(b.id);
    const dos = await cerrarTurno(b.id, ["e03001"], true, 6);
    expect(uno?.factura).toMatch(/-001$/);
    expect(dos?.factura).toMatch(/-002$/);

    const otra = await crearTurno({
      sucursalId: "suc_santa_tecla",
      nombre: "Caro",
      telefono: "70000001",
      correo: "",
      examenes: ["e02001"],
    });
    await abrirTurno(otra.id);
    const tres = await cerrarTurno(otra.id, ["e02001"], true, 8);
    expect(tres?.factura).toMatch(/^ST-\d{6}-001$/);
  });

  it("continuar no factura: lo que falta también se cobra", async () => {
    const a = await tomar("Ana", ["e01001", "e03001"]);
    await abrirTurno(a.id);
    const seguido = await cerrarTurno(a.id, ["e01001"], false, 12);
    expect(seguido?.factura).toBeNull();
    expect(seguido?.monto).toBe(12);
  });

  it("una visita ya facturada conserva su número si se vuelve a abrir", async () => {
    const a = await tomar("Ana", ["e01001"]);
    await abrirTurno(a.id);
    const primera = await cerrarTurno(a.id, ["e01001"], true, 12);
    await abrirTurno(a.id);
    const otra = await cerrarTurno(a.id, ["e01001"], true, 15);
    expect(otra?.factura).toBe(primera?.factura);
    expect(otra?.monto).toBe(15);
  });

  it("el catálogo propone un precio, pero manda lo que cobró recepción", async () => {
    const a = await tomar("Ana", ["e01001", "e03001"]);
    // Los dos precios son los de la lista del laboratorio: hemograma 8.20 y
    // glucosa 6.40. Si alguien los cambia sin querer, esta prueba lo canta.
    expect(valorDe(a.examenes)).toBe(14.6);
    await abrirTurno(a.id);
    await cerrarTurno(a.id, ["e01001", "e03001"], true, 15);
    const resumen = resumenDeHoy(await turnosDe(SUCURSAL));
    expect(resumen.ingresos).toBe(15);
  });
});

// El portal donde el paciente entra con su correo. Lo que se cuida es la línea
// entre lo propio y lo ajeno: que un correo parecido no abra otro expediente,
// que no salga el teléfono de nadie, y que cada orden traiga el código que
// abre la orden en el mostrador.
describe("el portal del paciente", () => {
  const paciente = (doctorId: string, nombre: string, telefono: string, correo: string) =>
    registrarPaciente({
      doctorId,
      nombre,
      telefono,
      correo,
      nacimiento: null,
      sexo: null,
      motivo: "",
      alergias: "",
    }).then((r) => r.paciente);

  const receta = (pacienteId: string, fecha: string): Documento => ({
    id: `doc_r_${pacienteId}_${fecha}`,
    tipo: "receta",
    pacienteId,
    doctorId: "dr_moran",
    fecha,
    codigo: "RECET-000001",
    medicamentos: [
      { nombre: "Metformina 850 mg", dosis: "1 tableta", frecuencia: "cada 12 horas", duracion: "30 días" },
    ],
    indicaciones: "Tomar con comida",
    enviado: null,
  });

  const orden = (
    pacienteId: string,
    fecha: string,
    tipo: "orden" | "imagen",
    examenes: string[],
    lados?: Record<string, "der" | "izq" | "ambos">,
  ): Documento => ({
    id: `doc_${tipo}_${pacienteId}_${fecha}`,
    tipo,
    pacienteId,
    doctorId: "dr_rivas",
    fecha,
    codigo: tipo === "orden" ? "LABOR-123456" : "IMAGE-654321",
    examenes,
    lados,
    diagnostico: "Control de diabetes",
    indicaciones: "",
    enviado: null,
  });

  it("el correo se compara sin espacios ni mayúsculas", () => {
    expect(normalizarCorreo("  Marta.Guzman@Gmail.com ")).toBe("marta.guzman@gmail.com");
    expect(normalizarCorreo("martagmail.com")).toBeNull();
    expect(normalizarCorreo("")).toBeNull();
  });

  it("un guion bajo en el correo no se vuelve comodín", () => {
    expect(patronExacto("ana_p%@x.com")).toBe("ana\\_p\\%@x.com");
  });

  it("junta los expedientes del mismo correo con cualquier doctor, y solo esos", async () => {
    await paciente("dr_moran", "Marta Guzmán", "70000001", "Marta.Guzman@gmail.com");
    await paciente("dr_rivas", "Marta Guzmán", "70000001", "marta.guzman@gmail.com");
    await paciente("dr_moran", "Ana Pérez", "70000002", "ana_p@gmail.com");
    await paciente("dr_moran", "Anax Pérez", "70000003", "anaxp@gmail.com");

    expect(await pacientesPorCorreo("MARTA.GUZMAN@gmail.com ")).toHaveLength(2);
    expect((await pacientesPorCorreo("ana_p@gmail.com")).map((p) => p.nombre)).toEqual(["Ana Pérez"]);
    expect(await pacientesPorCorreo("nadie@gmail.com")).toEqual([]);
    expect(await pacientesPorCorreo("no es correo")).toEqual([]);
  });

  it("trae solo lo que se les dejó a esas personas", async () => {
    const marta = await paciente("dr_moran", "Marta", "70000001", "marta@gmail.com");
    const otra = await paciente("dr_moran", "Otra", "70000009", "otra@gmail.com");
    await guardarDocumento(receta(marta.id, "2026-09-10T15:00:00.000Z"));
    await guardarDocumento(receta(otra.id, "2026-09-11T15:00:00.000Z"));
    const docs = await documentosDePacientes([marta.id]);
    expect(docs.map((d) => d.pacienteId)).toEqual([marta.id]);
  });

  it("separa por lo que es, lo más reciente primero, y cada orden con su código y su lugar", async () => {
    const marta = await paciente("dr_moran", "Marta Elena Guzmán", "70000001", "marta@gmail.com");
    const portal = armarPortal(
      [marta],
      [
        receta(marta.id, "2026-09-01T15:00:00.000Z"),
        orden(marta.id, "2026-09-05T15:00:00.000Z", "orden", ["e01001", "e03001"]),
        orden(marta.id, "2026-09-03T15:00:00.000Z", "imagen", ["rx104"], { rx104: "der" }),
      ],
      listarDoctores(),
      listarSucursales(),
    );

    expect(portal.nombre).toBe("Marta Elena Guzmán");
    expect(portal.varias).toBe(false);
    expect(portal.secciones.map((s) => [s.id, s.cantidad])).toEqual([
      ["receta", 1],
      ["orden", 1],
      ["imagen", 1],
    ]);
    expect(portal.documentos.map((d) => d.tipo)).toEqual(["orden", "imagen", "receta"]);

    const [lab, img] = portal.documentos;
    if (lab.tipo === "receta" || img.tipo === "receta") throw new Error("esperaba dos órdenes");
    expect(lab.codigo).toBe("LABOR-123456");
    expect(lab.preparacion).toContain("ayuno de 8 horas");
    // La orden de laboratorio se hace en las dos sedes del laboratorio, no en
    // imagenología; y el estudio con lado lo dice pegado al nombre.
    expect(lab.lugares.map((l) => l.nombre)).toEqual(["Laboratorio Escalón", "Laboratorio Santa Tecla"]);
    expect(img.grupos.flatMap((g) => g.estudios)).toEqual(["Conductos auditivos (der)"]);
    expect(img.lugares.map((l) => l.nombre)).toEqual(["Unidad de Imagenología"]);
  });

  it("no entrega el teléfono de nadie ni el diagnóstico", async () => {
    const marta = await paciente("dr_moran", "Marta", "70001234", "marta@gmail.com");
    const portal = armarPortal(
      [marta],
      [orden(marta.id, "2026-09-05T15:00:00.000Z", "orden", ["e01001"])],
      listarDoctores(),
      listarSucursales(),
    );
    const json = JSON.stringify(portal);
    expect(json).not.toContain("70001234");
    expect(json).not.toContain("Control de diabetes");
  });

  it("con dos personas bajo el mismo correo, cada documento dice para quién es", async () => {
    const mama = await paciente("dr_moran", "Silvia Menjívar", "70000010", "familia@gmail.com");
    const hijo = await paciente("dr_rivas", "Nelson Cruz", "70000011", "familia@gmail.com");
    const portal = armarPortal(
      [mama, hijo],
      [receta(mama.id, "2026-09-01T15:00:00.000Z"), receta(hijo.id, "2026-09-02T15:00:00.000Z")],
      listarDoctores(),
      listarSucursales(),
    );
    expect(portal.varias).toBe(true);
    expect(portal.documentos.map((d) => d.paciente)).toEqual(["Nelson Cruz", "Silvia Menjívar"]);
  });

  it("registrado pero sin nada todavía: entra y no hay secciones", async () => {
    const nuevo = await paciente("dr_moran", "Nuevo", "70000020", "nuevo@gmail.com");
    const portal = armarPortal([nuevo], [], listarDoctores(), listarSucursales());
    expect(portal.nombre).toBe("Nuevo");
    expect(portal.secciones).toEqual([]);
  });

  it("frena a quien prueba correos en bucle", () => {
    const golpes = new Map<string, number[]>();
    for (let i = 0; i < 12; i++) expect(demasiados(golpes, "1.2.3.4", 1000 + i)).toBe(false);
    expect(demasiados(golpes, "1.2.3.4", 1100)).toBe(true);
    // Otra IP no paga por la primera, y pasada la ventana se vuelve a poder.
    expect(demasiados(golpes, "5.6.7.8", 1100)).toBe(false);
    expect(demasiados(golpes, "1.2.3.4", 1100 + 10 * 60_000 + 1)).toBe(false);
  });

  it("es público: ningún rol lo cierra", () => {
    expect(moduloDeRuta("/portal")).toBeNull();
    expect(puedeVerRuta("recepcion", "/portal")).toBe(true);
  });

  it("el correo lleva la dirección del portal para el día que se pierda", async () => {
    const marta = await paciente("dr_moran", "Marta", "70000001", "marta@gmail.com");
    const doc = orden(marta.id, "2026-09-05T15:00:00.000Z", "orden", ["e01001"]);
    const dr = listarDoctores()[1];
    const correo = armarCorreo(doc, marta, dr, "https://demo.miagentia.com/portal");
    expect(correo.texto).toContain("https://demo.miagentia.com/portal");
    expect(correo.html).toContain('href="https://demo.miagentia.com/portal"');
    // Sin portal el correo sale como antes.
    expect(armarCorreo(doc, marta, dr).texto).not.toContain("/portal");
  });
});
