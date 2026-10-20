from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html, math
out=Path('documentacion/docs/imagenes');out.mkdir(exist_ok=True)
W,H=2600,2050
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
text(60,35,'SISTEMA DE VÍDEO',52,'#FFFFFF',True)
text(60,105,'Huex Media App · Sigue cada fila de izquierda a derecha; las respuestas vuelven al cliente.',28,'#A7BACB')
rect(60,180,470,1285,'#172C3B','#477B9C')
rect(565,180,1975,1745,'#16232B','#3D675A')
text(85,195,'CLIENTE · navegador',31,'#96D4FF',True)
text(595,195,'SERVIDOR · ASP.NET Core',31,'#6DE5BA',True)
text(85,250,'VideoPlayer.jsx',26,'#FFFFFF',True)
text(85,289,'React + <video> + Hls.js',23,'#A7BACB')
rect(610,250,535,78,'#243D42')
text(635,265,'CONTROLLER',29,'#6DE5BA',True)
text(635,300,'VideoController · ExecuteAsync',22)
rect(1215,250,655,78,'#243D42')
text(1240,265,'SERVICIOS',29,'#6DE5BA',True)
text(1240,300,'VideoService',22)
rect(1940,250,555,78,'#303349')
text(1965,265,'PROCESOS Y ARCHIVOS',27,'#C6BBFF',True)
text(1965,300,'Herramientas externas y temporales',22)
rows=[
(365,'1','Consultar información',['Abres el episodio.','Obtiene duración y pistas.'],['GET /api/video/info','GetVideoInfo(path)'],['GetVideoInfoAsync','Valida el archivo y lee el JSON.','Resultado: VideoInfo + MediaTrack'],['FFprobe analiza el original.','Códecs, duración, resolución,','audios y subtítulos.'],'JSON'),
(580,'2','Preparar reproducción',['Inicio o continuar viendo.','Posición + audio elegido.'],['POST /api/video/start','Start(path, posición, audio)'],['StartHlsAsync','Configura FFmpeg y espera segmentos.','Resultado: PlaybackSession'],['FFmpeg genera HLS.','Carpeta única por sesión:','index.m3u8 + segment_*.ts'],'JSON'),
(795,'3','Reproducir segmentos',['Hls.js carga el manifiesto.','El <video> reproduce.'],['GET /api/video/hls/...','GetHlsFile(sesión, archivo)'],['GetHlsFile → GetHlsFilePath','Valida sesión, nombre y existencia.','Resultado interno: HlsMediaFile'],['Lee manifiesto y segmentos.','El servidor envía sus bytes.','FFmpeg sigue generando contenido.'],'HLS'),
(1010,'4','Mostrar subtítulos',['Eliges una pista.','parseSubtitles + subtitleAt','dibujan texto según el tiempo.'],['GET /api/video/subtitles','GetSubtitles(path, pista)'],['GetSubtitlesAsync','Analiza y valida la pista de texto.','Resultado: texto WebVTT en memoria'],['FFprobe identifica la pista.','FFmpeg la convierte a WebVTT.','Tiempos del episodio original.'],'VTT'),
(1225,'5','Detener y limpiar',['Sales, buscas otra posición','o cambias de audio.','Solicita detener la sesión anterior.'],['POST /api/video/stop/{id}','Stop(sessionId)'],['StopHlsAsync','Marca detención → espera salida','→ borra carpeta; conserva pendientes.'],['Detiene el proceso FFmpeg.','Borrado: hasta 5 intentos.','Pendientes: reintento cada 30 s.'],'200')]
for y,n,title,client,controller,service,resource,response in rows:
 rect(80,y,430,190,'#203E51')
 text(98,y+12,n+' · '+title,26,'#FFFFFF',True)
 lines(98,y+58,client,23,gap=33)
 rect(610,y,535,190,'#1C3438')
 lines(630,y+27,controller,25,gap=44,bold=True)
 text(630,y+139,'Añade playlistUrl a la respuesta' if n == '2' else 'Ejecución y respuesta HTTP centralizadas',21,'#9EB7BA')
 rect(1215,y,655,190,'#1C3438')
 text(1235,y+22,service[0],29,'#FFFFFF',True)
 lines(1235,y+74,service[1:],24,gap=39)
 rect(1940,y,555,190,'#272D41')
 lines(1960,y+32,resource,24,gap=42)
 arrow(510,y+73,610,y+73)
 arrow(610,y+123,510,y+123,'#82BDFF')
 text(533,y+136,response,18,'#82BDFF')
 arrow(1145,y+73,1215,y+73)
 arrow(1215,y+123,1145,y+123,'#82BDFF')
 arrow(1870,y+73,1940,y+73)
 arrow(1940,y+123,1870,y+123,'#82BDFF')
# Client explanations below its boundary; lifecycle details.
rect(60,1500,470,425,'#172C3B','#477B9C')
text(85,1520,'EVENTOS DEL CLIENTE',26,'#96D4FF',True)
lines(85,1570,['Buscar o cambiar audio:','solicita otra sesión desde','el tiempo actual del episodio.','','Subtítulos: usan el tiempo global.','Tiempo global = referencia','temporal + video.currentTime.','','Pausa: pausa el <video>.'],23,gap=35)
# Shared service and its loop, clearly inside server.
rect(610,1460,1885,110,'#26362C','#527B5E')
text(635,1474,'HlsCleanupService · tarea en segundo plano',27,'#8FE3A7',True)
text(635,1518,'Cada 30 s → RetryPendingCleanupAsync → StopHlsAsync para las sesiones pendientes en memoria.',25)
# Models group is data, dashed dependencies.
rect(610,1610,1885,275,'#2A293C','#71688E')
text(635,1622,'MODELOS · datos que intercambian controlador y servicio',28,'#D6C5FF',True)
models=[('VideoInfo + MediaTrack',['Duración, códecs y resolución.','Pistas: índice, idioma y formato.']),('PlaybackSession',['ID y posición solicitada.','Inicio real y margen temporal.']),('HlsMediaFile',['Ruta local validada.','Tipo MIME del archivo HLS.'])]
for i,(name,body) in enumerate(models):
 x=635+i*615
 rect(x,1678,590,175,'#35314B')
 text(x+18,1694,name,27,'#FFFFFF',True)
 lines(x+18,1745,body,23,gap=38)

# Legend/footer
arrow(65,1970,150,1970)
text(165,1951,'Petición / llamada',24)
arrow(500,1970,415,1970,'#82BDFF')
text(520,1951,'Respuesta / resultado',24)
text(1005,1951,'ExecuteAsync: validación → 400 · archivo ausente → 404 · fallo → 500 · cancelación → se propaga',23,'#B8C9D6')
im.save(out/'sistema-video-flujo.png')
svg.append('</svg>');(out/'sistema-video-flujo.svg').write_text('\n'.join(svg),encoding='utf-8')
print(str((out/'sistema-video-flujo.png').resolve()))
