import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import HuexCard from './HuexCard';

const ANIMATION_DURATION = 1500;
// El carrusel repite la lista cinco veces y vuelve a la copia central al terminar el movimiento.
const CENTER_COPY = 2;
const SERIES_DRAG_TYPE = 'application/x-huex-series';

/** Mantiene el índice dentro de la lista, incluso al retroceder desde la primera posición. */
function modulo(value, length) {
    return ((value % length) + length) % length;
}

/**
 * @typedef {Object} CategoryRowItem
 * @property {string} rutaCompleta Ruta del elemento, usada como identificador y en el arrastre.
 * @property {string} nombre Título de la tarjeta.
 * @property {string} [urlImagen] Imagen de la tarjeta.
 * @property {import('./HuexCard').EpisodeProgress|null} [playbackProgress] Progreso mostrado en tarjetas horizontales.
 * @property {boolean} [nextEpisode] Indica que se ofrece el siguiente episodio en lugar de uno empezado.
 */

/**
 * @typedef {Object} SeriesCategoryRowProps
 * @property {string} title Título de la fila.
 * @property {CategoryRowItem[]} series Elementos que se muestran en la fila.
 * @property {(item: CategoryRowItem) => void} onSelectSeries Acción al pulsar una tarjeta.
 * @property {string} [categoryId] Categoría de destino; una cadena vacía representa «Sin categoría».
 * @property {{id: string, name: string}[]} [categories] Destinos disponibles en el menú de mover.
 * @property {(seriesPath: string, categoryId: string) => void} [onMoveSeries] Solicita mover una serie.
 * @property {(item: CategoryRowItem) => void} [onResetSeries] Abre la confirmación de reinicio.
 * @property {(category: {id: string, name: string}) => void} [onDeleteCategory] Abre la confirmación de eliminación.
 * @property {string} [cardVariant] Formato de las tarjetas; vertical por defecto.
 * @property {boolean} [showHeader] Muestra la cabecera de la fila; se puede ocultar dentro de una categoría con título propio.
 */

/**
 * Muestra una fila de tarjetas con desplazamiento circular y acciones de categoría.
 * @param {SeriesCategoryRowProps} props Propiedades de la fila.
 */
function SeriesCategoryRow(props) {
    const {
        title,
        series,
        onSelectSeries,
        categoryId = '',
        categories = [],
        onMoveSeries,
        onResetSeries,
        onDeleteCategory,
        cardVariant = 'vertical',
        showHeader = true,
        typeVariant = 'serie'
    } = props;

    const rowRef = useRef(null);
    const sectionRef = useRef(null);
    const rowId = useId();

    // Las medidas y el índice visible determinan qué copias del carrusel son interactivas.
    // step es el ancho de una tarjeta más su separación; columns es la tanda visible.
    const [layout, setLayout] = useState({ step: 0, columns: 0 });
    const [visibleStart, setVisibleStart] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const metricsRef = useRef({ step: 0, columns: 0, loop: false });
    const seriesPositionRef = useRef(0);

    // Las referencias permiten controlar cada fotograma sin esperar a un renderizado.
    const animationFrameRef = useRef(null);
    const animationActiveRef = useRef(false);
    const scrollSettleTimerRef = useRef(null);

    const [isDropTarget, setIsDropTarget] = useState(false);
    const suppressClickUntilRef = useRef(0);

    // Este menú pertenece a la cabecera; las tarjetas utilizan HuexCardMenu.
    const [categoryMenu, setCategoryMenu] = useState(null);
    const categoryMenuRef = useRef(null);

    const canLoop = series.length > (layout.columns || 1);

    // --------------------------- Medición del carrusel ---------------------------

    // Al montar o cambiar series/canLoop, prepara la medición inicial y observa el tamaño de la fila.
    // La limpieza cancela fotogramas y temporizadores pendientes y desconecta el observador.
    useEffect(() => {
        const row = rowRef.current;
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
            window.cancelAnimationFrame(animationFrameRef.current);
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
        return () => {
            window.cancelAnimationFrame(frame);
            window.cancelAnimationFrame(animationFrameRef.current);
            window.clearTimeout(scrollSettleTimerRef.current);
            animationActiveRef.current = false;
            observer.disconnect();
        };
    }, [series, canLoop]);

    // ------------------------ Animación y desplazamiento -------------------------

    /** Vuelve a la copia central mostrando las mismas tarjetas, sin animar ese reajuste. */
    function normalizePosition() {
        const row = rowRef.current;
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
        window.cancelAnimationFrame(animationFrameRef.current);
        animationActiveRef.current = false;
        setIsAnimating(false);
        normalizePosition();
    }

    /** Actualiza las tarjetas visibles y reajusta la posición cuando termina el scroll manual. */
    function handleScroll() {
        const row = rowRef.current;
        const { step } = metricsRef.current;
        if (!row || !step || animationActiveRef.current) {
            return;
        }
        setVisibleStart(Math.floor(row.scrollLeft / step + 0.001));
        window.clearTimeout(scrollSettleTimerRef.current);
        scrollSettleTimerRef.current = window.setTimeout(normalizePosition, 150);
    }

    /** Avanza o retrocede una tanda completa durante 1,5 segundos. */
    function scrollRow(direction) {
        const row = rowRef.current;
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
        function animate(now) {
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
    function handleRowKeyDown(event) {
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
    function acceptsDrag(event) {
        return Boolean(onMoveSeries) && Array.from(event.dataTransfer.types).includes(SERIES_DRAG_TYPE);
    }

    /** Autoriza soltar una serie sobre la fila y activa el resaltado de destino. */
    function handleDragOver(event) {
        if (!acceptsDrag(event)) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setIsDropTarget(true);
    }

    /** Quita el resaltado al salir de la sección, pero lo conserva al pasar entre sus elementos. */
    function handleDragLeave(event) {
        const remainsInside = event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget);
        if (!remainsInside) {
            setIsDropTarget(false);
        }
    }

    /** Lee la ruta arrastrada y solicita al padre moverla a la categoría de esta fila. */
    function handleDrop(event) {
        setIsDropTarget(false);
        if (!acceptsDrag(event)) {
            return;
        }
        event.preventDefault();
        const seriesPath = event.dataTransfer.getData(SERIES_DRAG_TYPE);
        if (seriesPath) {
            onMoveSeries(seriesPath, categoryId);
        }
    }

    /** Guarda la ruta en el arrastre y bloquea la apertura de la tarjeta mientras se está moviendo. */
    function handleSeriesDragStart(event, serie) {
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
    function handleSelectSeries(serie, clickTime) {
        if (clickTime >= suppressClickUntilRef.current) {
            onSelectSeries(serie);
        }
    }

    /** Construye las acciones disponibles de la tarjeta y el submenú de destinos para moverla. */
    function getSeriesMenuItems(serie) {
        const menuItems = [];
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

    // ----------------------------- Menú de categoría -----------------------------

    // Al abrir el menú de cabecera, enfoca su opción y registra los cierres por clic exterior, scroll y resize.
    // Al cerrarlo o desmontar la fila, retira los manejadores registrados.
    useEffect(() => {
        if (!categoryMenu) {
            return;
        }
        const panel = categoryMenuRef.current;
        const initialOption = panel?.querySelector('[aria-checked="true"]') ??
            panel?.querySelector('[role="menuitem"], [role="menuitemradio"]');
        initialOption?.focus({ preventScroll: true });

        /** Cierra al pulsar fuera del menú y del botón que lo abrió. */
        function dismissOutside(event) {
            const isInsideMenu = event.target instanceof Node &&
                (panel?.contains(event.target) || categoryMenu.anchor.contains(event.target));
            if (isInsideMenu) {
                return;
            }
            setCategoryMenu(null);
        }
        /** Cierra si cambia la ventana o se desplaza el exterior, permitiendo el scroll dentro del menú. */
        function dismissOnScroll(event) {
            if (event.target instanceof Node && panel?.contains(event.target)) {
                return;
            }
            setCategoryMenu(null);
        }
        document.addEventListener('pointerdown', dismissOutside, true);
        document.addEventListener('scroll', dismissOnScroll, true);
        window.addEventListener('resize', dismissOnScroll);
        return () => {
            document.removeEventListener('pointerdown', dismissOutside, true);
            document.removeEventListener('scroll', dismissOnScroll, true);
            window.removeEventListener('resize', dismissOnScroll);
        };
    }, [categoryMenu]);

    /** Cierra el menú y devuelve el foco a su botón, o a la sección si ese botón ya no existe. */
    function closeCategoryMenu(restoreFocus = true) {
        const anchor = categoryMenu?.anchor;
        setCategoryMenu(null);
        if (restoreFocus) {
            window.requestAnimationFrame(() => {
                const focusTarget = anchor?.isConnected ? anchor : sectionRef.current;
                focusTarget?.focus({ preventScroll: true });
            });
        }
    }

    /** Alterna el menú de cabecera y calcula su posición y altura disponible junto al botón. */
    function toggleCategoryMenu(event) {
        event.stopPropagation();
        if (categoryMenu) {
            closeCategoryMenu();
            return;
        }
        const anchor = event.currentTarget;
        const rect = anchor.getBoundingClientRect();
        const width = Math.min(260, window.innerWidth - 24);
        const below = window.innerHeight - rect.bottom - 20;
        const above = rect.top - 20;
        const openBelow = below >= 160 || below >= above;
        const maxHeight = Math.max(40, Math.min(340, openBelow ? below : above));
        setCategoryMenu({
            anchor,
            style: {
                '--huex-accent': window.getComputedStyle(anchor).getPropertyValue('--huex-accent'),
                width,
                maxHeight,
                left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
                top: Math.max(12, openBelow ? rect.bottom + 8 : rect.top - Math.min(maxHeight, 90) - 8)
            }
        });
    }

    /** Cierra con Escape/Tab y recorre las opciones con las flechas, Home y End. */
    function handleCategoryMenuKeyDown(event) {
        if (event.key === 'Escape' || event.key === 'Tab') {
            event.preventDefault();
            closeCategoryMenu();
            return;
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const options = Array.from(categoryMenuRef.current.querySelectorAll(
                '[role="menuitem"], [role="menuitemradio"]'
            ));
            const currentIndex = options.indexOf(document.activeElement);
            let nextIndex;
            if (event.key === 'Home') {
                nextIndex = 0;
            } else if (event.key === 'End') {
                nextIndex = options.length - 1;
            } else {
                const direction = event.key === 'ArrowDown' ? 1 : -1;
                nextIndex = modulo(currentIndex + direction, options.length);
            }
            options[nextIndex]?.focus();
        }
    }

    /** Cierra sin recuperar el foco y solicita al padre la confirmación de eliminación. */
    function handleDeleteCategory() {
        // El diálogo de confirmación se encarga del foco al abrirse.
        closeCategoryMenu(false);
        onDeleteCategory({ id: categoryId, name: title });
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
                <h3 className="huex-title">{title}</h3>
                <span className="series-category-count">{series.length}</span>
                {categoryId && onDeleteCategory && <button type="button" className="series-category-options category-header-options"
                    aria-label={`Opciones de la categoría ${title}`} aria-haspopup="menu"
                    aria-expanded={Boolean(categoryMenu)} aria-controls={categoryMenu ? `${rowId}-menu` : undefined}
                    onClick={toggleCategoryMenu}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                        <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
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
            {/* El menú de cabecera se dibuja fuera del carrusel para evitar recortes. */}
            {categoryMenu && createPortal(
                <div ref={categoryMenuRef} id={`${rowId}-menu`} role="menu" className="series-category-menu"
                    aria-label={`Opciones de la categoría ${title}`} style={categoryMenu.style}
                    onKeyDown={handleCategoryMenuKeyDown}>
                    <div className="series-category-menu-title">Opciones de la categoría</div>
                    <button type="button" role="menuitem" tabIndex={-1} onClick={handleDeleteCategory}>Eliminar categoría</button>
                </div>, document.body
            )}
        </section>
    );
}

export default SeriesCategoryRow;
