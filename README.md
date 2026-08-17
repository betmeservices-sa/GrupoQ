# Centro de Comunicación, Grupo Q

Demo realista de un **command center omnicanal interno** para Grupo Q
(distribuidor automotriz de Centroamérica). Unifica en una sola bandeja ordenada
la comunicación con clientes (WhatsApp, Instagram, Facebook) y la comunicación
interna entre áreas de la empresa.

> Demo con datos simulados. La costura `FAKE`/`REAL` permite enchufar la API de
> WhatsApp Business (Meta Cloud), Supabase y n8n sin rehacer la interfaz: con
> credenciales en `.env.local` opera en modo real, sin ellas usa datos demo.

## Módulos

- **Bandeja unificada** (`/`): WhatsApp + Instagram + Facebook en una sola lista,
  ordenada por canal, estado (Nuevo / En progreso / Resuelto), asignación
  (Mías / Sin asignar / Todas) y área. Responder, asignar y resolver en vivo.
- **Chat interno** (`/interno`): canales por área y mensajes directos.
- **Redes sociales** (`/redes`): programar y administrar publicaciones de FB e IG.
- **Dashboard** (`/dashboard`): métricas de volumen, tiempo de respuesta,
  conversaciones por área y estado, y panel de llamadas (Vapi).
- **Configuración** (`/settings`): gestor de plantillas de WhatsApp (Meta API).

## Áreas del demo

Vehículos Nuevos · Active Motors (seminuevos) · Taller de Servicio · Repuestos ·
Centro de Pintura · CrediQ (financiamiento) · Atención al Cliente.

## Detalles del demo

- **Selector de rol** (esquina inferior del sidebar): cambia entre Atención al
  Cliente, Asesor, Jefe de área, Marketing y Dirección para mostrar qué ve cada perfil.
- **Modo en vivo** (toggle en la bandeja): inyecta mensajes entrantes simulados
  cada pocos segundos para que el inbox se sienta activo durante la demostración.
- **Modo IA**: la asistente "Camila" (Claude) responde WhatsApp sola, agenda citas
  de taller y test drives con disponibilidad real vía webhooks de n8n.
- **Marca real** (variables CSS tomadas de grupoq.com): azul primario `#006cb7`,
  rojo `#a32923`, teal `#2baab1`, verde `#00c040`. Tagline "Vas a llegar"; lema
  "Servirte con pasión es la fuerza que nos mueve".

## Variables de entorno

Se copian de `.env.example` a `.env.local` (que está en `.gitignore`: ningún
valor real se commitea). Sin las de un módulo, ese módulo cae a datos demo.

| Variable | Para qué |
|---|---|
| `SESSION_SECRET` | Firma la cookie de sesión. Sin ella no entra nadie en producción. |
| `LOGIN_PASSWORDS` | Contraseñas por cliente (`tenant:clave,tenant:clave`). Si existe, manda sobre las del código. |
| `ANTHROPIC_API_KEY` | Respuestas de la IA. |
| `WHATSAPP_*` | WhatsApp Cloud API (recibir, responder, plantillas). |
| `META_*` | Conectar Facebook e Instagram por OAuth. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Persistencia de mensajes de WhatsApp. |
| `VAPI_PRIVATE_KEY` | Módulo de llamadas. |
| `CLOUDBEDS_API_KEY` | Sistema de reservas del hotel (Cloudbeds), **solo lectura**. |
| `CLOUDBEDS_PROPERTY_ID` | Id de la propiedad del hotel en ese sistema. |
| `VAPI_WEBHOOK_SECRET` | Secreto compartido del webhook de cobros. **Sin ella el webhook queda cerrado**: es una ruta publica y sin secreto cualquiera podria inventar llamadas. |
| `COBROS_AI_MODEL` | Modelo que lee los transcripts de cobranza. Por defecto `claude-opus-5`; para una base grande donde manda el costo por llamada, `claude-haiku-4-5`. |
| `COBROS_IA_EN_SIMULACION` | `1` hace que las llamadas simuladas tambien pasen por el modelo, para probar el analisis sin telefonia. Cuesta dinero por llamada simulada. |

Ninguna lleva prefijo `NEXT_PUBLIC_`: todas se leen en el servidor y no pueden
terminar en el bundle del navegador.

### Cliente "hotel" y su sistema de reservas

El tenant del hotel lee ocupación, tarifas y reservas en vivo con la API de
Cloudbeds (v1.3), **siempre de solo lectura**: `lib/cloudbeds.ts` tiene una lista
blanca de endpoints `get*`, fija `method: "GET"` y expone `PMS_WRITE_ENABLED =
false`. Escribir ahí sincronizaría con el channel manager y bloquearía
inventario real del hotel en los canales de venta.

Cuando el agente cierra una reserva, se guarda como **simulada** en
`lib/hotel-reservas.ts` y el panel la pinta aparte de las reales. La llave del
sistema de reservas caduca si pasan 30 días sin usarse.

### Cliente "promerica" — cobranza con agente de voz

Banco Promerica es el primer tenant cuyo centro no es la bandeja sino la
**cartera en mora**. Entra con `demoagentia` / `miagentiacobros` y suma tres
piezas que los demas clientes no tienen:

- **Cartera de mora** (`/cobros`): las cuentas atrasadas con su tramo (1-30,
  31-60, 61-90, +90), promesas de pago vigentes y vencidas, y la ficha de cada
  cliente con su historial de gestion y la transcripcion de cada llamada.
- **Campanas** (`/campanas`): marcado por lotes. Se sube un archivo de contactos
  (CSV, hasta 20,000) o se filtra la cartera, se elige cuantas llamadas puede
  haber vivas a la vez, y el motor mantiene ese numero: cuando una termina,
  entra la siguiente. Con horario permitido, reintentos y estimacion de cuanto
  va a tardar.
- **Agente de cobros** (Vapi): el script vive versionado en
  `lib/cobros-agente.ts` y se sube con `node scripts/crear-agente-cobros.mjs`.
  Verifica identidad antes de decir una palabra del saldo, no amenaza, no
  promete arreglos y cuelga si el cliente pide que no lo llamen.

**El ciclo completo.** Al terminar cada llamada llega el transcript (por webhook
en produccion, o consultando a Vapi mientras la pantalla esta abierta) y Claude
lo lee con **salida estructurada**: devuelve el JSON exacto de la ficha, no un
parrafo que despues haya que interpretar. Con eso la tarjeta del cliente se
mueve sola: cambia de estado, guarda la promesa con monto y fecha, anota el
riesgo, y **apaga las llamadas** si la persona pidio que no la contacten.

Dos cosas que el modulo hace a proposito:

1. **Marcar de verdad es una casilla aparte, apagada por defecto.** La cartera
   sembrada del demo lleva telefonos inventados; que basta con tener la llave de
   Vapi puesta para empezar a llamar seria la forma mas facil de cold-callear a
   cientos de personas que no tienen nada que ver. Sin esa casilla, la campana
   simula las llamadas y las fichas se mueven igual.
2. **Una llamada que no conecto no pasa por el modelo.** El resultado sale del
   motivo de corte de la telefonia. En una base de 10,000 eso es casi la mitad
   de los intentos, y es la diferencia entre una demo que se puede correr y una
   factura de IA por llamadas donde nadie contesto.

La logica pura (cola, concurrencia, ventana horaria, reintentos, lectura del
archivo, como se mueve la ficha) esta separada de la red y cubierta por tests:
`lib/__tests__/cobros-*.test.ts`.

Lo unico que los tests no pueden cubrir es la llamada al modelo. Para eso:

```bash
node scripts/probar-analisis-cobros.mjs
```

Toma una transcripcion real de la cartera semilla, la manda a Claude por el
mismo camino que usa el webhook, e imprime el JSON que devolvio y como queda la
ficha. No marca telefonos ni escribe en el almacen del demo.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · lucide-react ·
Supabase (persistencia WhatsApp) · Anthropic SDK (IA) · n8n (citas).
Estado de cliente con Context + reducer. Capa de datos en memoria detrás de la
interfaz `CommsProvider` (`lib/data/provider.ts`).

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre http://localhost:3000

En Windows, si el dev server en segundo plano falla (el shim de npm sale con 127),
lánzalo con PowerShell directamente sobre node:

```powershell
Start-Process node "node_modules\next\dist\bin\next dev" -WorkingDirectory (Get-Location)
```

## Pruebas

```bash
npm test
```

Cubren la lógica del proveedor de datos y el reducer del store (asignación,
cambio de estado, envío, mensajes entrantes).

## Estructura

```
app/                  rutas (bandeja, interno, redes, dashboard, settings) + layout
components/
  shell/              sidebar, marca, selector de rol, motor en vivo, reloj
  inbox/              lista, hilo, composer, panel de contexto, filtros
  internal/           canales y hilo del chat interno
  social/             lista y composer de publicaciones
  dashboard/          tarjetas de métrica, desgloses y llamadas
  ui/                 primitivas (badges, avatar, estados vacíos)
lib/
  data/               types, seed realista, FakeCommsProvider, motor en vivo
  store.tsx           Context + reducer (acciones de la bandeja)
  ai.ts / ai-reply.ts IA "Camila" (prompt, tools de citas, debounce)
  n8n.ts              webhooks de disponibilidad y confirmación de citas
  roles.ts            roles y permisos del demo
  format.ts           formato de fechas y lookups
```
