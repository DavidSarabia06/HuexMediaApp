from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html, math
out=Path('documentacion/docs/imagenes');out.mkdir(exist_ok=True)
W,H=2500,2940
im=Image.new('RGB',(W,H),'#101923');d=ImageDraw.Draw(im)
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">','<rect width="100%" height="100%" fill="#101923"/>']
fonts='C:/Windows/Fonts/'
def font(size,bold=False): return ImageFont.truetype(fonts+('segoeuib.ttf' if bold else 'segoeui.ttf'),size)
def rect(x,y,w,h,fill,stroke=None,r=18):
 d.rounded_rectangle((x,y,x+w,y+h),radius=r,fill=fill,outline=stroke,width=2)
 svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="2"' if stroke else '')+'/>')
def text(x,y,s,size=26,color='#DCE7F2',bold=False):
 d.text((x,y),s,font=font(size,bold),fill=color)
 svg.append(f'<text x="{x}" y="{y+size}" font-family="Segoe UI,Arial,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{html.escape(s)}</text>')
def lines(x,y,ls,size=25,color='#DCE7F2',gap=36,bold=False):
 for i,s in enumerate(ls):text(x,y+i*gap,s,size,color,bold)
def arrow(x1,y1,x2,y2,color='#46DBB0',width=4,dashed=False):
 if dashed:
  length=math.hypot(x2-x1,y2-y1)
  for i in range(0,int(length),18):
   a=i/length;b=min((i+9)/length,1)
   d.line((x1+(x2-x1)*a,y1+(y2-y1)*a,x1+(x2-x1)*b,y1+(y2-y1)*b),fill=color,width=width)
 else:d.line((x1,y1,x2,y2),fill=color,width=width)
 angle=math.atan2(y2-y1,x2-x1);n=13
 pts=[(x2,y2),(x2-n*math.cos(angle-.5),y2-n*math.sin(angle-.5)),(x2-n*math.cos(angle+.5),y2-n*math.sin(angle+.5))]
 d.polygon(pts,fill=color)
 svg.append(f'<path d="M{x1},{y1} L{x2},{y2}" stroke="{color}" stroke-width="{width}" fill="none"'+(' stroke-dasharray="9 9"' if dashed else '')+'/>')
 svg.append('<polygon points="'+' '.join(f'{a},{b}' for a,b in pts)+f'" fill="{color}"/>')


text(65,35,'02 · INICIAR REPRODUCCIÓN',49,'#FFFFFF',True)
text(65,110,'De startPlayback a PlaybackSession · preparar HLS, comprobar el primer segmento y devolver la sesión',27,'#A7BACB')
rect(60,180,460,2260,'#172C3B','#477B9C')
rect(555,180,1885,2260,'#16232B','#3D675A')
text(85,200,'CLIENTE',31,'#96D4FF',True)
text(580,200,'SERVIDOR · ASP.NET Core',31,'#6DE5BA',True)
text(85,264,'VideoPlayer.jsx',26,'#FFFFFF',True)
for x,w,title,sub in [(590,430,'CONTROLLER','VideoController'),(1080,730,'SERVICIO','VideoService'),(1870,530,'PROCESOS Y ARCHIVOS','FFprobe · FFmpeg · temporales')]:
 rect(x,260,w,77,'#243D42' if x<1870 else '#303349')
 text(x+20,270,title,25,'#6DE5BA' if x<1870 else '#C6BBFF',True)
 text(x+20,309,sub,21)
def box(x,y,w,h,title,ls,fill='#1C3438',accent='#FFFFFF',size=24):
 rect(x,y,w,h,fill)
 text(x+20,y+16,title,27,accent,True)
 lines(x+20,y+64,ls,size,gap=36)
box(80,370,420,260,'1 · startPlayback()',[
 'Activa loading y buffering.',
 'Libera el HLS y el src anteriores.',
 'Solicita detener la sesión anterior.',
 'POST /api/video/start',
 'path + startSeconds + audio opcional'
],fill='#203E51',size=21)
box(590,370,430,260,'2 · Start(...)',[
 'Recibe los parámetros de la URL.',
 'ExecuteAsync ejecuta el delegado.',
 'Llama a StartHlsAsync con:',
 'path, startSeconds,',
 'RequestAborted, audioTrackIndex.'
],size=22)
box(1080,370,730,260,'3 · Validar la petición',[
 'Comprueba la cancelación del token.',
 'ValidateVideoPath: ruta con contenido y archivo existente.',
 'startSeconds debe ser finito y mayor o igual que cero.',
 'Estas validaciones se realizan antes de crear temporales.'
],size=23)
arrow(500,470,590,470);arrow(1020,470,1080,470)
box(1080,680,730,190,'4 · Analizar y completar la validación',[
 'GetVideoInfoAsync → VideoInfo + MediaTrack.',
 'Comprueba que exista el audio seleccionado.',
 'Exige posición < duración cuando se conoce la duración.'
],size=23)
arrow(1440,630,1440,680)
box(1870,680,530,190,'FFprobe · archivo original',[
 'Consulta códecs y duración.',
 'Identifica las pistas disponibles.',
 'Devuelve los datos técnicos en JSON.'
],fill='#272D41',size=23)
arrow(1810,750,1870,750);arrow(1870,810,1810,810,'#82BDFF')
box(80,720,420,300,'Protección del cliente',[
 'AbortController cancela la petición.',
 'requestId identifica cada intento.',
 'Una respuesta antigua se descarta',
 'y su sesión se solicita detener.',
 '',
 'La detención anterior se solicita',
 'sin esperar a completar el borrado.'
],fill='#203E51',accent='#96D4FF',size=21)
box(1080,920,730,175,'5 · Crear identidad y carpeta',[
 'sessionId = Guid.NewGuid().ToString("N")',
 'Directory.CreateDirectory(outputDirectory)',
 'playlistPath apunta a index.m3u8 dentro de la sesión.'
],size=23)
arrow(1440,870,1440,920)
box(1870,920,530,175,'Carpeta temporal independiente',[
 '%TEMP%/HuexMedia/Hls/{sessionId}/',
 'Separa los archivos de cada sesión.',
 'El original permanece en su ubicación.'
],fill='#272D41',size=22)
arrow(1810,1000,1870,1000)
box(1080,1145,730,210,'6 · Configurar y arrancar FFmpeg',[
 'CreateHlsStartInfo → ProcessStartInfo.',
 'process.Start() inicia el proceso.',
 '_activeSessions.TryAdd(sessionId, process).',
 'ReadToEndAsync lee sus errores mientras trabaja.'
],size=23)
arrow(1440,1095,1440,1145)
box(1870,1145,530,210,'FFmpeg · generar contenido HLS',[
 'Vídeo: copia h264 o convierte a libx264.',
 'Audio: seleccionado → AAC estéreo.',
 'Objetivo: segmentos de 4 s; lista de 20.',
 'Escribe index.m3u8 y segment_*.ts.'
],fill='#272D41',size=22)
arrow(1810,1230,1870,1230)
box(1080,1405,730,190,'7 · WaitForPlaylistAsync',[
 'Comprueba manifiesto + segmento referenciado.',
 'El segmento debe existir y tener datos.',
 'Hasta 300 intentos con esperas de 100 ms.'
],size=23)
arrow(1440,1355,1440,1405)
box(1870,1405,530,190,'Primer segmento disponible',[
 'El manifiesto contiene su nombre.',
 'El archivo .ts tiene longitud > 0.',
 'Se devuelve su ruta al servicio.'
],fill='#272D41',size=23)
arrow(1810,1470,1870,1470);arrow(1870,1530,1810,1530,'#82BDFF')
box(1080,1645,730,210,'8 · Supervisar y medir el inicio real',[
 'Task.Run → MonitorSessionAsync en segundo plano.',
 'GetHlsStartTimeAsync consulta el primer segmento.',
 'timelineStart = máximo entre 0 y (transportStart − 10).',
 'El inicio real puede diferir del segundo solicitado.'
],size=23)
arrow(1440,1595,1440,1645)
box(1870,1645,530,210,'FFprobe · primer segmento',[
 'Lee format=start_time del archivo .ts.',
 'Debe ser un número finito.',
 'FFmpeg añade 10 s de margen temporal.',
 'La medida permite relacionar HLS y episodio.'
],fill='#272D41',size=21)
arrow(1810,1725,1870,1725);arrow(1870,1790,1810,1790,'#82BDFF')
rect(1080,1905,730,175,'#35314B','#71688E')
text(1100,1920,'9 · MODELO · PlaybackSession',27,'#D6C5FF',True)
lines(1100,1970,[
 'SessionId · StartSeconds (posición solicitada)',
 'TimelineStartSeconds (inicio real referido al episodio)',
 'TransportTimestampOffsetSeconds = 10'
],23,gap=33)
arrow(1440,1855,1440,1905,'#C6A8F0')
box(1080,2130,730,200,'return PlaybackSession',[
 'Devuelve la sesión preparada al controlador.',
 'FFmpeg continúa generando segmentos.',
 'MonitorSessionAsync observa la salida del proceso.'
],size=23)
arrow(1440,2080,1440,2130,'#82BDFF')
box(590,2130,430,200,'10 · Respuesta HTTP 200',[
 'Añade playlistUrl a los datos.',
 'Ok(new { sessionId, playlistUrl,',
 'startSeconds, timelineStartSeconds,',
 'transportTimestampOffsetSeconds })'
],size=20)
arrow(1080,2210,1020,2210,'#82BDFF')
box(80,2130,420,200,'11 · Recibir la sesión',[
 'Comprueba que siga vigente.',
 'Guarda sessionId y la referencia.',
 'Configura Hls.js o HLS nativo.',
 'Carga playlistUrl → evento 03.'
],fill='#203E51',size=22)
arrow(590,2210,500,2210,'#82BDFF')
text(1095,2370,'La URL del manifiesto se construye en el controlador; el servicio devuelve PlaybackSession.',21,'#A7BACB')
rect(60,2490,2380,325,'#30252B','#A66B73')
text(85,2510,'ERRORES Y CANCELACIÓN · limpieza de la sesión cuando falla la preparación',28,'#FFB3BC',True)
errors=[(85,550,'Validación o archivo ausente',[
 'ArgumentException → HTTP 400.',
 'FileNotFoundException → HTTP 404.',
 'La validación inicial precede a la carpeta.']),
(680,550,'FFmpeg / espera / sincronización',[
 'Fallo o ausencia de contenido → excepción.',
 'Tras crear la carpeta: StopHlsAsync.',
 'ExecuteAsync registra el fallo → HTTP 500.']),
(1275,550,'Petición cancelada',[
 'El servicio comprueba el token.',
 'Si ya está en preparación: intenta limpiar.',
 'ExecuteAsync propaga la cancelación.']),
(1870,540,'Limpieza de preparación',[
 'StopHlsAsync usa su ciclo de limpieza.',
 'Conserva los fallos para reintentarlos.',
 'HlsCleanupService reintenta cada 30 s.'])]
for x,w,title,ls in errors:
 box(x,2575,w,190,title,ls,fill='#412E36',accent='#FFCFD4',size=21)
arrow(70,2875,150,2875);text(170,2856,'Petición / ejecución',24)
arrow(570,2875,490,2875,'#82BDFF');text(590,2856,'Respuesta / resultado',24)
text(1050,2856,'Flujo principal: pasos 1 → 11. Morado: herramientas, archivos y modelos.',24,'#B8C9D6')
im.save(out/'video-02-iniciar-reproduccion.png')
svg.append('</svg>')
(out/'video-02-iniciar-reproduccion.svg').write_text('\n'.join(svg),encoding='utf-8')
print(str((out/'video-02-iniciar-reproduccion.png').resolve()))
