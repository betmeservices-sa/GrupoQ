// Estadísticas reales de las cuentas conectadas (Meta Graph API), en la misma
// forma SocialStats que usa la pestaña Redes. Cada métrica se consulta por
// separado y tolera fallos: si Meta deprecia o niega una, el resto sigue.
//
// FB (page token): followers_count/fan_count + insights days_28
//   page_impressions_unique (alcance), page_views_total (vistas),
//   page_post_engagements (interacciones), page_fan_adds (nuevos seguidores).
// IG (instagram_business_account, page token): followers_count + insights
//   reach / views / total_interactions con metric_type=total_value (30 días).

import type { SocialStats } from "./data/types";
import { GRAPH } from "./meta-oauth";
import { conexionesDe } from "./meta-store";

async function graph(
  path: string,
  params: Record<string, string>,
  token: string,
): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(
      `${GRAPH}/${path}?` + new URLSearchParams({ ...params, access_token: token }),
    );
    const j = await r.json();
    if (j.error) {
      console.warn(`[meta-stats] ${path} (${params.metric ?? params.fields ?? ""}):`, j.error.message);
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

// Suma los values de una métrica de insights de página (period days_28 trae
// el acumulado en el último value; se toma el último punto).
async function metricaPagina(pageId: string, metric: string, token: string): Promise<number> {
  const j = await graph(`${pageId}/insights`, { metric, period: "days_28" }, token);
  const data = (j?.data ?? []) as Array<{ values?: Array<{ value?: number }> }>;
  const values = data[0]?.values ?? [];
  return values.length ? Number(values[values.length - 1]?.value ?? 0) : 0;
}

// Métrica de IG con metric_type=total_value en los últimos 30 días.
async function metricaIg(igId: string, metric: string, token: string): Promise<number> {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 30 * 86400;
  const j = await graph(
    `${igId}/insights`,
    {
      metric,
      period: "day",
      metric_type: "total_value",
      since: String(since),
      until: String(until),
    },
    token,
  );
  const data = (j?.data ?? []) as Array<{ total_value?: { value?: number } }>;
  return Number(data[0]?.total_value?.value ?? 0);
}

function pct(nuevos: number, total: number): number {
  const base = total - nuevos;
  if (base <= 0) return 0;
  return Math.round((nuevos / base) * 1000) / 10;
}

// Devuelve las stats reales del tenant, o null si no tiene conexión de Meta.
export async function statsReales(tenant: string): Promise<SocialStats[] | null> {
  const conexiones = await conexionesDe(tenant);
  if (!conexiones.length) return null;
  const c = conexiones[0];
  const out: SocialStats[] = [];

  // Facebook (la página conectada)
  const page = (await graph(c.pageId, { fields: "name,followers_count,fan_count" }, c.pageToken)) as
    | { name?: string; followers_count?: number; fan_count?: number }
    | null;
  if (page) {
    const seguidores = Number(page.followers_count ?? page.fan_count ?? 0);
    const [alcance, vistas, interacciones, nuevos] = await Promise.all([
      metricaPagina(c.pageId, "page_impressions_unique", c.pageToken),
      metricaPagina(c.pageId, "page_views_total", c.pageToken),
      metricaPagina(c.pageId, "page_post_engagements", c.pageToken),
      metricaPagina(c.pageId, "page_fan_adds", c.pageToken),
    ]);
    out.push({
      red: "facebook",
      handle: page.name ?? c.pageName,
      seguidores,
      nuevosSeguidores: nuevos,
      crecimientoPct: pct(nuevos, seguidores),
      alcance30d: alcance,
      vistas30d: vistas,
      interacciones30d: interacciones,
    });
  }

  // Instagram (si la página tiene cuenta profesional vinculada)
  if (c.igId) {
    const ig = (await graph(c.igId, { fields: "username,followers_count" }, c.pageToken)) as
      | { username?: string; followers_count?: number }
      | null;
    if (ig) {
      const [alcance, vistas, interacciones, nuevos] = await Promise.all([
        metricaIg(c.igId, "reach", c.pageToken),
        metricaIg(c.igId, "views", c.pageToken),
        metricaIg(c.igId, "total_interactions", c.pageToken),
        metricaIg(c.igId, "follower_count", c.pageToken),
      ]);
      const seguidores = Number(ig.followers_count ?? 0);
      out.push({
        red: "instagram",
        handle: ig.username ? `@${ig.username}` : c.pageName,
        seguidores,
        nuevosSeguidores: nuevos,
        crecimientoPct: pct(nuevos, seguidores),
        alcance30d: alcance,
        vistas30d: vistas,
        interacciones30d: interacciones,
      });
    }
  }

  return out.length ? out : null;
}
