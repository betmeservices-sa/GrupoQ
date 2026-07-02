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
