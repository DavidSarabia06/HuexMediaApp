# Frontend

[Inicio de la documentación](../README.md)

Referencia de los componentes React: sus propiedades, las decisiones que toman al renderizar, los eventos y los estilos que utilizan.

## Aplicación

[App: estructura, rutas, estado compartido y temas](app.md) · [Código TSX](../codigo/App.md)

## Páginas

| Página | Funcionamiento | Código |
| --- | --- | --- |
| Home | [Biblioteca y accesos a las secciones](paginas/home.md) | [TSX](../codigo/Home.md) |
| Movies | [Creación de categorías y subcategorías](paginas/movies.md) | [TSX](../codigo/MoviesPage.md) |
| Series | [Biblioteca, categorías y progreso](paginas/series.md) | [TSX](../codigo/SeriesPage.md) |
| SeriesDetail | [Temporadas, episodios y continuación](paginas/series-detail.md) | [TSX](../codigo/SeriesDetail.md) |
| VideoPlayer | [Reproducción, pistas, controles y progreso](paginas/video-player.md) | [TSX](../codigo/VideoPlayer.md) |
| Settings | [Página de configuración](paginas/settings.md) | [TSX](../codigo/Settings.md) |

## Hooks

[useLibraries](hooks/use-libraries.md) gestiona la selección, carga y formularios de bibliotecas.

[useCategories](hooks/use-categories.md) gestiona categorías, subcategorías, asignaciones, ordenación y sus formularios.

## API

[Peticiones de bibliotecas y categorías](modulos/library-category-api.md) · [librariesApi](../codigo/LibrariesApi.md) · [categoriesApi](../codigo/CategoriesApi.md)

## Módulos

| Módulo | Funcionamiento | Código |
| --- | --- | --- |
| categoryUtils | [Peticiones, elementos y destinos de categorías](modulos/category-utils.md) | [TypeScript](../codigo/CategoryUtils.md) |
| libraryUtils | [Consultas y biblioteca recordada](modulos/library-utils.md) | [TypeScript](../codigo/LibraryUtils.md) |
| generalUtils | [Respuestas HTTP, rutas y tiempos](modulos/general-utils.md) | [TypeScript](../codigo/GeneralUtils.md) |
| subtitles | [Interpretación de WebVTT, texto activo y pistas](modulos/subtitles.md) | [TypeScript](../codigo/Subtitles.md) |
| playbackProgress | [Muestras, envíos y continuar viendo](modulos/playback-progress.md) | [TypeScript](../codigo/PlaybackProgressClient.md) |

## Componentes reutilizables

| Componente | Funcionamiento | Código | Estilos |
| --- | --- | --- | --- |
| LibraryCardSizeSelector | [Densidad visual de Series y Películas](componentes/library-density.md) | [TSX](../codigo/LibraryCardSizeSelector.md) · [Hook](../codigo/LibraryDensity.md) | HuexStyles.css |
| Header | [Navegación y pantalla completa](componentes/header.md) | [TSX](../codigo/Header.md) | [CSS](../codigo/HeaderStyles.md) |
| HuexCard | [Tarjetas de series, temporadas y episodios](componentes/huex-card.md) | [TSX](../codigo/HuexCard.md) | [CSS](../codigo/HuexCardStyles.md) |
| HuexCardMenu | [Menú de acciones de tarjetas](componentes/huex-card-menu.md) | [TSX](../codigo/HuexCardMenu.md) | Comparte las reglas de menús de categorías y de HuexCard. |
| Diálogos | [Formularios compartidos](componentes/dialogs.md) | [TSX](../codigo/Dialogs.md) | HuexStyles.css |
| SeriesCategoryRow | [Carrusel y acciones de categoría](componentes/series-category-row.md) | [TSX](../codigo/SeriesCategoryRow.md) | Reglas de filas en HuexStyles.css y tarjetas en HuexCard.css. |

Las páginas de código se generan desde los archivos del proyecto al construir la documentación. Los cambios en los archivos registrados también actualizan la vista durante la consulta local.

## Organización de src

- `pages/`: páginas asociadas a rutas: Home, Series, SeriesDetail, Movies, VideoPlayer y Settings.
- `components/`: componentes utilizados por las páginas: Header, HuexPageHeader, HuexCard, HuexCardMenu, SeriesCategoryRow, LibraryCardSizeSelector, Icons y los diálogos compartidos.
- `hooks/`: hooks compartidos, como `useLibraryDensity.ts`.
- `api/`: peticiones HTTP de bibliotecas y categorías.
- `utils/`: transformación de datos, selección recordada, interpretación de subtítulos y funciones de progreso.
- `css/`: estilos de las páginas y componentes.

`App.tsx` y `main.tsx` permanecen en la raíz. App conecta las rutas con las páginas y conserva el estado compartido. `useLibraryDensity.ts` se encuentra en `hooks/` y `subtitles.ts` en `utils/`.

Las importaciones relativas y los tipos TypeScript apuntan a estas carpetas. MkDocs utiliza las mismas ubicaciones para generar las páginas de código y observar cambios.

## TypeScript

El frontend utiliza `.tsx` para componentes y páginas con JSX y `.ts` para utilidades y hooks. Los tipos se declaran con `interface`, `type`, parámetros y retornos nativos de TypeScript. Los comentarios explican los datos, eventos y decisiones de cada función.

`tsconfig.json` activa la comprobación estricta y el compilador comprueba el proyecto antes de generar la publicación. ESLint analiza también los archivos TypeScript.

Desde `huexmediaapp.client`:

```text
npm run typecheck
npm run lint
npm run build
```

Movies y Series utilizan ambos hooks y conservan el dibujado y sus acciones de navegación y progreso. Series mantiene además el reinicio de serie.
