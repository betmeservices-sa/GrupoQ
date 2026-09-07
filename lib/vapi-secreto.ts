// El secreto que comparten los webhooks que llama Vapi.
//
// Vive aparte porque lo usan dos cosas distintas (la memoria del agente y la
// llamada de vuelta) y porque una comparación de secretos mal hecha es de las
// que no se notan: se compara en tiempo constante y sin secreto configurado no
// pasa nadie, ni siquiera con el header vacío.

export function secretoVapiValido(req: Request): boolean {
  const esperado = process.env.VAPI_MEMORIA_SECRET || process.env.VAPI_WEBHOOK_SECRET;
  if (!esperado) return false;
  const recibido = req.headers.get("x-vapi-secret") ?? "";
  if (recibido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < recibido.length; i++) dif |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}
