from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html, math
out=Path('documentacion/docs/imagenes');out.mkdir(exist_ok=True)
W,H=2500,2420
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

text(65,35,'01 · CONSULTAR INFORMACIÓN DEL VÍDEO',49,'#FFFFFF',True)
text(65,110,'Recorrido de GetVideoInfoAsync · petición HTTP, análisis con FFprobe y respuesta al reproductor',27,'#A7BACB')
rect(60,180,460,1730,'#172C3B','#477B9C')
rect(555,180,1885,1730,'#16232B','#3D675A')
text(85,200,'CLIENTE',31,'#96D4FF',True)
text(580,200,'SERVIDOR · ASP.NET Core',31,'#6DE5BA',True)
text(85,264,'VideoPlayer.jsx',26,'#FFFFFF',True)
for x,w,title,sub in [(590,430,'CONTROLLER','VideoController'),(1080,730,'SERVICIO','VideoService'),(1870,530,'PROCESO EXTERNO','ffprobe.exe')]:
 rect(x,260,w,77,'#243D42' if x<1870 else '#303349')
 text(x+20,270,title,27,'#6DE5BA' if x<1870 else '#C6BBFF',True)
 text(x+20,309,sub,21)
def box(x,y,w,h,title,ls,fill='#1C3438',accent='#FFFFFF',size=25):
 rect(x,y,w,h,fill)
 text(x+20,y+16,title,28,accent,True)
 lines(x+20,y+65,ls,size,gap=37)
box(80,370,420,215,'1 · loadVideoInfo()',[
 'useEffect depende de videoPath.',
 'Crea un AbortController.',
 'fetch(..., { signal })',
 'Envía la ruta codificada.'
],fill='#203E51',size=23)
box(590,370,430,215,'2 · GetVideoInfo(path)',[
 'GET /api/video/info?path=...',
 'ExecuteAsync recibe el delegado.',
 'Lo ejecuta dentro del try.',
 'Pasa RequestAborted al servicio.'
],size=22)
box(1080,370,730,215,'3 · GetVideoInfoAsync(path, token)',[
 'ValidateVideoPath(path):',
 '• exige una ruta con contenido;',
 '• comprueba que el archivo exista.',
 'Continúa si la validación es correcta.'
])
arrow(500,445,590,445)
arrow(1020,445,1080,445)
box(1080,635,730,165,'4 · Preparar la consulta',[
 'ProcessStartInfo + ArgumentList: -show_entries,',
 'campos técnicos, -of json y ruta del archivo.',
 'Redirige salida y errores hacia C#.'
],size=24)
arrow(1440,585,1440,635)
box(1870,635,530,165,'5 · process.Start()',[
 'FFprobe lee el archivo original.',
 'Consulta duración y streams.',
 'Escribe JSON y mensajes de error.'
],fill='#272D41',size=24)
arrow(1810,705,1870,705)
box(1870,850,530,185,'Salida del proceso',[
 'StandardOutput → texto JSON',
 'StandardError → texto de errores',
 'ExitCode → resultado de ejecución'
],fill='#272D41',size=24)
arrow(2130,800,2130,850)
box(1080,850,730,185,'6 · Esperar y recoger los datos',[
 'ReadToEndAsync en ambos canales a la vez.',
 'await WaitForExitAsync() → comprobar cancelación.',
 'ExitCode = 0 → continuar; otro valor → excepción.'
],size=24)
arrow(1870,930,1810,930,'#82BDFF')
box(1080,1085,730,165,'7 · Interpretar el JSON',[
 'JsonNode.Parse(output).AsObject()',
 'Convierte duración con InvariantCulture.',
 'Recorre streams: vídeo, audio y subtítulos.'
],size=24)
arrow(1440,1035,1440,1085)
box(1870,1085,530,340,'Cancelación durante el análisis',[
 'El cliente ejecuta controller.abort().',
 'RequestAborted comunica la cancelación.',
 'token.Register intenta Kill del proceso.',
 'Tras esperar su salida:',
 'ThrowIfCancellationRequested().',
 'ExecuteAsync propaga la cancelación.'
],fill='#343044',accent='#D6C5FF',size=22)
rect(1080,1300,730,230,'#35314B','#71688E')
text(1100,1314,'MODELO · VideoInfo',28,'#D6C5FF',True)
lines(1100,1365,[
 'Duration · Width · Height · VideoCodec · AudioCodec',
 'RequiresTranscoding: vídeo ≠ h264 o audio ≠ aac',
 'AudioTracks y SubtitleTracks → listas de MediaTrack',
 'MediaTrack: Index, Codec, Language, Title,',
 'IsDefault, IsForced e IsSupported'
],23,gap=32)
arrow(1440,1250,1440,1300,'#C6A8F0')
box(1080,1590,730,200,'8 · return videoInfo',[
 'Guarda el primer vídeo y el primer códec de audio.',
 'Añade todos los audios y subtítulos a sus listas.',
 'Registra los códecs y devuelve el objeto tipado.'
],size=24)
arrow(1440,1530,1440,1590,'#82BDFF')
box(590,1590,430,200,'Respuesta HTTP 200',[
 'Ok(videoInfo)',
 'ASP.NET Core serializa el objeto.',
 'Devuelve JSON al navegador.'
],size=23)
arrow(1080,1670,1020,1670,'#82BDFF')
box(80,1590,420,200,'9 · Actualizar la interfaz',[
 'await response.json()',
 'setDuration(info.duration)',
 'setAudioTracks(info.audioTracks)',
 'setSubtitleTracks(info.subtitleTracks)'
],fill='#203E51',size=20)
arrow(590,1670,500,1670,'#82BDFF')
text(85,1825,'Solo aplica el resultado si la petición sigue activa.',18,'#96D4FF')
text(1095,1830,'Resultado listo para la barra de duración y los selectores de pistas.',23,'#A7BACB')
# Failure paths separate from success sequence.
rect(60,1960,2380,325,'#30252B','#A66B73')
text(85,1978,'RUTAS DE ERROR · el servicio lanza la excepción y ExecuteAsync construye la respuesta',28,'#FFB3BC',True)
errors=[(85,550,'Ruta inválida → HTTP 400',['ValidateVideoPath lanza ArgumentException.','El controlador devuelve JSON con error.']),
 (680,550,'Archivo ausente → HTTP 404',['FileNotFoundException.','Respuesta: «No se ha encontrado el vídeo».']),
 (1275,550,'Fallo de análisis → HTTP 500',['Se registra el detalle técnico del fallo.','Respuesta general de análisis del vídeo.']),
 (1870,540,'El cliente recibe un fallo',['response.ok es false → lanza Error.','Si sigue activo: setError(message).'])]
for x,w,title,ls in errors:
 box(x,2045,w,185,title,ls,fill='#412E36',accent='#FFCFD4',size=22)
# Footer legend
arrow(70,2347,150,2347)
text(170,2328,'Petición / ejecución',24)
arrow(570,2347,490,2347,'#82BDFF')
text(590,2328,'Respuesta / resultado',24)
text(1050,2328,'Lee los pasos 1 → 9. Los modelos representan datos, no procesos.',25,'#B8C9D6')
im.save(out/'video-01-consultar-informacion.png')
svg.append('</svg>')
(out/'video-01-consultar-informacion.svg').write_text('\n'.join(svg),encoding='utf-8')
print(str((out/'video-01-consultar-informacion.png').resolve()))
