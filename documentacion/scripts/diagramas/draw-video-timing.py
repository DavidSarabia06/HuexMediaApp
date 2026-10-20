from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html, math
out=Path('documentacion/docs/imagenes');out.mkdir(exist_ok=True)
W,H=2200,1840
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


text(60,32,'CÓMO SE SINCRONIZAN AUDIO, VÍDEO Y SUBTÍTULOS',43,'#FFFFFF',True)
text(60,100,'Ejemplo didáctico: pides el segundo 1200, el contenido comienza en 1198 y han transcurrido 4 segundos.',25,'#A7BACB')
rect(60,160,1010,270,'#1C3438','#3D675A')
text(85,177,'SERVIDOR · preparar el contenido',28,'#6DE5BA',True)
lines(85,231,[
 '1. Petición: startSeconds = 1200.',
 '2. El primer fotograma disponible está en 1198 (ejemplo).',
 '3. FFmpeg añade +10 a las marcas de transporte → 1208.',
 '4. FFprobe mide el inicio; devuelve referencias al cliente.'
],25,gap=39)
rect(1130,160,1010,270,'#203E51','#477B9C')
text(1155,177,'CLIENTE · recuperar el tiempo del episodio',28,'#96D4FF',True)
lines(1155,231,[
 '1. Carga audio y vídeo juntos mediante HLS.',
 '2. INIT_PTS_FOUND calibra la referencia usada por Hls.js.',
 '3. Referencia del ejemplo: 1208 − 10 = 1198.',
 '4. Tiempo del episodio = referencia + video.currentTime.'
],25,gap=39)
arrow(1070,290,1130,290)
rect(60,485,2080,760,'#17232D','#466075')
text(85,502,'TRES FORMAS DE NUMERAR EL MISMO INSTANTE',30,'#FFFFFF',True)
text(85,553,'Cada columna vertical representa el mismo contenido. Cambian los números, no el momento del diálogo.',24,'#A7BACB')
x0=650;step=190;now=x0+4*step
# Whole-column current-time highlight.
rect(now-65,605,130,570,'#244137',r=12)
for label,y,start,color in [('EPISODIO ORIGINAL',680,1198,'#6DE5BA'),('TRANSPORTE HLS',860,1208,'#C6BBFF'),('REPRODUCTOR LOCAL',1040,0,'#96D4FF')]:
 text(90,y-30,label,27,color,True)
 detail={'EPISODIO ORIGINAL':'Audio, vídeo y subtítulos del archivo.','TRANSPORTE HLS':'Las marcas llevan el margen +10 s.','REPRODUCTOR LOCAL':'En este ejemplo comienza en 0 s.'}[label]
 text(90,y+18,detail,21,'#A7BACB')
 arrow(x0-15,y,x0+7*step+40,y,color,3)
 for i in range(8):
  x=x0+i*step
  d.line((x,y-12,x,y+12),fill=color,width=3)
  svg.append(f'<path d="M{x},{y-12} L{x},{y+12}" stroke="{color}" stroke-width="3"/>')
  text(x-34,y+27,str(start+i)+' s',24,color,i==4)
text(now-46,615,'AHORA',23,'#8FE3A7',True)
text(90,1150,'Misma imagen y mismo sonido:',24,'#FFFFFF',True)
text(650,1150,'1202 s del episodio = 1212 s del transporte = 4 s locales',29,'#FFFFFF',True)
# Requested position marker and subtitle interval.
text(x0+2*step-70,748,'↑ solicitado',20,'#E9C56B')
text(90,920,'Margen común al contenido:',22,'#C6BBFF')
text(90,945,'+10 s es una etiqueta temporal,',21,'#A7BACB')
text(90,970,'no una espera de diez segundos.',21,'#A7BACB')
# Calculation and subtitle selection.
rect(60,1300,1010,365,'#24362F','#527B5E')
text(85,1318,'CALCULAR EL TIEMPO GLOBAL',28,'#8FE3A7',True)
text(85,1375,'1198 + 4 = 1202 segundos',45,'#FFFFFF',True)
text(85,1440,'referencia ajustada + video.currentTime',25,'#A7BACB')
lines(85,1491,[
 'Audio y vídeo se reproducen con sus marcas temporales.',
 'React utiliza el tiempo global para elegir el subtítulo.',
 'La calibración se repite al preparar otra sesión HLS.'
],24,gap=39)
rect(1130,1300,1010,365,'#35314B','#71688E')
text(1155,1318,'ELEGIR EL SUBTÍTULO',28,'#D6C5FF',True)
text(1155,1375,'«Hola» · de 1200 a 1203 segundos',33,'#FFFFFF',True)
lines(1155,1440,[
 'subtitleAt(cues, 1202) comprueba:',
 '1202 >= 1200  y  1202 < 1203  →  mostrar «Hola».',
 'El texto WebVTT conserva los tiempos del episodio.',
 'Al buscar, la referencia nueva mantiene esa relación.'
],24,gap=39)
arrow(1070,1475,1130,1475,'#8FE3A7')
rect(60,1710,2080,90,'#30252B','#A66B73')
text(85,1725,'SI USÁRAMOS EL DESTINO PEDIDO: 1200 + 4 = 1204 → el subtítulo se buscaría 2 segundos por delante.',26,'#FFCFD4',True)
text(85,1765,'Los valores son ilustrativos: Hls.js o el soporte HLS nativo calibran la referencia real de cada reproducción.',21,'#C8B8BC')
im.save(out/'video-sincronizacion-tiempos.png')
svg.append('</svg>')
(out/'video-sincronizacion-tiempos.svg').write_text('\n'.join(svg),encoding='utf-8')
print(str((out/'video-sincronizacion-tiempos.png').resolve()))
