from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html, math
out=Path('documentacion/docs/imagenes');out.mkdir(exist_ok=True)
W,H=2500,2630
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


text(65,35,'03 · REPRODUCIR HLS',49,'#FFFFFF',True)
text(65,110,'Cargar el manifiesto → solicitar segmentos → servir archivos → reproducir y ajustar el tiempo del episodio',26,'#A7BACB')
rect(60,180,460,1950,'#172C3B','#477B9C')
rect(555,180,1885,1950,'#16232B','#3D675A')
text(85,200,'CLIENTE',31,'#96D4FF',True)
text(580,200,'SERVIDOR · ASP.NET Core',31,'#6DE5BA',True)
text(85,264,'VideoPlayer + Hls.js',25,'#FFFFFF',True)
for x,w,title,sub in [(590,430,'CONTROLLER','VideoController'),(1080,730,'SERVICIO','VideoService'),(1870,530,'ARCHIVOS Y PROCESO','Carpeta de sesión · FFmpeg')]:
 rect(x,260,w,77,'#243D42' if x<1870 else '#303349')
 text(x+20,270,title,25,'#6DE5BA' if x<1870 else '#C6BBFF',True)
 text(x+20,309,sub,21)
def box(x,y,w,h,title,ls,fill='#1C3438',accent='#FFFFFF',size=24):
 rect(x,y,w,h,fill)
 text(x+20,y+16,title,27,accent,True)
 lines(x+20,y+64,ls,size,gap=36)
box(80,370,420,240,'1 · Conectar el reproductor',[
 'Recibe playlistUrl del evento 02.',
 'new Hls(...)',
 'attachMedia(video)',
 'loadSource(playlistUrl)',
 'GET .../{sessionId}/index.m3u8'
],fill='#203E51',size=21)
box(590,370,430,240,'2 · GetHlsFile(id, nombre)',[
 'GET /api/video/hls/{id}/{archivo}',
 'ExecuteAsync ejecuta la llamada.',
 'Pide al servicio el descriptor',
 'del archivo solicitado.'
],size=22)
box(1080,370,730,240,'3 · GetHlsFile → GetHlsFilePath',[
 'ValidateSessionId: GUID sin separadores.',
 'Acepta index.m3u8 o segment_ + dígitos + .ts.',
 'Construye la ruta dentro de la carpeta de sesión.',
 'File.Exists comprueba la existencia del archivo.'
],size=23)
arrow(500,470,590,470);arrow(1020,470,1080,470)
box(1870,370,530,240,'4 · Resolver el archivo local',[
 '%TEMP%/HuexMedia/Hls/{id}/',
 'index.m3u8 enumera los segmentos.',
 'segment_00000.ts contiene audio y vídeo.',
 'FFmpeg escribe y actualiza estos archivos.'
],fill='#272D41',size=21)
arrow(1810,470,1870,470);arrow(1870,545,1810,545,'#82BDFF')
rect(1080,680,730,215,'#35314B','#71688E')
text(1100,697,'5 · MODELO · HlsMediaFile',28,'#D6C5FF',True)
lines(1100,746,[
 'FullPath → ruta completa del archivo existente.',
 'ContentType → MIME que utilizará la respuesta:',
 'index.m3u8: application/vnd.apple.mpegurl',
 'segment_*.ts: video/mp2t'
],23,gap=34)
arrow(1440,610,1440,680,'#C6A8F0')
box(1870,680,530,215,'Ventana de contenido HLS',[
 'FFmpeg sigue preparando segmentos.',
 'Manifiesto: últimos 20 segmentos.',
 'Objetivo por segmento: 4 segundos.',
 'Retira archivos antiguos según el margen.'
],fill='#272D41',size=22)
box(1080,965,730,190,'Devolver el descriptor',[
 'El servicio devuelve ruta y tipo de contenido.',
 'El descriptor llega al controlador.',
 'La lectura de bytes ocurre al ejecutar el resultado.'
],size=23)
arrow(1440,895,1440,965,'#82BDFF')
box(590,965,430,190,'6 · PhysicalFile(...)',[
 'Crea PhysicalFileResult.',
 'ASP.NET Core ejecuta el resultado',
 'y envía el archivo con su MIME.'
],size=22)
arrow(1080,1045,1020,1045,'#82BDFF')
box(80,965,420,190,'7 · Interpretar manifiesto',[
 'Hls.js recibe index.m3u8.',
 'MANIFEST_PARSED → quita loading.',
 'playWhenReady() intenta play().'
],fill='#203E51',size=21)
arrow(590,1045,500,1045,'#82BDFF')
box(80,1250,420,225,'8 · Pedir los segmentos',[
 'Hls.js solicita los archivos .ts.',
 'Recibe y prepara audio y vídeo.',
 'Actualiza la lista cuando procede.',
 'El <video> reproduce los datos.'
],fill='#203E51',size=21)
arrow(290,1155,290,1250)
box(590,1250,430,225,'Mismo endpoint por archivo',[
 'GetHlsFile(sessionId, fileName)',
 'Cada manifiesto o segmento pasa',
 'por controlador y servicio.',
 'Devuelve PhysicalFileResult.'
],size=22)
box(1080,1250,730,225,'Repetir validación y resolución',[
 'GetHlsFile → GetHlsFilePath → File.Exists.',
 'Devuelve HlsMediaFile para cada archivo solicitado.',
 'El navegador recibe los bytes del segmento.',
 'Este recorrido se repite durante la reproducción.'
],size=23)
box(1870,1250,530,225,'Segmentos de la sesión',[
 'segment_00000.ts',
 'segment_00001.ts',
 'segment_00002.ts …',
 'Los datos se sirven desde disco.'
],fill='#272D41',size=23)
for x1,x2 in [(500,590),(1020,1080),(1810,1870)]:
 arrow(x1,1325,x2,1325)
 arrow(x2,1405,x1,1405,'#82BDFF')
box(80,1570,420,360,'9 · Actualizar el tiempo',[
 'INIT_PTS_FOUND ajusta la referencia.',
 'offset = initPTS / timescale',
 '              − margen de transporte.',
 'onTimeUpdate → handleTimeUpdate.',
 'Tiempo global = offset',
 '                    + video.currentTime.',
 'Actualiza barra, subtítulos y progreso.'
],fill='#203E51',size=21)
arrow(290,1475,290,1570)
rect(590,1570,1810,180,'#22333C','#477B9C')
text(615,1588,'Alternativa · reproducción HLS nativa',28,'#96D4FF',True)
lines(615,1640,[
 'Si Hls.js no está disponible y el navegador admite HLS: video.src = playlistUrl.',
 'loadedmetadata / canplay calibran la referencia con timelineStartSeconds − video.seekable.start(0).',
 'Las peticiones siguen llegando al mismo endpoint de archivos HLS.'
],24,gap=34)
rect(590,1800,1810,235,'#24362F','#527B5E')
text(615,1817,'Búfer, inicio automático y estados del reproductor',28,'#8FE3A7',True)
lines(615,1870,[
 'Hls.js se configura con maxBufferLength = 30 y maxMaxBufferLength = 60 segundos.',
 'Si play() queda bloqueado por sonido, playWhenReady intenta iniciar silenciado.',
 'waiting activa buffering; playing / canplay lo desactivan; onTimeUpdate muestra el tiempo global.',
 'Pausa y reanudación actúan sobre el <video>; FFmpeg puede continuar preparando contenido.'
],24,gap=35)
rect(60,2200,2380,305,'#30252B','#A66B73')
text(85,2220,'ERRORES · respuesta del servidor y tratamiento en el reproductor',28,'#FFB3BC',True)
errors=[(85,550,'Solicitud inválida / archivo ausente',[
 'Sesión o nombre inválidos → HTTP 400.',
 'Archivo inexistente → HTTP 404.',
 'ExecuteAsync centraliza esas respuestas.']),
(680,550,'Fallo al resolver / al enviar',[
 'Dentro de ExecuteAsync: fallo → 500.',
 'El envío físico se ejecuta después.',
 'Sus fallos pertenecen a ASP.NET Core.']),
(1275,550,'Hls.Events.ERROR',[
 'Registra los errores de Hls.js.',
 'Si data.fatal: muestra error',
 'y desactiva loading.']),
(1870,540,'Vigencia de la reproducción',[
 'Descarta callbacks obsoletos.',
 'Al cambiar o salir destruye Hls.js.',
 'Solicita detener la sesión anterior.'])]
for x,w,title,ls in errors:box(x,2280,w,185,title,ls,fill='#412E36',accent='#FFCFD4',size=21)
arrow(70,2570,150,2570);text(170,2551,'Petición / ejecución',24)
arrow(570,2570,490,2570,'#82BDFF');text(590,2551,'Respuesta / resultado',24)
text(1050,2551,'La respuesta HLS contiene archivos; HlsMediaFile es el descriptor interno.',24,'#B8C9D6')
im.save(out/'video-03-reproducir-hls.png')
svg.append('</svg>')
(out/'video-03-reproducir-hls.svg').write_text('\n'.join(svg),encoding='utf-8')
print(str((out/'video-03-reproducir-hls.png').resolve()))
