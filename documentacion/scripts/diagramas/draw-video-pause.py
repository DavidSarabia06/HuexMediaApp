from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html, math
out=Path('documentacion/docs/imagenes');out.mkdir(exist_ok=True)
W,H=2500,2460
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


text(65,35,'07 · PAUSAR Y REANUDAR',49,'#FFFFFF',True)
text(65,110,'El navegador controla play / pause; al pausar intenta guardar la última muestra de progreso disponible.',26,'#A7BACB')
rect(60,180,750,1960,'#172C3B','#477B9C')
rect(870,180,1570,1960,'#16232B','#3D675A')
text(85,200,'CLIENTE · VideoPlayer.jsx',31,'#96D4FF',True)
text(895,200,'SERVIDOR · guardado del progreso',31,'#6DE5BA',True)
for x,w,title,sub in [(910,450,'CONTROLLER','PlaybackProgressController'),(1420,970,'SERVICIO','PlaybackProgressService')]:
 rect(x,260,w,77,'#243D42')
 text(x+20,270,title,26,'#6DE5BA',True)
 text(x+20,309,sub,21)
def box(x,y,w,h,title,ls,fill='#1C3438',accent='#FFFFFF',size=24):
 rect(x,y,w,h,fill)
 text(x+20,y+16,title,27,accent,True)
 lines(x+20,y+64,ls,size,gap=35)
box(80,370,710,190,'1 · Clic en el vídeo o en el botón',[
 'togglePlayback() exige un vídeo y que !loading.',
 'showControls() muestra los controles y reinicia la actividad.',
 'Consulta video.paused para elegir pause() o play().'
],fill='#203E51',size=23)
box(80,620,340,280,'2A · Pausar',[
 'video.pause()',
 'Evento onPause:',
 'isPlaying = false.',
 'buffering = false.',
 'Solicita saver.flush().'
],fill='#203E51',size=22)
box(450,620,340,280,'2B · Reanudar',[
 'await video.play()',
 'Evento onPlay:',
 'isPlaying = true.',
 'Limpia error y muestra',
 'los controles.'
],fill='#203E51',size=22)
arrow(250,560,250,620);arrow(620,560,620,620)
rect(910,370,1480,450,'#35314B','#71688E')
text(935,390,'MODELOS · progreso asociado al episodio, la serie y la biblioteca',27,'#D6C5FF',True)
box(935,455,690,325,'SavePlaybackProgressRequest',[
 'LibraryPath · SeriesPath · EpisodePath',
 'PositionSeconds → último tiempo global registrado.',
 'DurationSeconds → duración completa del episodio.',
 'RecordedAtUtc → fecha de la muestra.',
 'El cliente envía este objeto como JSON.'
],fill='#403A58',size=22)
box(1655,455,710,325,'SeriesPlaybackProgress',[
 'SeriesPath · WatchedEpisodePaths',
 'InProgress → EpisodePlaybackProgress o null.',
 'LastWatchedEpisodePath · LastRecordedAtUtc',
 'EpisodePlaybackProgress conserva:',
 'EpisodePath, PositionSeconds, DurationSeconds.'
],fill='#403A58',size=22)
box(80,960,710,230,'3 · Guardar la última muestra',[
 'onPause → progressSaverRef.current?.flush().',
 'El guardador agrupa muestras y serializa las peticiones.',
 'Envía la última muestra pendiente o modificada:',
 'POST /api/playbackprogress con keepalive: true.'
],fill='#203E51',size=23)
arrow(250,900,250,960)
box(910,960,450,230,'4 · Save(request)',[
 'Recibe el JSON de progreso.',
 'ExecuteAsync llama a SaveAsync.',
 'Devuelve 200 con el progreso',
 'actualizado de la serie.'
],size=23)
box(1420,960,970,230,'5 · SaveAsync(request)',[
 'Valida pertenencia del episodio, tiempos y fecha.',
 'Espera _gate y carga el JSON de la biblioteca.',
 'Descarta muestras anteriores a LastRecordedAtUtc.',
 'Actualiza visto / en curso con la muestra más reciente.'
],size=24)
arrow(790,1050,910,1050);arrow(1360,1050,1420,1050)
box(1420,1250,970,190,'Persistir y devolver el resultado',[
 'WriteAsync guarda en App_Data/PlaybackProgress.',
 'Mantiene un episodio en curso por serie y conserva los vistos.',
 'La respuesta permite confirmar el guardado en el cliente.'
],fill='#272D41',size=24)
arrow(1900,1190,1900,1250)
arrow(1420,1130,1360,1130,'#82BDFF');arrow(910,1130,790,1130,'#82BDFF')
box(80,1290,710,260,'6 · Al continuar reproduciendo',[
 'onTimeUpdate → handleTimeUpdate().',
 'Tiempo global = referencia + video.currentTime.',
 'record(...) actualiza la muestra cuando está reproduciendo',
 'y está listo, sin búsqueda ni arrastre.',
 'El temporizador solicita flush cada 10 segundos.'
],fill='#203E51',size=22)

rect(910,1500,1480,230,'#24362F','#527B5E')
text(935,1518,'SESIÓN HLS · continúa preparada mientras el vídeo está en pausa',27,'#8FE3A7',True)
lines(935,1570,[
 'Pausar y reanudar actúa sobre el elemento <video> del navegador.',
 'La sesión HLS conserva su identificador; FFmpeg puede seguir generando segmentos.',
 'El manifiesto mantiene una ventana deslizante y el búfer conserva datos del cliente.',
 'La detención y el borrado de temporales pertenecen al evento de salir o sustituir la sesión.'
],24,gap=35)
box(80,1620,710,350,'7 · Controles y estados visuales',[
 'onWaiting activa buffering.',
 'onPlaying y onCanPlay lo desactivan.',
 'En pausa los controles permanecen visibles.',
 'Al reproducir, 3 s sin actividad pueden ocultarlos.',
 'El temporizador exige: sin carga, búfer, arrastre o error.',
 'Mover el puntero o interactuar vuelve a mostrarlos.'
],fill='#203E51',size=23)
arrow(435,1550,435,1620)
rect(910,1790,1480,240,'#22333C','#477B9C')
text(935,1808,'CLASIFICACIÓN DEL PROGRESO · parámetros de appsettings',27,'#96D4FF',True)
lines(935,1860,[
 'Visto: alcanza WatchedThresholdPercent (95 %) o quedan como máximo 120 segundos.',
 'El margen final usa RemainingSecondsToMarkWatched y puede configurarse.',
 'Una muestra de un episodio pendiente sustituye al anterior episodio en curso de la serie.',
 'flush envía una muestra disponible; record es quien captura el tiempo durante la reproducción.'
],24,gap=35)
rect(60,2200,2380,175,'#30252B','#A66B73')
text(85,2215,'ERRORES Y REINTENTOS',28,'#FFB3BC',True)
lines(85,2270,[
 'Si video.play() falla al reanudar, muestra un error de reproducción. Un fallo de guardado conserva la muestra para el próximo flush.',
 'El servidor responde 400 ante argumentos inválidos y 500 ante fallos de datos, E/S o permisos capturados en progreso.'
],24,gap=40)
arrow(70,2420,150,2420);text(170,2401,'Petición / ejecución',24)
arrow(570,2420,490,2420,'#82BDFF');text(590,2401,'Respuesta / resultado',24)
text(1050,2401,'Play y pausa son locales; la petición al servidor corresponde al progreso.',24,'#B8C9D6')
im.save(out/'video-07-pausar-reanudar.png')
svg.append('</svg>')
(out/'video-07-pausar-reanudar.svg').write_text('\n'.join(svg),encoding='utf-8')
print(str((out/'video-07-pausar-reanudar.png').resolve()))
