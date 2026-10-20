from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html, math
out=Path('documentacion/docs/imagenes');out.mkdir(exist_ok=True)
W,H=2500,2650
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


text(65,35,'06 · CARGAR Y MOSTRAR SUBTÍTULOS',49,'#FFFFFF',True)
text(65,110,'Elegir pista → extraer WebVTT → interpretar intervenciones → mostrar texto según el tiempo global del episodio',25,'#A7BACB')
rect(60,180,460,1990,'#172C3B','#477B9C')
rect(555,180,1885,1990,'#16232B','#3D675A')
text(85,200,'CLIENTE',31,'#96D4FF',True)
text(580,200,'SERVIDOR · ASP.NET Core',31,'#6DE5BA',True)
text(85,264,'VideoPlayer + subtitles.js',23,'#FFFFFF',True)
for x,w,title,sub in [(590,430,'CONTROLLER','VideoController · ExecuteAsync'),(1080,730,'SERVICIO','VideoService'),(1870,530,'PROCESOS EXTERNOS','FFprobe · FFmpeg')]:
 rect(x,260,w,77,'#243D42' if x<1870 else '#303349')
 text(x+20,270,title,25,'#6DE5BA' if x<1870 else '#C6BBFF',True)
 text(x+20,309,sub,20)
def box(x,y,w,h,title,ls,fill='#1C3438',accent='#FFFFFF',size=23):
 rect(x,y,w,h,fill)
 text(x+20,y+16,title,27,accent,True)
 lines(x+20,y+64,ls,size,gap=35)
box(80,370,420,260,'1 · Elegir una pista',[
 'selectedSubtitle = índice absoluto.',
 'El efecto crea AbortController.',
 'GET /api/video/subtitles',
 'Envía path y trackIndex.',
 'Activa un límite de 20 segundos.'
],fill='#203E51',size=21)
box(590,370,430,260,'2 · GetSubtitles(...)',[
 'Recibe path y trackIndex.',
 'ExecuteAsync llama al servicio.',
 'GetSubtitlesAsync(path, index,',
 '              RequestAborted).'
],size=22)
box(1080,370,730,260,'3 · Analizar y validar la pista',[
 'GetVideoInfoAsync → VideoInfo y SubtitleTracks.',
 'Busca un MediaTrack con Index == trackIndex.',
 'Comprueba IsSupported para extraer texto.',
 'Pista ausente o de imagen → ArgumentException.'
],size=23)
box(1870,370,530,260,'4 · FFprobe analiza el original',[
 'Consulta las pistas del archivo.',
 'Devuelve índices, códecs y etiquetas.',
 'Incluye códec e índice de cada subtítulo.',
 'Los datos se convierten en modelos.'
],fill='#272D41',size=21)
for a,b in [(500,590),(1020,1080),(1810,1870)]:arrow(a,470,b,470)
arrow(1870,550,1810,550,'#82BDFF')
box(1080,690,730,215,'5 · Configurar la extracción',[
 'Selecciona la pista con -map 0:trackIndex.',
 'Convierte a WebVTT: -c:s webvtt -f webvtt pipe:1.',
 'Lee salida UTF-8 y errores de forma asíncrona.',
 'El token permite intentar detener el proceso.'
],size=23)
arrow(1440,630,1440,690)
box(1870,690,530,215,'6 · FFmpeg extrae subtítulos',[
 'Lee la pista del archivo original.',
 'Escribe WebVTT por StandardOutput.',
 'Conserva tiempos del episodio completo.',
 'La respuesta se mantiene en memoria.'
],fill='#272D41',size=22)
arrow(1810,770,1870,770);arrow(1870,845,1810,845,'#82BDFF')
box(1080,965,730,200,'Devolver el texto WebVTT',[
 'Espera la salida y comprueba la cancelación.',
 'ExitCode distinto de 0 → registra aviso y lanza fallo.',
 'Si todo es correcto: return output (string).'
],size=23)
arrow(1440,905,1440,965,'#82BDFF')
box(590,965,430,200,'Respuesta HTTP 200',[
 'Content(subtitles, "text/vtt", UTF8).',
 'Envía texto con marcas temporales.',
 'Contenido text/vtt codificado en UTF-8.'
],size=21)
arrow(1080,1045,1020,1045,'#82BDFF')
box(80,965,420,200,'7 · Leer e interpretar',[
 'await response.text()',
 'Comprueba HTTP y cabecera WEBVTT.',
 'parseSubtitles(body) → cues.'
],fill='#203E51',size=21)
arrow(590,1045,500,1045,'#82BDFF')
rect(80,1230,420,290,'#35314B','#71688E')
text(100,1246,'8 · Datos en el cliente',25,'#D6C5FF',True)
lines(100,1294,[
 'cue: { start, end, text }',
 'Ejemplo: 1200 → 1203 s, «Hola».',
 'subtitleData conserva:',
 'path, track, attempt, cues',
 'y error cuando hay un fallo.'
],21,gap=34)
arrow(290,1165,290,1230,'#C6A8F0')
rect(590,1230,1810,290,'#35314B','#71688E')
text(615,1248,'MODELOS Y DATOS · del archivo original a las intervenciones visibles',28,'#D6C5FF',True)
lines(615,1305,[
 'Servidor: VideoInfo.SubtitleTracks → List<MediaTrack>; cada pista tiene Index, Codec e IsSupported.',
 'Transporte: texto WebVTT con tiempos, por ejemplo 00:20:00.000 --> 00:20:03.000.',
 'Cliente: parseSubtitles convierte las marcas a segundos y obtiene { start, end, text }.',
 'Normaliza saltos de línea, elimina etiquetas de presentación y decodifica entidades de texto.',
 'Descarta bloques sin intervalos válidos y conserva las intervenciones interpretables.'
],24,gap=38)
box(80,1590,420,290,'9 · Mostrar la intervención',[
 'activeSubtitles exige coincidencia',
 'de path, track y attempt.',
 'subtitleAt(cues, currentTime)',
 'elige start <= tiempo < end.',
 'React dibuja el texto sobre el vídeo.',
 'Oculto al cargar o arrastrar.'
],fill='#203E51',size=21)
arrow(290,1520,290,1590)
rect(590,1590,1810,225,'#24362F','#527B5E')
text(615,1607,'SINCRONIZACIÓN · usa el tiempo global del episodio',28,'#8FE3A7',True)
lines(615,1660,[
 'currentTime se calcula con la referencia del HLS más video.currentTime.',
 'subtitleAt conserva las intervenciones cuyo intervalo incluye ese instante y une las simultáneas.',
 'Buscar o cambiar de audio recalibra el tiempo HLS; la pista de subtítulos seleccionada se conserva.',
 'Los subtítulos se muestran en una capa propia; el efecto de extracción no depende de la sesión HLS.'
],24,gap=35)
rect(590,1870,1810,205,'#22333C','#477B9C')
text(615,1887,'DESACTIVAR, CAMBIAR PISTA O REINTENTAR',28,'#96D4FF',True)
lines(615,1940,[
 'Desactivar: selectedSubtitle = "" → retira el efecto anterior, cancela su petición y oculta el texto.',
 'Cambiar pista: cancela la carga anterior y solicita la nueva. El vídeo mantiene su sesión HLS.',
 'Reintentar: incrementa subtitleAttempt → nueva extracción; se comprueba la identidad del resultado.'
],24,gap=37)
rect(60,2230,2380,275,'#30252B','#A66B73')
text(85,2247,'ERRORES Y CANCELACIÓN',28,'#FFB3BC',True)
lines(85,2305,[
 'Argumentos o pista inválidos → 400; archivo ausente → 404; fallo de extracción → 500. El cliente muestra el detalle disponible.',
 'A los 20 s muestra un error y ejecuta abort(). El servidor intenta detener el proceso y propaga la cancelación.',
 'Texto sin cabecera WEBVTT → error de formato. Una lista vacía muestra «La pista seleccionada no contiene intervenciones».',
 'Al cambiar pista o salir: clearTimeout y abort(). El resultado se aplica cuando la petición continúa activa.'
],24,gap=39)
arrow(70,2580,150,2580);text(170,2561,'Petición / ejecución',24)
arrow(570,2580,490,2580,'#82BDFF');text(590,2561,'Respuesta / resultado',24)
text(1050,2561,'Ejemplo: segundo 1201 → intervalo [1200, 1203) → se muestra «Hola».',24,'#B8C9D6')
im.save(out/'video-06-subtitulos.png')
svg.append('</svg>')
(out/'video-06-subtitulos.svg').write_text('\n'.join(svg),encoding='utf-8')
print(str((out/'video-06-subtitulos.png').resolve()))
