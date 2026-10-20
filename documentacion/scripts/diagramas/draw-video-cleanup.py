from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html, math
out=Path('documentacion/docs/imagenes');out.mkdir(exist_ok=True)
W,H=2500,2760
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


text(65,35,'08 · SALIR Y LIMPIAR',49,'#FFFFFF',True)
text(65,110,'Guardar progreso → liberar el cliente → detener FFmpeg → borrar temporales → reintentar si queda pendiente',25,'#A7BACB')
rect(60,180,460,2200,'#172C3B','#477B9C')
rect(555,180,1885,2200,'#16232B','#3D675A')
text(85,200,'CLIENTE',31,'#96D4FF',True)
text(580,200,'SERVIDOR · ASP.NET Core',31,'#6DE5BA',True)
text(85,264,'VideoPlayer.jsx',26,'#FFFFFF',True)
for x,w,title,sub in [(590,430,'CONTROLLER','VideoController · ExecuteAsync'),(1080,730,'SERVICIOS','VideoService · HlsCleanupService'),(1870,530,'PROCESO Y TEMPORALES','FFmpeg · carpeta HLS')]:
 rect(x,260,w,77,'#243D42' if x<1870 else '#303349')
 text(x+20,270,title,25,'#6DE5BA' if x<1870 else '#C6BBFF',True)
 text(x+20,309,sub,20)
def box(x,y,w,h,title,ls,fill='#1C3438',accent='#FFFFFF',size=23):
 rect(x,y,w,h,fill)
 text(x+20,y+16,title,27,accent,True)
 lines(x+20,y+64,ls,size,gap=35)
box(80,370,420,240,'1 · handleBack()',[
 'Pausa el <video>.',
 'Espera el intento de flush().',
 'Navega a episodios si hay serie;',
 'en otro caso vuelve a /series.',
 'Salir retira el componente.'
],fill='#203E51',size=21)
box(80,670,420,280,'2 · Limpiar efectos',[
 'cancelled = true; abort().',
 'Retira temporizadores y eventos.',
 'Destruye la instancia Hls.js.',
 'Libera referencias de esa sesión.',
 'stopSession(id) con keepalive.',
 'POST /api/video/stop/{id}'
],fill='#203E51',size=21)
arrow(290,610,290,670)
box(590,670,430,280,'3 · Stop(sessionId)',[
 'ExecuteAsync llama a',
 'StopHlsAsync(sessionId).',
 'La limpieza usa su propio ciclo',
 'de espera e intentos.',
 'Se puede repetir la petición.'
],size=22)
box(1080,670,730,280,'4 · Registrar y serializar la limpieza',[
 'ValidateSessionId exige un GUID en formato N.',
 '_pendingCleanup.TryAdd(sessionId, 0).',
 'Espera _cleanupLock: un turno de limpieza cada vez.',
 'Localiza el proceso en _activeSessions.',
 'finally libera el semáforo al terminar el intento.'
],size=23)
arrow(500,770,590,770);arrow(1020,770,1080,770)
rect(1080,370,1320,240,'#35314B','#71688E')
text(1100,386,'IDENTIDAD Y ESTADO · de PlaybackSession a los registros del servicio',27,'#D6C5FF',True)
lines(1100,440,[
 'SessionId enlaza la sesión devuelta al cliente con su proceso y su carpeta.',
 '_activeSessions: sessionId → Process. _pendingCleanup: IDs por limpiar.',
 '_requestedStops: marca asociada al Process para reconocer una detención solicitada.',
 'La cola pendiente y los registros viven en memoria durante la ejecución del servidor.'
],24,gap=36)
box(1080,1010,730,230,'5 · Detener FFmpeg y esperar',[
 'Si sigue activo: marca _requestedStops antes de Kill.',
 'Kill(entireProcessTree: true) → WaitForExitAsync().',
 'Retira el proceso de _activeSessions al confirmar salida.',
 'Si la detención falla, conserva pendiente y devuelve.'
],size=22)
arrow(1440,950,1440,1010)
box(1870,1010,530,230,'FFmpeg y su supervisión',[
 'El proceso deja de escribir al terminar.',
 'MonitorSessionAsync observa la salida.',
 'Marca solicitada → mensaje informativo.',
 'Error sin marca → registra el fallo.'
],fill='#272D41',size=21)
arrow(1810,1100,1870,1100);arrow(1870,1170,1810,1170,'#82BDFF')
box(1080,1300,730,240,'6 · DeleteSessionDirectoryAsync',[
 'Resuelve raíz y carpeta como rutas absolutas.',
 'Comprueba que la carpeta quede dentro de la raíz HLS.',
 'Directory.Delete(..., recursive: true), hasta 5 intentos.',
 'Entre fallos de E/S o permisos: 200, 400, 600, 800 ms.',
 'Carpeta ya ausente → éxito; agotar intentos → false.'
],size=22)
arrow(1440,1240,1440,1300)
box(1870,1300,530,240,'Carpeta temporal de la sesión',[
 '%TEMP%/HuexMedia/Hls/{id}/',
 'Borra manifiesto y segmentos.',
 'Éxito → retira el ID de pendientes.',
 'Fallo → conserva el ID y registra aviso.',
 'El borrado sigue a la salida del proceso.'
],fill='#272D41',size=21)
arrow(1810,1390,1870,1390);arrow(1870,1470,1810,1470,'#82BDFF')
box(1080,1600,730,190,'7 · Finalizar el intento',[
 'Devuelve tras el intento de detención y limpieza.',
 'Puede quedar pendiente si falló detener o borrar.',
 'La respuesta se construye al volver al controlador.'
],size=23)
arrow(1440,1540,1440,1600,'#82BDFF')
box(590,1600,430,190,'HTTP 200',[
 'message: «Sesión de',
 'reproducción finalizada».',
 'Puede haber limpieza pendiente.'
],size=22)
arrow(1080,1680,1020,1680,'#82BDFF')
box(80,1600,420,190,'Cliente ya liberado',[
 'La petición se lanza en segundo plano.',
 'stopSession captura fallos de red',
 'y los registra en consola.'
],fill='#203E51',size=21)
arrow(590,1680,500,1680,'#82BDFF')
rect(1080,1860,1320,300,'#24362F','#527B5E')
text(1100,1877,'8 · HlsCleanupService · reintento de pendientes',28,'#8FE3A7',True)
lines(1100,1930,[
 'PeriodicTimer espera 30 segundos por ciclo.',
 'ExecuteAsync → RetryPendingCleanupAsync → StopHlsAsync por cada ID pendiente.',
 'Cada nuevo intento vuelve a detener el proceso si es necesario y a intentar el borrado.',
 'Éxito: retira el ID. Fallo: sigue pendiente para el siguiente ciclo.',
 'Comprueba cancelación entre sesiones y termina con el cierre del servidor.'
],24,gap=37)
arrow(2130,1540,2130,1860,'#8FE3A7')
text(2150,1750,'si pendiente',20,'#8FE3A7')
box(80,1860,420,335,'Otros caminos de salida',[
 'Buscar o cambiar audio también',
 'retira el efecto de reproducción.',
 'Si start se cancela al preparar,',
 'su catch solicita StopHlsAsync.',
 'Un resultado antiguo con sesión',
 'conocida se solicita detener.',
 'El guardador intenta flush al salir.'
],fill='#203E51',size=21)
rect(590,2220,1810,105,'#22333C','#477B9C')
text(615,2233,'Alcance de los reintentos',27,'#96D4FF',True)
text(615,2277,'Se aplican a los IDs registrados como pendientes en memoria mientras el servidor continúa ejecutándose.',24)
rect(60,2450,2380,205,'#30252B','#A66B73')
text(85,2465,'ERRORES Y RESULTADO DE LA LIMPIEZA',28,'#FFB3BC',True)
lines(85,2522,[
 'ID inválido → 400. Un fallo inesperado capturado por ExecuteAsync → 500. Fallos recuperables se conservan para reintentar.',
 'HTTP 200 confirma que terminó el intento de StopHlsAsync; para verificar el borrado se registra «Archivos temporales eliminados».',
 'keepalive ayuda a enviar la petición al abandonar la página. Los reintentos dependen de que la sesión llegue a pendientes.'
],24,gap=37)
arrow(70,2720,150,2720);text(170,2701,'Petición / ejecución',24)
arrow(570,2720,490,2720,'#82BDFF');text(590,2701,'Respuesta / resultado',24)
text(1050,2701,'Orden de limpieza: detener proceso → confirmar salida → borrar carpeta.',24,'#B8C9D6')
im.save(out/'video-08-salir-limpiar.png')
svg.append('</svg>')
(out/'video-08-salir-limpiar.svg').write_text('\n'.join(svg),encoding='utf-8')
print(str((out/'video-08-salir-limpiar.png').resolve()))
