# Tamaño de las carátulas

[Frontend](../README.md) · [Selector](../../codigo/LibraryCardSizeSelector.md) · [Hook](../../codigo/LibraryDensity.md)

El header general muestra un slider al visitar Series o Películas con tres posiciones: **Compacto, Medio y Amplio**. Comparte la zona central con el botón de pantalla completa, separado mediante un borde vertical y espacio entre controles. Solo cambia el tamaño de las tarjetas y cuántas caben en el carrusel. Los contenedores mantienen todo el ancho disponible y sus espacios permanecen fijos. La selección predeterminada es Compacto.

## LibraryCardSizeSelector

El componente se encuentra en `src/components/LibraryCardSizeSelector.tsx`. Los separadores con títulos centrados distinguen **Propiedades del selector**, **Selector de tamaño**, **Cambio de tamaño**, **Iconos de las opciones** y **Renderizado del selector**. Los comentarios existentes se conservan.

### Propiedades y retornos tipados

`LibraryCardSizeSelectorProps` contiene `value: number`, tamaño actual, y `onChange: (value: number) => void`, que comunica el nuevo tamaño al estado compartido de App.

| Función | Entradas | Retorno |
| --- | --- | --- |
| `LibraryCardSizeSelector` | `props: LibraryCardSizeSelectorProps`. | `React.JSX.Element`, selector completo. |
| `handleChange` | `event: React.ChangeEvent<HTMLInputElement>`. | `void`, comunica la nueva preferencia. |
| `renderSizeIcon` | `size: number`, `name: string` y `columns: number`. | `React.JSX.Element`, botón con su icono SVG. |

`size` es el valor comunicado al pulsar el icono; `name` identifica la opción mediante su tooltip y etiqueta accesible. `columns` controla la cantidad de columnas de la cuadrícula, que tiene dos filas. El ancho de las celdas se calcula restando las separaciones fijas y repartiendo el espacio entre las columnas.

### Cambio y presentación del tamaño

Recibe `value` y `onChange`. Presenta un input de rango con posiciones 0, 1 y 2, correspondientes a Compacto, Medio y Amplio. `handleChange` las convierte en los valores guardados 100, 50 y 0. El control incluye la etiqueta accesible «Tamaño de las carátulas», anuncia el nombre de la posición y admite teclado.

Las tres posiciones se identifican con iconos de tarjetas en lugar de texto visible. `renderSizeIcon` dibuja cuatro, tres o dos columnas para representar Compacto, Medio y Amplio. El icono seleccionado se resalta en verde. Cada icono es un botón que permite seleccionar directamente ese tamaño, ofrece su nombre mediante `title` y comunica su selección con `aria-pressed`.

`Header` consulta la ruta con `useLocation` y elige el estado de Series o Películas que recibe de App. En escritorio, la zona central agrupa el slider y pantalla completa. Hasta 900 píxeles, la marca, los controles centrales y la navegación ocupan filas propias para evitar solapamientos.

## useLibraryDensity

El hook se encuentra en `src/hooks/useLibraryDensity.ts` y App lo importa desde esa carpeta.

El archivo utiliza separadores con títulos centrados. Sus bloques son **Tipos de densidad**, **Lectura de preferencias** y **Densidad de biblioteca**. Dentro del hook distingue estados, cambio de resolución, guardado de preferencias, cálculo de columnas y resultado.

### Parámetros y retornos tipados

| Función | Parámetro | Retorno |
| --- | --- | --- |
| `readDensity` | `storageKey: string`, clave de almacenamiento de la sección. | `number`, ajustado a 0, 50 o 100. |
| `useLibraryDensity` | `storageKey: string`, clave para leer y guardar la preferencia. | `LibraryDensityState`, estado compartido y estilos. |
| `updateViewportWidth` | Se ejecuta cuando cambia el ancho de ventana. | `void`, actualiza el estado de ancho. |

`LibraryDensityState` describe `density`, `setDensity` y `densityStyle`. El setter utiliza `Dispatch<SetStateAction<number>>` de React, de modo que acepta un valor nuevo o una función que lo calcula a partir del anterior.

`LibraryDensityStyle` combina `CSSProperties` de React con la variable CSS `--library-columns` de tipo numérico. Estas definiciones permiten consultar los parámetros, propiedades y resultados desde el editor.

### Recuperación de la preferencia

Recibe la clave de almacenamiento de la página. `readDensity` recupera el valor guardado y lo ajusta a la opción más cercana: 0, 50 o 100. Esto conserva las preferencias del antiguo slider. Si falta o falla el almacenamiento, usa 100.

### Estados y efectos

El hook mantiene `density` y el ancho de ventana. Un efecto registra `resize`, actualiza el ancho mediante `updateViewportWidth` y retira el listener al desmontar. Otro efecto guarda la preferencia en `localStorage`; si el navegador impide escribirla, la selección se conserva en memoria durante esa visita.

### Cálculo y resultado

`normalColumns` representa Amplio y `compactColumns` representa Compacto. `factor = density / 100` vale 0, 0.5 o 1. La fórmula `Math.round(normalColumns + (compactColumns - normalColumns) * factor)` obtiene las columnas de la opción seleccionada.

Devuelve `density`, `setDensity` y `densityStyle`. Este último contiene únicamente `--library-columns`, calculado según el ancho de ventana y la selección.

| Ancho de ventana | Amplio | Medio | Compacto |
| --- | --- | --- | --- |
| Hasta 600 px | 1 | 2 | 3 |
| 601–900 px | 2 | 3 | 4 |
| 901–1023 px | 3 | 4 | 5 |
| 1024–1440 px | 4 | 5 | 6 |
| 1441–1920 px | 6 | 7 | 8 |
| Desde 1921 px | 6 | 8 | 10 |

Las reglas de `huex-density-library` en `HuexStyles.css` mantienen fijos el ancho del contenedor, los rellenos y las separaciones. Las carátulas conservan su proporción al variar el ancho de las tarjetas.

## Integración

App llama al hook con `huex-series-density` y `huex-movies-density`. Pasa ambas preferencias y sus setters a Header y entrega el `densityStyle` correspondiente a cada página. Al mover el slider, cambia el estado compartido en App y se actualiza el carrusel de la biblioteca visible. Las preferencias se conservan de forma independiente en ese navegador.

`SeriesCategoryRow` observa tanto la fila como su primera tarjeta con `ResizeObserver`. Cuando cambia el tamaño de las tarjetas, vuelve a calcular su paso y las columnas, conserva la posición en la lista y recoloca las copias del carrusel.
