from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html, math
out=Path('documentacion/docs/imagenes');out.mkdir(exist_ok=True)
W,H=2500,2640
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


text(65,35,'05 · CAMBIAR AUDIO',49,'#FFFFFF',True)
text(65,110,'Elegir una pista → conservar posición y pausa → preparar HLS con otro audio → ajustar el tiempo del episodio',25,'#A7BACB')
rect(60,180,460,2025,'#172C3B','#477B9C')
rect(555,180,1885,2025,'#16232B','#3D675A')
text(85,200,'CLIENTE',31,'#96D4FF',True)
text(580,200,'SERVIDOR · ASP.NET Core',31,'#6DE5BA',True)
text(85,264,'VideoPlayer.jsx',26,'#FFFFFF',True)
for x,w,title,sub in [(590,430,'CONTROLLER','VideoController · ExecuteAsync'),(1080,730,'SERVICIO','VideoService'),(1870,530,'PROCESOS Y ARCHIVOS','FFmpeg · carpetas de sesión')]:
 rect(x,260,w,77,'#243D42' if x<1870 else '#303349')
 text(x+20,270,title,25,'#6DE5BA' if x<1870 else '#C6BBFF',True)
 text(x+20,309,sub,20)
def box(x,y,w,h,title,ls,fill='#1C3438',accent='#FFFFFF',size=23):
 rect(x,y,w,h,fill)
 text(x+20,y+16,title,27,accent,True)
 lines(x+20,y+64,ls,size,gap=35)
box(80,370,420,215,'1 · Selector de audio',[
 'Opciones desde audioTracks.',
 'Cada value usa MediaTrack.Index.',
 'onChange llama a changeAudio.',
 'Desactivado al cargar o si hay < 2.'
],fill='#203E51',size=21)
box(80,635,420,260,'2 · changeAudio(event)',[
 'Si loading, termina la función.',
 'index = Number(event.target.value).',
 'Compara con el audio actual.',
 'Conserva posición y estado de pausa.',
 'Actualiza selectedAudio y seekTarget.'
],fill='#203E51',size=21)
arrow(290,585,290,635)
# These client-only branches are explicitly identified as an inset, not server operations.
rect(590,370,1810,390,'#22333C','#477B9C')
text(615,387,'DECISIÓN EN EL CLIENTE · selección y posición que se enviarán al servidor',28,'#96D4FF',True)
box(615,445,845,275,'A · Misma pista → mantener la sesión',[
 'index === (selectedAudio ?? audioTracks[0]?.index)',
 'El índice es absoluto dentro del archivo, no la posición del menú.',
 'Si coincide con el audio actual, changeAudio termina.',
 'Al inicio, la selección usa la primera pista disponible.'
],fill='#203E51',size=23)
box(1490,445,885,275,'B · Otra pista → guardar tiempo global y pausa',[
 'position = startOffsetRef.current + video.currentTime.',
 'Acota position entre 0 y el final menos 0.1 segundos.',
 'playAfterSeekRef.current = !video.paused.',
 'setSelectedAudio(index) activa otro intento HLS.'
],fill='#203E51',size=23)
arrow(500,705,590,705,'#96D4FF')
box(80,945,420,235,'3 · Limpiar el efecto anterior',[
 'Marca cancelled = true.',
 'AbortController.abort().',
 'Retira eventos y destruye Hls.js.',
 'stopSession(id) → POST stop.'
],fill='#203E51',size=21)
arrow(290,895,290,945)
box(590,945,430,235,'4 · Stop(sessionId)',[
 'POST /api/video/stop/{id}',
 'ExecuteAsync llama al servicio.',
 'La petición se envía con keepalive.',
 'El cliente no espera todo el borrado.'
],size=21)
box(1080,945,730,235,'StopHlsAsync · sesión anterior',[
 'Añade el ID a pendientes y espera el turno de limpieza.',
 'Marca detención solicitada y detiene FFmpeg.',
 'Espera la salida del proceso e intenta borrar la carpeta.',
 'Si falla, mantiene el intento pendiente para reintentar.'
],size=22)
box(1870,945,530,235,'Sesión anterior',[
 'Proceso FFmpeg anterior → detenido.',
 'Carpeta anterior → intento de borrado.',
 'Puede coincidir brevemente con la nueva.',
 'Cada sesión tiene su propio GUID.'
],fill='#272D41',size=21)
for a,b in [(500,590),(1020,1080),(1810,1870)]:arrow(a,1040,b,1040)
box(80,1230,420,230,'5 · Nuevo startPlayback()',[
 'Nueva petición e identificador local.',
 'startSeconds = position.',
 'audioTrackIndex = index elegido.',
 'POST /api/video/start?...'
],fill='#203E51',size=21)
arrow(290,1180,290,1230)
box(590,1230,430,230,'6 · Start(...)',[
 'Recibe path, position y audio.',
 'Pasa RequestAborted al servicio.',
 'Mismo endpoint del evento 02.',
 'ExecuteAsync gestiona la respuesta.'
],size=21)
box(1080,1230,730,230,'7 · StartHlsAsync · nueva sesión',[
 'Analiza con FFprobe y busca el índice en AudioTracks.',
 'Crea un nuevo GUID y otra carpeta temporal.',
 'CreateHlsStartInfo selecciona -map 0:audioTrackIndex.',
 'Espera manifiesto y primer segmento con datos.'
],size=22)
box(1870,1230,530,230,'FFmpeg con la nueva pista',[
 'Mismo archivo y posición conservada.',
 'Convierte el audio elegido a AAC estéreo.',
 'Vídeo: copia h264 o convierte a libx264.',
 'FFprobe mide el inicio real del HLS.'
],fill='#272D41',size=21)
for a,b in [(500,590),(1020,1080),(1810,1870)]:arrow(a,1325,b,1325)
rect(1080,1520,730,210,'#35314B','#71688E')
text(1100,1535,'8 · MODELO · PlaybackSession',27,'#D6C5FF',True)
lines(1100,1586,[
 'SessionId → nueva identidad.',
 'StartSeconds → posición conservada del episodio.',
 'TimelineStartSeconds → inicio real del segmento.',
 'TransportTimestampOffsetSeconds → margen de 10 s.'
],22,gap=33)
arrow(1440,1460,1440,1520,'#C6A8F0')
box(1080,1790,730,200,'Devolver la nueva sesión',[
 'El controlador añade playlistUrl a la respuesta.',
 'El cliente acepta el resultado solo si sigue vigente.',
 'Una sesión recibida tarde se solicita detener.'
],size=23)
arrow(1440,1730,1440,1790,'#82BDFF')
box(590,1790,430,200,'HTTP 200 · JSON',[
 'sessionId + playlistUrl',
 'startSeconds + timelineStartSeconds',
 'transportTimestampOffsetSeconds'
],size=20)
arrow(1080,1870,1020,1870,'#82BDFF')
box(80,1790,420,270,'9 · Reproducir con otro audio',[
 'Guarda la nueva sesión.',
 'Carga el manifiesto con Hls.js',
 'o con soporte HLS nativo.',
 'Ajusta la referencia temporal real.',
 'playAfterSeekRef decide si',
 'debe volver a reproducirse.'
],fill='#203E51',size=21)
arrow(590,1870,500,1870,'#82BDFF')
rect(590,2040,1810,115,'#24362F','#527B5E')
text(615,2054,'Posición y subtítulos tras el cambio de audio',27,'#8FE3A7',True)
text(615,2102,'Recalibra el tiempo global al nuevo HLS. La pista de subtítulos elegida se conserva y utiliza el tiempo del episodio.',23)
rect(60,2270,2380,240,'#30252B','#A66B73')
text(85,2287,'CANCELACIÓN Y ERRORES',28,'#FFB3BC',True)
lines(85,2340,[
 'requestId + cancelled descartan callbacks de intentos antiguos. Un inicio cancelado limpia sus temporales durante la preparación.',
 'La nueva sesión usa las respuestas 400 / 404 / 500 del evento 02. El cliente muestra el error del intento vigente.',
 'Mientras loading está activo, el selector de audio se deshabilita y los subtítulos quedan ocultos hasta la nueva reproducción.'
],24,gap=40)
arrow(70,2570,150,2570);text(170,2551,'Petición / ejecución',24)
arrow(570,2570,490,2570,'#82BDFF');text(590,2551,'Respuesta / resultado',24)
text(1050,2551,'Ejemplo: segundo 1200 + audio inglés (índice 2) → startSeconds=1200 & audioTrackIndex=2.',24,'#B8C9D6')
im.save(out/'video-05-cambiar-audio.png')
svg.append('</svg>')
(out/'video-05-cambiar-audio.svg').write_text('\n'.join(svg),encoding='utf-8')
print(str((out/'video-05-cambiar-audio.png').resolve()))
