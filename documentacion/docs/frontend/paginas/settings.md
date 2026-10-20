# Settings

[Frontend](../README.md) · [App y rutas](../app.md) · [Código JSX](../../codigo/Settings.md)

`src/Settings.jsx` muestra la página de configuración en la ruta `/settings`. Presenta un mensaje que indica dónde seleccionar la carpeta de la biblioteca.

## Organización

| Bloque | Responsabilidad |
| --- | --- |
| Página de configuración | Definir el componente `Settings`. |
| Renderizado | Construir la cabecera y el mensaje informativo. |

## Settings()

Devuelve un contenedor con la clase `huex-container`. Dentro coloca `HuexPageHeader` con el título «Configuración» y un bloque `empty-state` con dos textos:

- «Configuración de la biblioteca», como encabezado del bloque.
- «Puedes seleccionar la carpeta de tu biblioteca desde la sección Series.», como orientación al usuario.

`App` selecciona este componente al acceder a `/settings`, y la cabecera común ofrece el enlace de navegación a esa ruta. La selección de carpeta y el guardado de su ruta se explican en [Series](series.md).

## Componentes y estilos

`HuexPageHeader` presenta el título siguiendo el estilo compartido de las páginas. Las clases `huex-container`, `empty-state` y `huex-description`, definidas en `src/css/HuexStyles.css`, organizan el contenido, el espacio del mensaje y su texto descriptivo.

MkDocs genera la página de código desde `Settings.jsx` y observa el archivo durante la consulta local para reflejar sus cambios.
