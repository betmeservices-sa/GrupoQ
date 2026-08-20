# Genera las notas de voz que usa scripts/carga-masiva.ts.
#
# Son sintéticas (voz Sabina, es-MX) y a propósito de largos distintos: lo que
# decide el costo de transcribir es la DURACIÓN, así que la mezcla tiene que
# parecerse a la real, con notas de 8 segundos y otras de 40.
#
# Salen en OGG/Opus mono 48 kHz, el mismo formato en que WhatsApp manda las
# notas de voz, para que la medición no dependa de una conversión distinta.
#
# Uso:  powershell -File scripts/generar-audios.ps1

$dir = "medicion/audios"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

Add-Type -AssemblyName System.Speech
$voz = New-Object System.Speech.Synthesis.SpeechSynthesizer
$es = $voz.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like "es*" } | Select-Object -First 1
if ($es) { $voz.SelectVoice($es.VoiceInfo.Name) }

$textos = @(
  "Hola, buenas tardes.",
  "Quiero saber si tienen habitaciones disponibles.",
  "Hola, somos dos adultos y queremos ir el fin de semana.",
  "Buenas, quisiera reservar del 22 al 26 de agosto para cuatro personas.",
  "Hola, vi el Instagram de Yali, Playa El Sunzal, y me interesa saber los precios de las habitaciones.",
  "Buenos dias, estoy organizando un viaje familiar. Somos dos adultos y tres ninos, y queremos ir la ultima semana del mes. Que opciones tienen.",
  "Hola, una consulta, el desayuno viene incluido en la tarifa o se paga aparte. Y tambien queria saber si aceptan mascotas porque llevamos a nuestro perro.",
  "Buenas tardes, le escribo porque estamos viendo opciones para un fin de semana largo. Somos seis personas, tres parejas, y buscamos algo frente al mar. Nos gustaria saber que habitaciones tienen, cuanto sale por noche, y si hay que dejar algun anticipo para reservar.",
  "Hola, queria preguntar por Costa del Surf, en Playa Las Flores. Vamos a estar por la zona la proxima semana y no sabemos si conviene quedarse ahi o en Playa Linda. Que nos recomienda para ir con ninos pequenos.",
  "Buenas, mire, estuvimos el ano pasado y nos encanto. Ahora queremos volver pero somos mas gente. La idea es ir del veintidos al veintiseis, seriamos ocho adultos y dos ninos. Necesitariamos tres o cuatro habitaciones, dependiendo de como las armen. Tambien queriamos saber si el restaurante trabaja todos los dias y si se puede hacer una cena privada para el grupo la ultima noche.",
  "Hola, buenas. Quisiera saber el precio de la habitacion con vista al mar.",
  "Buenas, a que hora es el check in y hasta que hora el check out.",
  "Hola, tienen parqueo propio o hay que dejar el carro afuera.",
  "Buenas tardes, quiero confirmar la reserva que hicimos ayer a nombre de la familia Portillo, para el fin de semana.",
  "Hola, disculpe la molestia, pero necesito cambiar las fechas de la reserva. En vez del quince seria para el veintidos, si es que tienen disponible.",
  "Buenas, estamos buscando un lugar tranquilo para descansar unos dias. No queremos fiesta ni musica fuerte, solo playa y silencio. Cual de los tres hoteles nos recomienda para eso.",
  "Hola, me pueden mandar fotos de las habitaciones por favor.",
  "Buenas noches, perdon la hora, pero queria dejar la consulta hecha. Somos dos personas, vamos en carro desde San Salvador, y queriamos llegar el viernes por la tarde.",
  "Hola, una pregunta rapida, se puede pagar con tarjeta o solo efectivo.",
  "Buenas, tienen salon para un evento de cuarenta personas. Es para un cumpleanos y necesitariamos tambien habitaciones para los que se quedan a dormir."
)

$duraciones = @{}
for ($i = 0; $i -lt $textos.Count; $i++) {
  $nombre = "nota-{0:d2}" -f $i
  $wav = "$dir/$nombre.wav"
  $ogg = "$dir/$nombre.ogg"
  $voz.SetOutputToWaveFile($wav)
  $voz.Speak($textos[$i])
  $voz.SetOutputToNull()

  & ffmpeg -y -loglevel error -i $wav -c:a libopus -b:a 24k -ar 48000 -ac 1 $ogg
  $dur = & ffprobe -v error -show_entries format=duration -of "default=noprint_wrappers=1:nokey=1" $ogg
  $duraciones["$nombre.ogg"] = [math]::Round([double]$dur, 2)
  Remove-Item $wav -ErrorAction SilentlyContinue
  Write-Host ("  {0}  {1,6:N1} s" -f "$nombre.ogg", [double]$dur)
}
$voz.Dispose()

$duraciones | ConvertTo-Json | Set-Content "$dir/duraciones.json" -Encoding UTF8
$total = ($duraciones.Values | Measure-Object -Sum).Sum
Write-Host ""
Write-Host ("$($textos.Count) notas, {0:N1} s en total ({1:N1} s de promedio)" -f $total, ($total / $textos.Count))
