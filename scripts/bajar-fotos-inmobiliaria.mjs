// Baja las fotos de la cartera del tenant "inmobiliaria" desde Unsplash.
//
// Uso: node scripts/bajar-fotos-inmobiliaria.mjs
// Salida: public/inmobiliaria/<codigo>-<n>.jpg (1080 x 810)
//
// Cada archivo se llama por el código de la propiedad y su posición en la ficha,
// que es el orden crudo con el que el agente subiría las fotos. La pantalla de
// publicación es la que decide después cuál abre el carrusel.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(AQUI, "..", "public", "inmobiliaria");

const FOTOS = {
  // TZ-101 Casa en Colonia Escalón, San Salvador (425,000)
  "tz-101-1": "photo-1583847268964-b28dc8f51f92",
  "tz-101-2": "photo-1600596542815-ffad4c1539a9",
  "tz-101-3": "photo-1556911220-bff31c812dba",
  "tz-101-4": "photo-1615874959474-d609969a20ed",
  // TZ-102 Apartamento en Zona Rosa, San Salvador (265,000)
  "tz-102-1": "photo-1616047006789-b7af5afb8c20",
  "tz-102-2": "photo-1600489000022-c2086d79f9d4",
  "tz-102-3": "photo-1505693416388-ac5ce068fe85",
  "tz-102-4": "photo-1580216643062-cf460548a66a",
  "tz-102-5": "photo-1580041065738-e72023775cdc",
  // TZ-103 Casa en Santa Tecla (198,000)
  "tz-103-1": "photo-1592595896616-c37162298647",
  "tz-103-2": "photo-1631679706909-1844bbd07221",
  "tz-103-3": "photo-1617228069096-4638a7ffc906",
  "tz-103-4": "photo-1594498653385-d5172c532c00",
  // TZ-104 Casa en Jardines de Merliot (172,500)
  // Sin foto de fachada: ninguna de las disponibles calzaba con la casa.
  "tz-104-1": "photo-1588854337236-6889d631faa8",
  "tz-104-2": "photo-1618221195710-dd6b41faaea6",
  "tz-104-3": "photo-1560185893-a55cbc8c57e8",
  // TZ-105 Terreno con vista al mar, La Libertad (118,000)
  "tz-105-1": "photo-1647577680781-6ed3f3cac7f9",
  "tz-105-2": "photo-1777198498621-d949c8fe4873",
  "tz-105-3": "photo-1703075858443-d8dbf98ad0ee",
  // TZ-106 Local comercial, Paseo El Carmen (245,000)
  "tz-106-1": "photo-1580554430120-94cfcb3adf25",
  "tz-106-2": "photo-1783700085825-1df197a49f40",
  "tz-106-3": "photo-1629079447777-1e605162dc8d",
  // TZ-107 Apartamento en Santa Elena (158,000)
  "tz-107-1": "photo-1600121848594-d8644e57abab",
  "tz-107-2": "photo-1595526114035-0d45ed16cfbf",
  "tz-107-3": "photo-1620626011761-996317b8d101",
  // TZ-108 Casa en Lourdes, apta FSV (76,500)
  // Sin foto de fachada: ninguna de las disponibles calzaba con la casa.
  "tz-108-1": "photo-1615800002234-05c4d488696c",
  "tz-108-2": "photo-1618221118493-9cfa1a1c00da",
  // TZ-109 Casa con jardín en Nuevo Cuscatlán (348,000)
  "tz-109-1": "photo-1512917774080-9991f1c4c750",
  "tz-109-2": "photo-1705980505348-222bc8724138",
  "tz-109-3": "photo-1560185007-cde436f6a4d0",
  "tz-109-4": "photo-1507089947368-19c1da9775ae",
  "tz-109-5": "photo-1566665797739-1674de7a421a",
  // TZ-110 Apartamento en Colonia Escalón (215,000)
  "tz-110-1": "photo-1605774337664-7a846e9cdf17",
  "tz-110-2": "photo-1588854337221-4cf9fa96059c",
  "tz-110-3": "photo-1522771739844-6a9f6d5f14af",
  "tz-110-4": "photo-1584622650111-993a426fbf0a",
  // TZ-111 Terreno urbano en Las Delicias (89,000)
  "tz-111-1": "photo-1777268209440-296c2bb6facf",
  "tz-111-2": "photo-1745757392529-c04da3b8a116",
  // TZ-112 Casa para remodelar en Colonia Layco (92,000)
  "tz-112-1": "photo-1609859419072-9bf20f29b828",
  "tz-112-2": "photo-1554995207-c18c203602cb",
  "tz-112-3": "photo-1484154218962-a197022b5858",
  "tz-112-4": "photo-1538307602205-80b5c2ff26ec",
  // TZ-113 Apartamento amueblado en ALQUILER, Santa Elena (750/mes)
  "tz-113-1": "photo-1613575831056-0acd5da8f085",
  "tz-113-2": "photo-1616486029423-aaa4789e8c9a",
  "tz-113-3": "photo-1631889993959-41b4e9c6e3c5",
  // TZ-114 Casa en ALQUILER en residencial, Santa Tecla (950/mes)
  "tz-114-1": "photo-1666532937489-331f2f8f4668",
  "tz-114-2": "photo-1679330788855-340ff414b0cd",
  "tz-114-3": "photo-1565538810643-b5bdb714032a",
  "tz-114-4": "photo-1620979038013-d61e5629c4d4",
  // TZ-115 Local en ALQUILER sobre Escalón (1,250/mes)
  "tz-115-1": "photo-1759050486852-fdfe2fdc7bea",
  "tz-115-2": "photo-1736236560164-bc741c70bca5",
  // TZ-116 Apartamento en ALQUILER en Escalón (525/mes)
  "tz-116-1": "photo-1665249934445-1de680641f50",
  "tz-116-2": "photo-1616594039964-ae9021a400a0",
};

// Solo se bajan las que faltan, o las que se pidan por nombre en la línea de
// comandos (para reemplazar una que no calzaba con la propiedad).
const pedidas = process.argv.slice(2);

fs.mkdirSync(SALIDA, { recursive: true });

let bajadas = 0;
for (const [nombre, id] of Object.entries(FOTOS)) {
  if (pedidas.length > 0 && !pedidas.includes(nombre)) continue;
  const destino = path.join(SALIDA, `${nombre}.jpg`);
  if (pedidas.length === 0 && fs.existsSync(destino)) continue;
  const url = `https://images.unsplash.com/${id}?w=1080&h=810&fit=crop&q=80`;
  const r = await fetch(url);
  if (!r.ok) {
    console.error(`${nombre}: ${r.status} ${id}`);
    continue;
  }
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  bajadas++;
}
console.log(`${bajadas} fotos en public/inmobiliaria`);
