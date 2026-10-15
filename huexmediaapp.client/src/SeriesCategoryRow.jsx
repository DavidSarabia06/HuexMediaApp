import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import HuexCard from './HuexCard';

const ANIMATION_DURATION = 1500;
const CENTER_COPY = 2;
const SERIES_DRAG_TYPE = 'application/x-huex-series';
const modulo = (value, length) => ((value % length) + length) % length;

function SeriesCategoryRow({ title, series, onSelectSeries, categoryId = '', categories = [], onMoveSeries, onResetSeries, onDeleteCategory, cardVariant = 'vertical' }) {
    const rowRef = useRef(null);
    const sectionRef = useRef(null);
    const menuRef = useRef(null);
    const rowId = useId();
    const animationRef = useRef(null);
    const animatingRef = useRef(false);
    const settleTimerRef = useRef(null);
    const positionRef = useRef(0);
    const metricsRef = useRef({ step: 0, columns: 0, loop: false });
    const [layout, setLayout] = useState({ step: 0, columns: 0 });
    const [visibleStart, setVisibleStart] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isDropTarget, setIsDropTarget] = useState(false);
    const [menu, setMenu] = useState(null);
    const suppressClickUntilRef = useRef(0);
    const canLoop = series.length > (layout.columns || 1);

    useEffect(() => {
        if (!menu) return;
        const panel = menuRef.current;
        const initialOption = panel?.querySelector('[aria-checked="true"]') ?? panel?.querySelector('[role="menuitem"], [role="menuitemradio"]');
        initialOption?.focus({ preventScroll: true });

        function dismissOutside(event) {
            if (event.target instanceof Node &&
                (panel?.contains(event.target) || menu.anchor.contains(event.target))) return;
            setMenu(null);
        }
        function dismissOnScroll(event) {
            if (event.target instanceof Node && panel?.contains(event.target)) return;
            setMenu(null);
        }
        document.addEventListener('pointerdown', dismissOutside, true);
        document.addEventListener('scroll', dismissOnScroll, true);
        window.addEventListener('resize', dismissOnScroll);
        return () => {
            document.removeEventListener('pointerdown', dismissOutside, true);
            document.removeEventListener('scroll', dismissOnScroll, true);
            window.removeEventListener('resize', dismissOnScroll);
        };
    }, [menu]);

    function closeMenu(restoreFocus = true) {
        const anchor = menu?.anchor;
        setMenu(null);
        if (restoreFocus) window.requestAnimationFrame(() => {
            (anchor?.isConnected ? anchor : sectionRef.current)?.focus({ preventScroll: true });
        });
    }

    function toggleMenu(event, serie, key, view = 'actions') {
        event.stopPropagation();
        if (menu?.key === key) { closeMenu(); return; }
        const anchor = event.currentTarget;
        const rect = anchor.getBoundingClientRect();
        const width = Math.min(260, window.innerWidth - 24);
        const below = window.innerHeight - rect.bottom - 20;
        const above = rect.top - 20;
        const openBelow = below >= 160 || below >= above;
        const maxHeight = Math.max(40, Math.min(340, openBelow ? below : above));
        const expectedHeight = Math.min(maxHeight, 48 + (categories.length + 1) * 42);
        setMenu({
            key, serie, anchor, view,
            style: {
                '--huex-accent': window.getComputedStyle(anchor).getPropertyValue('--huex-accent'),
                width, maxHeight,
                left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
                top: Math.max(12, openBelow ? rect.bottom + 8 : rect.top - expectedHeight - 8)
            }
        });
    }

    useEffect(() => {
        const row = rowRef.current;
        if (!row) return;
        let measured = false;

        function measure() {
            const style = window.getComputedStyle(row);
            const columns = Number.parseInt(style.getPropertyValue('--series-columns'), 10) || 5;
            const loop = series.length > columns;
            const card = row.querySelector('.series-category-card');
            if (!card) return;
            const gap = Number.parseFloat(style.columnGap) || 0;
            const step = card.getBoundingClientRect().width + gap;
            const previous = metricsRef.current;
            // El hover y las imágenes pueden cambiar la altura. Eso no debe
            // cancelar el desplazamiento ni volver a posicionar la fila.
            if (measured && previous.columns === columns && previous.loop === loop &&
                Math.abs(previous.step - step) < 0.1) return;
            window.cancelAnimationFrame(animationRef.current);
            window.clearTimeout(settleTimerRef.current);
            animatingRef.current = false;
            setIsAnimating(false);
            // Primero renderiza las copias necesarias; después mide su ancho real.
            if (loop !== canLoop) {
                setLayout({ step: 0, columns });
                return;
            }
            measured = true;
            metricsRef.current = { step, columns, loop };
            const index = modulo(positionRef.current, series.length);
            const start = loop ? CENTER_COPY * series.length + index : 0;
            row.scrollLeft = start * step;
            setVisibleStart(Math.floor(start));
            setLayout(previous => previous.step === step && previous.columns === columns
                ? previous : { step, columns });
        }

        const frame = window.requestAnimationFrame(measure);
        const observer = new ResizeObserver(measure);
        observer.observe(row);
        return () => {
            window.cancelAnimationFrame(frame);
            window.cancelAnimationFrame(animationRef.current);
            window.clearTimeout(settleTimerRef.current);
            animatingRef.current = false;
            observer.disconnect();
        };
    }, [series, canLoop]);

    function normalizePosition() {
        const row = rowRef.current;
        const { step, loop } = metricsRef.current;
        if (!row || !step || !loop) return;
        let position = row.scrollLeft / step;
        // Evita interpretar un redondeo de píxeles como una vuelta completa.
        if (Math.abs(position - Math.round(position)) * step < 1) position = Math.round(position);
        const relative = modulo(position - CENTER_COPY * series.length, series.length);
        let start = position;
        if (position < CENTER_COPY * series.length || position >= (CENTER_COPY + 1) * series.length) {
            start = CENTER_COPY * series.length + relative;
            row.scrollLeft = start * step;
        }
        positionRef.current = relative;
        setVisibleStart(Math.floor(start + 0.001));
    }

    function interruptAnimation() {
        if (!animatingRef.current) return;
        window.cancelAnimationFrame(animationRef.current);
        animatingRef.current = false;
        setIsAnimating(false);
        normalizePosition();
    }

    function handleScroll() {
        const row = rowRef.current;
        const { step } = metricsRef.current;
        if (!row || !step || animatingRef.current) return;
        setVisibleStart(Math.floor(row.scrollLeft / step + 0.001));
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = window.setTimeout(normalizePosition, 150);
    }

    function scrollRow(direction) {
        const row = rowRef.current;
        const { step, columns, loop } = metricsRef.current;
        if (!row || !step || !loop || animatingRef.current) return;
        window.clearTimeout(settleTimerRef.current);
        normalizePosition();
        const from = row.scrollLeft;
        const target = (Math.round(from / step) + direction * columns) * step;
        const duration = ANIMATION_DURATION;
        animatingRef.current = true;
        setIsAnimating(true);
        let startedAt;

        function animate(now) {
            startedAt ??= now;
            const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
            const eased = progress < 0.5
                ? 4 * progress ** 3
                : 1 - (-2 * progress + 2) ** 3 / 2;
            row.scrollLeft = from + (target - from) * eased;
            if (progress < 1) {
                animationRef.current = window.requestAnimationFrame(animate);
            } else {
                normalizePosition();
                animatingRef.current = false;
                setIsAnimating(false);
            }
        }
        animationRef.current = window.requestAnimationFrame(animate);
    }

    const copies = canLoop ? [0, 1, 2, 3, 4] : [0];

    function acceptsDrag(event) {
        return Boolean(onMoveSeries) && Array.from(event.dataTransfer.types).includes(SERIES_DRAG_TYPE);
    }

    return (
        <section className={`series-category${isDropTarget ? ' is-drop-target' : ''}`} ref={sectionRef} tabIndex={-1}
            aria-label={title}
            onDragOver={(event) => {
                if (!acceptsDrag(event)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setIsDropTarget(true);
            }}
            onDragLeave={(event) => {
                if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                    setIsDropTarget(false);
                }
            }}
            onDrop={(event) => {
                setIsDropTarget(false);
                if (!acceptsDrag(event)) return;
                event.preventDefault();
                const path = event.dataTransfer.getData(SERIES_DRAG_TYPE);
                if (path) onMoveSeries(path, categoryId);
            }}>
            <div className="series-category-header">
                <h3 className="huex-title">{title}</h3>
                <span className="series-category-count">{series.length}</span>
                {categoryId && onDeleteCategory && <button type="button" className="series-category-options category-header-options"
                    aria-label={`Opciones de la categoría ${title}`} aria-haspopup="menu"
                    aria-expanded={menu?.view === 'category'} aria-controls={menu?.view === 'category' ? `${rowId}-menu` : undefined}
                    onClick={event => toggleMenu(event, { nombre: title }, 'category-options', 'category')}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                        <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                    </svg>
                </button>}
            </div>

            {series.length === 0 ? (
                <p className="series-category-empty">
                    {onMoveSeries ? 'Arrastra una serie aquí o utiliza «Mover a…» en una tarjeta.'
                        : 'Todavía no hay series en esta categoría.'}
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
                        role="region" aria-label={`Series de ${title}`} tabIndex={0}
                        onScroll={handleScroll} onPointerDown={interruptAnimation} onWheel={interruptAnimation}
                        onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                                event.preventDefault();
                                scrollRow(event.key === 'ArrowLeft' ? -1 : 1);
                            }
                        }}>
                        {copies.flatMap(copy => series.map((serie, index) => {
                            const slot = copy * series.length + index;
                            // Solo la tanda visible y su tarjeta parcial son interactivas.
                            const visible = !canLoop || (slot >= visibleStart && slot <= visibleStart + layout.columns);
                            return (
                                <div key={`${copy}-${serie.rutaCompleta}`} className="series-category-card"
                                    inert={!visible || isAnimating} aria-hidden={!visible || isAnimating ? true : undefined}
                                    draggable={Boolean(onMoveSeries) && visible && !isAnimating}
                                    onDragStart={(event) => {
                                        if (!onMoveSeries) return;
                                        suppressClickUntilRef.current = Infinity;
                                        event.dataTransfer.effectAllowed = 'move';
                                        event.dataTransfer.setData(SERIES_DRAG_TYPE, serie.rutaCompleta);
                                    }}
                                    onDragEnd={() => {
                                        suppressClickUntilRef.current = Date.now() + 300;
                                        setIsDropTarget(false);
                                    }}>
                                    <HuexCard item={serie} variant={cardVariant} showPlayButton={cardVariant === 'horizontal'}
                                        progress={serie.nextEpisode ? null : serie.playbackProgress}
                                        onClick={() => {
                                            if (Date.now() >= suppressClickUntilRef.current) onSelectSeries(serie);
                                        }} />
                                    {(onMoveSeries || onResetSeries) && <button type="button" className="series-category-options"
                                        aria-label={`Opciones de ${serie.nombre}`}
                                        aria-haspopup="menu" aria-expanded={menu?.key === `${copy}-${serie.rutaCompleta}`}
                                        aria-controls={menu?.key === `${copy}-${serie.rutaCompleta}` ? `${rowId}-menu` : undefined}
                                        draggable={false}
                                        onDragStart={(event) => { event.preventDefault(); event.stopPropagation(); }}
                                        onClick={(event) => toggleMenu(event, serie, `${copy}-${serie.rutaCompleta}`)}>
                                        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                                            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                                        </svg>
                                    </button>}
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
            {menu && createPortal(
                <div ref={menuRef} id={`${rowId}-menu`} role="menu" className="series-category-menu"
                    aria-label={`Opciones de ${menu.serie.nombre}`} style={menu.style}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            closeMenu();
                        } else if (event.key === 'Tab') {
                            event.preventDefault();
                            closeMenu();
                        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                            event.preventDefault();
                            const options = Array.from(menuRef.current.querySelectorAll('[role="menuitem"], [role="menuitemradio"]'));
                            const current = options.indexOf(document.activeElement);
                            const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
                                : modulo(current + (event.key === 'ArrowDown' ? 1 : -1), options.length);
                            options[next]?.focus();
                        }
                    }}>
                    {menu.view === 'category' ? <>
                        <div className="series-category-menu-title">Opciones de la categoría</div>
                        <button type="button" role="menuitem" tabIndex={-1} onClick={() => {
                            closeMenu(false);
                            onDeleteCategory({ id: categoryId, name: title });
                        }}>Eliminar categoría</button>
                    </> : menu.view === 'actions' ? <>
                        <div className="series-category-menu-title">Opciones de la serie</div>
                        {onMoveSeries && <button type="button" role="menuitem" tabIndex={-1}
                            onClick={() => setMenu(current => ({ ...current, view: 'move' }))}>
                            <span>Mover a categoría</span><span aria-hidden="true">›</span>
                        </button>}
                        {onResetSeries && <button type="button" role="menuitem" tabIndex={-1}
                            onClick={() => {
                                const serie = menu.serie;
                                closeMenu(false);
                                onResetSeries(serie);
                            }}>Reiniciar serie</button>}
                    </> : <>
                    <button type="button" role="menuitem" tabIndex={-1}
                        onClick={() => setMenu(current => ({ ...current, view: 'actions' }))}>‹ Volver a opciones</button>
                    <div className="series-category-menu-title">Mover a categoría</div>
                    {[{ id: '', name: 'Sin categoría' }, ...categories].map(category => (
                        <button type="button" role="menuitemradio" key={category.id}
                            aria-checked={category.id === categoryId} tabIndex={-1}
                            onClick={(event) => {
                                event.stopPropagation();
                                closeMenu();
                                if (category.id !== categoryId) onMoveSeries(menu.serie.rutaCompleta, category.id);
                            }}>
                            <span>{category.name}</span>
                            {category.id === categoryId && <span className="series-category-menu-check" aria-hidden="true">✓</span>}
                        </button>
                    ))}
                    </>}
                </div>, document.body
            )}
        </section>
    );
}

export default SeriesCategoryRow;
