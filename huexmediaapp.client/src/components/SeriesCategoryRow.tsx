import { useEffect, useId, useRef, useState } from 'react';
import HuexCard from './HuexCard';

const ANIMATION_DURATION = 1500;
// El carrusel repite la lista cinco veces y vuelve a la copia central al terminar el movimiento.
const CENTER_COPY = 2;
const SERIES_DRAG_TYPE = 'application/x-huex-series';

/** Mantiene el índice dentro de la lista, incluso al retroceder desde la primera posición. */
function modulo(value: number, length: number) {
    return ((value % length) + length) % length;
}

export interface CategoryRowItem {
    /** Ruta del elemento, usada como identificador y en el arrastre. */
    rutaCompleta: string;
    /** Título de la tarjeta. */
    nombre: string;

    /** Episodio clave. */
    isKey?: boolean;
    /** Imagen de la tarjeta. */
    urlImagen?: string;
    /** Progreso mostrado en tarjetas horizontales. */
    playbackProgress?: import('./HuexCard').EpisodeProgress|null;
    /** Indica que se ofrece el siguiente episodio en lugar de uno empezado. */
    nextEpisode?: boolean;
}

export interface SeriesCategoryRowProps<T extends CategoryRowItem = CategoryRowItem> {
    /** Título de la fila. */
    title: string;
    typeVariant?: string;
    /** Elementos que se muestran en la fila. */
    series: T[];
    /** Acción al pulsar una tarjeta. */
    onSelectSeries: (item: T) => void;
    /** Categoría de destino; una cadena vacía representa «Sin categoría». */
    categoryId?: string;
    /** Destinos disponibles en el menú de mover. */
    categories?: {id: string, name: string}[];
    /** Solicita mover una serie. */
    onMoveSeries?: (seriesPath: string, categoryId: string) => void;
    /** Abre la confirmación de reinicio. */
    onResetSeries?: (item: T) => void;
    /** Abre la confirmación de eliminación. */
    onDeleteCategory?: (category: {id: string, name: string}) => void;
    /** Abre el editor del nombre al pulsar dos veces el título. */
    onRenameCategory?: (category: {id: string, name: string}) => void;
    /** Formato de las tarjetas; vertical por defecto. */
    cardVariant?: string;
    /** Muestra la cabecera de la fila; se puede ocultar dentro de una categoría con título propio. */
    showHeader?: boolean;
    /** Retira una tarjeta de esta sección. */
    onRemoveItem?: (item: T) => void;
    /** Deshabilita las acciones de las tarjetas. */
    actionsDisabled?: boolean;
}

/**
 * Muestra una fila de tarjetas con desplazamiento circular y acciones de categoría.
 * @param props Propiedades de la fila.
 */
function SeriesCategoryRow<T extends CategoryRowItem>(props: SeriesCategoryRowProps<T>) {
    const {
        title,
        series,
        onSelectSeries,
        categoryId = '',
        categories = [],
        onMoveSeries,
        onResetSeries,
        onDeleteCategory,
        onRenameCategory,
        cardVariant = 'vertical',
        showHeader = true,
        typeVariant = 'serie',
        onRemoveItem,
        actionsDisabled = false
    } = props;

    const rowRef = useRef<HTMLDivElement>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const rowId = useId();

    // Las medidas y el índice visible determinan qué copias del carrusel son interactivas.
    // step es el ancho de una tarjeta más su separación; columns es la tanda visible.
    const [layout, setLayout] = useState({ step: 0, columns: 0 });
    const [visibleStart, setVisibleStart] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const metricsRef = useRef({ step: 0, columns: 0, loop: false });
    const seriesPositionRef = useRef(0);

    // Las referencias permiten controlar cada fotograma sin esperar a un renderizado.
    const animationFrameRef = useRef<number | null>(null);
    const animationActiveRef = useRef(false);
    const scrollSettleTimerRef = useRef<number | undefined>(undefined);

    const [isDropTarget, setIsDropTarget] = useState(false);
    const suppressClickUntilRef = useRef(0);


    const canLoop = series.length > (layout.columns || 1);

    // --------------------------- Medición del carrusel ---------------------------

    // Al montar o cambiar series/canLoop, prepara la medición inicial y observa el tamaño de la fila.
    // La limpieza cancela fotogramas y temporizadores pendientes y desconecta el observador.
    useEffect(() => {
        const row = rowRef.current!;
        if (!row) {
            return;
        }
        let measured = false;

        /** Lee columnas y tamaños del CSS y recoloca la fila conservando su posición en la lista. */
        function measure() {
            const style = window.getComputedStyle(row);
            const columns = Number.parseInt(style.getPropertyValue('--series-columns'), 10) || 5;
            const loop = series.length > columns;
            const card = row.querySelector('.series-category-card');
            if (!card) {
                return;
            }
            const gap = Number.parseFloat(style.columnGap) || 0;
            const step = card.getBoundingClientRect().width + gap;
            const previousMetrics = metricsRef.current;
            // El hover y las imágenes pueden cambiar la altura. Eso no debe
            // cancelar el desplazamiento ni volver a posicionar la fila.
            const measurementsUnchanged = measured &&
                previousMetrics.columns === columns &&
                previousMetrics.loop === loop &&
                Math.abs(previousMetrics.step - step) < 0.1;
            if (measurementsUnchanged) {
                return;
            }
            window.cancelAnimationFrame(animationFrameRef.current ?? 0);
            window.clearTimeout(scrollSettleTimerRef.current);
            animationActiveRef.current = false;
            setIsAnimating(false);
            // Primero renderiza las copias necesarias; después mide su ancho real.
            if (loop !== canLoop) {
                setLayout({ step: 0, columns });
                return;
            }
            measured = true;
            metricsRef.current = { step, columns, loop };
            const seriesIndex = modulo(seriesPositionRef.current, series.length);
            const startSlot = loop ? CENTER_COPY * series.length + seriesIndex : 0;
            row.scrollLeft = startSlot * step;
            setVisibleStart(Math.floor(startSlot));
            setLayout(previousLayout => {
                if (previousLayout.step === step && previousLayout.columns === columns) {
                    return previousLayout;
                }
                return { step, columns };
            });
        }

        const frame = window.requestAnimationFrame(measure);
        const observer = new ResizeObserver(measure);
        observer.observe(row);
        // El selector de carátulas puede cambiar las columnas sin cambiar el ancho exterior de la fila.
        // Observamos también una tarjeta para volver a medir su paso y recolocar las copias.
        const firstCard = row.querySelector('.series-category-card');
        if (firstCard) {
            observer.observe(firstCard);
        }
        return () => {
            window.cancelAnimationFrame(frame);
            window.cancelAnimationFrame(animationFrameRef.current ?? 0);
            window.clearTimeout(scrollSettleTimerRef.current);
            animationActiveRef.current = false;
            observer.disconnect();
        };
    }, [series, canLoop]);

    // ------------------------ Animación y desplazamiento -------------------------

    /** Vuelve a la copia central mostrando las mismas tarjetas, sin animar ese reajuste. */
    function normalizePosition() {
        const row = rowRef.current!;
        const { step, loop } = metricsRef.current;
        if (!row || !step || !loop) {
            return;
        }
        let position = row.scrollLeft / step;
        // Evita interpretar un redondeo de píxeles como una vuelta completa.
        if (Math.abs(position - Math.round(position)) * step < 1) {
            position = Math.round(position);
        }
        const relativePosition = modulo(position - CENTER_COPY * series.length, series.length);
        let startSlot = position;
        if (position < CENTER_COPY * series.length || position >= (CENTER_COPY + 1) * series.length) {
            startSlot = CENTER_COPY * series.length + relativePosition;
            row.scrollLeft = startSlot * step;
        }
        seriesPositionRef.current = relativePosition;
        setVisibleStart(Math.floor(startSlot + 0.001));
    }

    /** Cede el desplazamiento al usuario si interactúa durante una animación. */
    function interruptAnimation() {
        if (!animationActiveRef.current) {
            return;
        }
        window.cancelAnimationFrame(animationFrameRef.current ?? 0);
        animationActiveRef.current = false;
        setIsAnimating(false);
        normalizePosition();
    }

    /** Actualiza las tarjetas visibles y reajusta la posición cuando termina el scroll manual. */
    function handleScroll() {
        const row = rowRef.current!;
        const { step } = metricsRef.current;
        if (!row || !step || animationActiveRef.current) {
            return;
        }
        setVisibleStart(Math.floor(row.scrollLeft / step + 0.001));
        window.clearTimeout(scrollSettleTimerRef.current);
        scrollSettleTimerRef.current = window.setTimeout(normalizePosition, 150);
    }

    /** Avanza o retrocede una tanda completa durante 1,5 segundos. */
    function scrollRow(direction: number) {
        const row = rowRef.current!;
        const { step, columns, loop } = metricsRef.current;
        if (!row || !step || !loop || animationActiveRef.current) {
            return;
        }
        window.clearTimeout(scrollSettleTimerRef.current);
        normalizePosition();
        const startPosition = row.scrollLeft;
        const targetPosition = (Math.round(startPosition / step) + direction * columns) * step;
        const duration = ANIMATION_DURATION;
        animationActiveRef.current = true;
        setIsAnimating(true);
        let startedAt;

        /** Calcula y dibuja un fotograma; al llegar al destino, reajusta la copia y termina la animación. */
        function animate(now: number) {
            startedAt ??= now;
            const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
            // Acelera al principio y frena al final para suavizar el desplazamiento.
            const easedProgress = progress < 0.5
                ? 4 * progress ** 3
                : 1 - (-2 * progress + 2) ** 3 / 2;
            row.scrollLeft = startPosition + (targetPosition - startPosition) * easedProgress;
            if (progress < 1) {
                animationFrameRef.current = window.requestAnimationFrame(animate);
            } else {
                normalizePosition();
                animationActiveRef.current = false;
                setIsAnimating(false);
            }
        }
        animationFrameRef.current = window.requestAnimationFrame(animate);
    }

    /** Desplaza una tanda con las flechas cuando el foco está en la fila, sin interceptar sus botones. */
    function handleRowKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (event.target !== event.currentTarget) {
            return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            scrollRow(event.key === 'ArrowLeft' ? -1 : 1);
        }
    }

    // ------------------------------- Drag and drop -------------------------------

    /** Acepta arrastres de series de la aplicación cuando esta fila permite moverlas. */
    function acceptsDrag(event: React.DragEvent<HTMLElement>) {
        return Boolean(onMoveSeries) && Array.from(event.dataTransfer.types).includes(SERIES_DRAG_TYPE);
    }

    /** Autoriza soltar una serie sobre la fila y activa el resaltado de destino. */
    function handleDragOver(event: React.DragEvent<HTMLElement>) {
        if (!acceptsDrag(event)) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setIsDropTarget(true);
    }

    /** Quita el resaltado al salir de la sección, pero lo conserva al pasar entre sus elementos. */
    function handleDragLeave(event: React.DragEvent<HTMLElement>) {
        const remainsInside = event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget);
        if (!remainsInside) {
            setIsDropTarget(false);
        }
    }

    /** Lee la ruta arrastrada y solicita al padre moverla a la categoría de esta fila. */
    function handleDrop(event: React.DragEvent<HTMLElement>) {
        setIsDropTarget(false);
        if (!acceptsDrag(event)) {
            return;
        }
        event.preventDefault();
        const seriesPath = event.dataTransfer.getData(SERIES_DRAG_TYPE);
        if (seriesPath) {
            onMoveSeries?.(seriesPath, categoryId);
        }
    }

    /** Guarda la ruta en el arrastre y bloquea la apertura de la tarjeta mientras se está moviendo. */
    function handleSeriesDragStart(event: React.DragEvent<HTMLElement>, serie: T) {
        if (!onMoveSeries) {
            return;
        }
        // Impide abrir la serie por el clic que puede acompañar al final del arrastre.
        suppressClickUntilRef.current = Infinity;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(SERIES_DRAG_TYPE, serie.rutaCompleta);
    }

    /** Retira el resaltado y mantiene el bloqueo del clic durante 300 ms tras terminar el arrastre. */
    function handleSeriesDragEnd() {
        suppressClickUntilRef.current = Date.now() + 300;
        setIsDropTarget(false);
    }

    // ------------------------- Acciones de las tarjetas --------------------------

    /** Abre el elemento mediante el padre si el clic queda fuera del periodo de bloqueo del arrastre. */
    function handleSelectSeries(serie: T, clickTime: number) {
        if (clickTime >= suppressClickUntilRef.current) {
            onSelectSeries(serie);
        }
    }

    /** Construye las acciones disponibles de la tarjeta y el submenú de destinos para moverla. */
    function getSeriesMenuItems(serie: T) {
        const menuItems: import('./HuexCardMenu').HuexCardMenuItem[] = [];
        if (onMoveSeries) {
            menuItems.push({
                id: 'move',
                label: 'Mover a categoría',
                children: [{ id: '', name: 'Sin categoría' }, ...categories].map(category => ({
                    id: category.id || 'uncategorized',
                    label: category.name,
                    checked: category.id === categoryId,
                    onSelect: () => {
                        if (category.id !== categoryId) {
                            onMoveSeries(serie.rutaCompleta, category.id);
                        }
                    }
                }))
            });
        }
        if (onResetSeries) {
            menuItems.push({
                id: 'reset',
                label: `Reiniciar ${typeVariant}`,
                restoreFocus: false,
                onSelect: () => onResetSeries(serie)
            });
        }
        return menuItems;
    }

    // ------------------------- Eliminación de categoría --------------------------

    /** Solicita al padre la confirmación de eliminación de esta categoría. */
    function handleDeleteCategory() {
        onDeleteCategory?.({ id: categoryId, name: title });
    }
    const copies = canLoop ? [0, 1, 2, 3, 4] : [0];

    return (
        <section className={`series-category${isDropTarget ? ' is-drop-target' : ''}`} ref={sectionRef} tabIndex={-1}
            aria-label={title}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}>
            {/* Cabecera y opciones de la categoría. */}
            {showHeader && <div className="series-category-header">
                <h3 className={`huex-title${onRenameCategory ? ' category-title-editable' : ''}`}
                    onDoubleClick={onRenameCategory ? () => onRenameCategory({ id: categoryId, name: title }) : undefined}
                    tabIndex={onRenameCategory ? 0 : undefined}
                    aria-label={onRenameCategory ? `${title}. Doble clic o F2 para cambiar el nombre` : undefined}
                    onKeyDown={onRenameCategory ? event => {
                        if (event.key === 'F2' || event.key === 'Enter') {
                            event.preventDefault();
                            onRenameCategory({ id: categoryId, name: title });
                        }
                    } : undefined}>{title}</h3>
                <span className="series-category-count">{series.length}</span>
                {categoryId && onDeleteCategory && <button type="button" className="series-category-options category-header-options category-delete-button"
                    aria-label={`Eliminar categoría ${title}`} title="Eliminar categoría"
                    onClick={handleDeleteCategory}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
                    </svg>
                </button>}
            </div>}

            {series.length === 0 ? (
                <p className="series-category-empty">
                    {onMoveSeries ? `Arrastra una ${typeVariant} aquí o utiliza «Mover a…» en una tarjeta.`
                        : `Todavía no hay ${typeVariant}s en esta categoría.`}
                </p>
            ) : (
                <div className={`series-category-carousel${canLoop ? ' is-looping' : ''}`}>
                    {canLoop && <button type="button" className="series-category-arrow series-category-arrow-left"
                        aria-label={`Ver la tanda anterior de ${title}`} aria-controls={rowId}
                        disabled={isAnimating || !layout.step} onClick={() => scrollRow(-1)}>
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="m15 6-6 6 6 6" />
                        </svg>
                    </button>}
                    <div className={`series-category-row${layout.step ? ' is-ready' : ''}`} ref={rowRef} id={rowId}
                            role="region" aria-label={`${typeVariant}s de ${title}`} tabIndex={0}
                        onScroll={handleScroll} onPointerDown={interruptAnimation} onWheel={interruptAnimation}
                        onKeyDown={handleRowKeyDown}>
                        {copies.flatMap(copy => series.map((serie, index) => {
                            const slot = copy * series.length + index;
                            // Solo la tanda visible y su tarjeta parcial son interactivas.
                            const visible = !canLoop || (slot >= visibleStart && slot <= visibleStart + layout.columns);
                            return (
                                <div key={`${copy}-${serie.rutaCompleta}`} className="series-category-card"
                                    inert={!visible || isAnimating} aria-hidden={!visible || isAnimating ? true : undefined}
                                    draggable={Boolean(onMoveSeries) && visible && !isAnimating}
                                    onDragStart={event => handleSeriesDragStart(event, serie)}
                                    onDragEnd={handleSeriesDragEnd}>
                                    <HuexCard
                                        item={serie}
                                        variant={cardVariant}
                                        showPlayButton={cardVariant === 'horizontal'}
                                        progress={serie.nextEpisode ? null : serie.playbackProgress}
                                        menuItems={getSeriesMenuItems(serie)}
                                        menuTitle={`Opciones de la ${typeVariant}`}
                                        onClick={() => handleSelectSeries(serie, Date.now())}
                                        onRemove={onRemoveItem ? () => { onRemoveItem(serie); } : undefined}
                                        removeDisabled={actionsDisabled}
                                    />
                                </div>
                            );
                        }))}
                    </div>
                    {canLoop && <button type="button" className="series-category-arrow series-category-arrow-right"
                        aria-label={`Ver la siguiente tanda de ${title}`} aria-controls={rowId}
                        disabled={isAnimating || !layout.step} onClick={() => scrollRow(1)}>
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="m9 6 6 6-6 6" />
                        </svg>
                    </button>}
                </div>
            )}
        </section>
    );
}

export default SeriesCategoryRow;
