# Documentación de Huex Media App

La documentación se organiza por sistemas del servidor y componentes del frontend. Cada apartado explica su funcionamiento y enlaza al código del proyecto.

## Sistemas

- [Categorías de series](sistemas/categorias-series/README.md): organización de series, asignaciones y persistencia por biblioteca.
- [Configuración](sistemas/configuracion/README.md): consulta y actualización de los ajustes de la aplicación.
- [Exploración de series](sistemas/series/README.md): selección de carpetas, series, episodios e imágenes locales.
- [Reproducción de vídeo](sistemas/reproduccion-video/README.md): análisis, audio, subtítulos, sesiones HLS y limpieza de temporales.

- [Progreso de reproducción](sistemas/progreso-reproduccion/README.md): episodios vistos, posición guardada, marcas manuales, reinicio y continuar viendo.

## Frontend

- [Componentes del frontend](frontend/README.md): referencia de los componentes React y sus estilos.
- [HuexCard](frontend/componentes/huex-card.md): tarjetas, imágenes, progreso y menú de estado.

## Cómo consultar la documentación

En la web local, el menú lateral permite entrar en cada sistema y componente. Dentro del servicio, el índice de la página enlaza a cada función. El buscador también encuentra nombres de métodos y términos de las explicaciones. Puedes alternar entre tema claro y oscuro con el botón del encabezado.

Abre el sistema, selecciona su servicio y pulsa el nombre de la función en el índice. Cada ficha describe sus entradas, resultado, llamadas internas y errores. Los enlaces al código permiten comparar la explicación con la implementación.
