// Los archivos de la CDN de Meta se piden a través de /api/meta/media: el
// navegador no reproduce las notas de voz directo desde lookaside.fbsbx.com
// (tipo de contenido raro y sin rangos). Lo nuestro (/api/...) va tal cual.

const CDN_META = /^https:\/\/([a-z0-9-]+\.)*(fbsbx\.com|fbcdn\.net|cdninstagram\.com|facebook\.com)\//i;

export function porNuestroProxy(url: string): string {
  return CDN_META.test(url) ? `/api/meta/media?u=${encodeURIComponent(url)}` : url;
}
