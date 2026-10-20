# Header

[Frontend](../README.md) · [Código JSX](../../codigo/Header.md) · [Estilos CSS](../../codigo/HeaderStyles.md)

`src/Header.jsx` muestra la cabecera de la aplicación: el icono y nombre de HUEX MEDIA APP, un botón de pantalla completa y los enlaces de navegación. Utiliza `Link` de React Router y carga sus estilos desde `src/css/Header.css`.

## Organización

| Bloque | Responsabilidad |
| --- | --- |
| Estados | Mantener el estado del botón y el aviso de pantalla completa. |
| Sincronización de pantalla completa | Escuchar los cambios del documento y actualizar la interfaz. |
| Acción de pantalla completa | Solicitar la entrada o la salida al pulsar el botón. |
| Renderizado | Mostrar la marca, el control central y los enlaces. |

## Estados

| Estado | Valor inicial | Uso |
| --- | --- | --- |
| `isFullscreen` | `false` | Cambia el dibujo del botón, su título, `aria-label` y `aria-pressed`. |
| `fullscreenError` | Cadena vacía | Muestra un aviso con `role="status"` cuando falla la solicitud. |

## Funciones y efecto

### Header()

Construye la cabecera y conecta sus estados con el botón. La marca enlaza al inicio y muestra `/HuexMediaAppIcon.png` junto al título. La imagen lleva `alt=""`, ya que el texto del enlace identifica la aplicación.

### useEffect: sincronización de pantalla completa

Se ejecuta al montar el componente. Primero llama a `updateFullscreen` para leer el estado actual y después registra esa función en el evento `fullscreenchange` del documento. La función de limpieza retira el listener al desmontar el componente.

El navegador emite este evento cuando cambia el elemento que ocupa la pantalla completa mediante la Fullscreen API, por ejemplo al entrar desde el botón o salir con Escape.

### updateFullscreen()

Es una función interna del efecto. Compara `document.fullscreenElement` con `document.documentElement`, el elemento raíz de la aplicación. Guarda el resultado en `isFullscreen` y limpia el aviso anterior.

La comparación distingue la pantalla completa de toda la aplicación de la pantalla completa de otro elemento, como el vídeo. El botón representa el estado del elemento raíz.

### toggleFullscreen()

Se ejecuta al pulsar el botón central. Limpia el aviso y consulta `document.fullscreenElement`:

- Si existe un elemento en pantalla completa, espera a `document.exitFullscreen()`.
- En otro caso, espera a `document.documentElement.requestFullscreen()` para mostrar toda la aplicación.

El evento `fullscreenchange` actualiza después el estado del botón. Si la operación falla, guarda el mensaje «No se pudo cambiar la pantalla completa. Puedes usar F11.». El botón queda deshabilitado cuando `document.fullscreenEnabled` es falso.

F11 controla el modo de pantalla completa propio del navegador. La lectura del componente se basa en la Fullscreen API del documento.

## Navegación

| Elemento | Ruta |
| --- | --- |
| Marca HUEX MEDIA APP | `/` |
| Películas | `/movies` |
| Series | `/series` |
| Música | `/music` |
| Volver al inicio | `/` |
| Configuración | `/settings` |

## Estilos y resoluciones

La cabecera usa una cuadrícula de tres columnas: marca a la izquierda, pantalla completa en el centro y enlaces a la derecha. `position: sticky`, `top: 0` y `z-index: 100` mantienen su posición superior dentro de su contenedor de desplazamiento.

Hasta 900 píxeles, la cuadrícula pasa a dos columnas y los enlaces ocupan una segunda fila centrada. Las reglas adaptables definen estas variables:

| Variable | Controla |
| --- | --- |
| `--header-text-size` | Tamaño del nombre de la aplicación. |
| `--header-logo-size` | Ancho y alto del icono. |
| `--header-nav-icon-size` | Tamaño de los iconos de navegación. |
| `--header-fullscreen-icon-size` | Tamaño del icono de pantalla completa. |
| `--header-logo-gap` | Separación entre icono y título. |
| `--header-nav-gap` | Separación entre enlaces. |
| `--header-padding` | Espacio interior de la cabecera. |

Los intervalos de `Header.css` son: hasta 900 píxeles, de 901 a 1023, de 1024 a 1440, de 1441 a 1920 y desde 1921. Cada intervalo permite ajustar esos valores de forma independiente.

Las páginas de código JSX y CSS se generan desde los archivos del proyecto al construir MkDocs. Ambos archivos están registrados para actualizar la documentación durante la consulta local.
