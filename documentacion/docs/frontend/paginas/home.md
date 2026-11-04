# Home

[Frontend](../README.md) · [App y rutas](../app.md) · [Código TSX](../../codigo/Home.md)

`src/pages/Home.tsx` presenta la biblioteca principal en la ruta `/`. Muestra el título «Mi biblioteca», una descripción y tres tarjetas para acceder a películas, series y música.

## Organización

| Bloque | Responsabilidad |
| --- | --- |
| Secciones de biblioteca | Definir el contenido y destino de las tarjetas. |
| Navegación | Obtener la función de React Router y abrir la sección seleccionada. |
| Renderizado | Mostrar la cabecera y construir las tarjetas. |

## Datos de las secciones

`librarySections` es una lista definida en el mismo archivo, antes del componente. Cada entrada contiene `nombre`, `path`, `theme` y, cuando se proporciona una imagen propia, `urlImagen`.

| Nombre | Ruta | Tema | Imagen |
| --- | --- | --- | --- |
| Películas | `/movies` | `movies` | `/default-film-horizontal.png` |
| Series | `/series` | `series` | Imagen predeterminada horizontal de HuexCard. |
| Música | `/music` | `music` | `/default-music-horizontal.png` |

El orden de las entradas establece el orden de las tarjetas. La ruta también sirve como `key` para identificar cada tarjeta en React.

## Funciones y navegación

### Home()

Construye la página con `HuexPageHeader` y una cuadrícula de `HuexCard`. La cabecera recibe `title="Mi biblioteca"` y `outlinedTitle` para aplicar el contorno del título.

`useNavigate()` obtiene la función `navigate` de React Router. Home se renderiza dentro del enrutador definido en App y utiliza esa función para cambiar de sección.

### openSection(path)

Recibe la ruta de la tarjeta seleccionada y llama a `navigate(path)`. El evento `onClick` de cada tarjeta pasa su `item.path` a esta función. App muestra después la página correspondiente a la nueva ruta.

## Construcción de las tarjetas

`librarySections.map` crea una tarjeta por entrada. Cada `HuexCard` recibe:

| Propiedad | Valor y uso |
| --- | --- |
| `item` | Datos de la sección, incluidos su nombre y su imagen. |
| `variant` | `horizontal`, para presentar el acceso en formato apaisado. |
| `theme` | Tema de la sección para las reglas visuales de la tarjeta. |
| `onClick` | Abre la ruta de la sección mediante `openSection`. |

La representación de la imagen y del título corresponde a [HuexCard](../componentes/huex-card.md).

## Estilos

`huex-container` organiza el contenido de la página. `huex-description` da estilo al texto de presentación y `huex-grid huex-home-grid` distribuye las tarjetas.

Las reglas compartidas están en `src/css/HuexStyles.css` y los estilos de tarjeta en `src/css/HuexCard.css`. Las reglas de la cuadrícula adaptan las columnas al ancho de pantalla; las reglas de los temas de Home aplican los colores de interacción de películas, series y música.

MkDocs genera el código de referencia desde `Home.tsx` y observa el archivo durante la consulta local para reflejar sus cambios.
