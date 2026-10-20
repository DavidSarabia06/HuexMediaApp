# Frontend

[Inicio de la documentación](../README.md)

Referencia de los componentes React: sus propiedades, las decisiones que toman al renderizar, los eventos y los estilos que utilizan.

## Aplicación

[App: estructura, rutas, estado compartido y temas](app.md) · [Código JSX](../codigo/App.md)

## Páginas

| Página | Funcionamiento | Código |
| --- | --- | --- |
| Home | [Biblioteca y accesos a las secciones](paginas/home.md) | [JSX](../codigo/Home.md) |
| Movies | [Creación de categorías y subcategorías](paginas/movies.md) | [JSX](../codigo/MoviesPage.md) |
| Series | [Biblioteca, categorías y progreso](paginas/series.md) | [JSX](../codigo/SeriesPage.md) |
| SeriesDetail | [Temporadas, episodios y continuación](paginas/series-detail.md) | [JSX](../codigo/SeriesDetail.md) |
| VideoPlayer | [Reproducción, pistas, controles y progreso](paginas/video-player.md) | [JSX](../codigo/VideoPlayer.md) |
| Settings | [Página de configuración](paginas/settings.md) | [JSX](../codigo/Settings.md) |

## Módulos

| Módulo | Funcionamiento | Código |
| --- | --- | --- |
| subtitles | [Interpretación de WebVTT, texto activo y pistas](modulos/subtitles.md) | [JavaScript](../codigo/Subtitles.md) |
| playbackProgress | [Muestras, envíos y continuar viendo](modulos/playback-progress.md) | [JavaScript](../codigo/PlaybackProgressClient.md) |

## Componentes reutilizables

| Componente | Funcionamiento | Código | Estilos |
| --- | --- | --- | --- |
| Header | [Navegación y pantalla completa](componentes/header.md) | [JSX](../codigo/Header.md) | [CSS](../codigo/HeaderStyles.md) |
| HuexCard | [Tarjetas de series, temporadas y episodios](componentes/huex-card.md) | [JSX](../codigo/HuexCard.md) | [CSS](../codigo/HuexCardStyles.md) |
| HuexCardMenu | [Menú de acciones de tarjetas](componentes/huex-card-menu.md) | [JSX](../codigo/HuexCardMenu.md) | Comparte las reglas de menús de categorías y de HuexCard. |
| SeriesCategoryRow | [Carrusel y acciones de categoría](componentes/series-category-row.md) | [JSX](../codigo/SeriesCategoryRow.md) | Reglas de filas en HuexStyles.css y tarjetas en HuexCard.css. |

Las páginas de código se generan desde los archivos del proyecto al construir la documentación. Los cambios en los archivos registrados también actualizan la vista durante la consulta local.
