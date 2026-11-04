import '../css/HuexStyles.css';
import '../css/HuexCard.css';
import '../css/HuexKeyEpisode.css';
import { TrashIcon } from './Icons';
import HuexCardMenu from './HuexCardMenu';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ------------------------- Imágenes predeterminadas --------------------------

// Permite reconocer las imágenes genéricas recibidas del servidor.
const defaultImages = [
    '/default-episode-horizontal.png',
    '/default-episode-horizontal-ongoing.png',
    '/default-episode-horizontal-viewed.png',
    '/default-episode-vertical.png'
];

/** Elige la imagen genérica por formato y estado; visto tiene prioridad sobre progreso. */
function getDefaultImage(isVertical: boolean, watched: boolean, progress: EpisodeProgress | null) {
    if (isVertical) {
        return '/default-episode-vertical.png';
    }
    if (watched) {
        return '/default-episode-horizontal-viewed.png';
    }
    if (progress) {
        return '/default-episode-horizontal-ongoing.png';
    }
    return '/default-episode-horizontal.png';
}

export interface EpisodeProgress {
    /** Posición guardada en segundos. */
    positionSeconds: number;
    /** Duración del episodio en segundos. */
    durationSeconds: number;
    /** Descripción accesible del progreso. */
    label?: string;
    episodePath?: string;
}

export interface HuexCardProps {
    /** Datos del elemento. */
    item: {nombre?: string, nombreTemporada?: string, urlImagen?: string};
    /** Acción al pulsar la tarjeta. */
    onClick: import('react').MouseEventHandler<HTMLButtonElement>;
    /** Muestra el icono de reproducción. */
    showPlayButton?: boolean;
    /** Formato vertical u horizontal. */
    variant?: string;
    /** Destaca el episodio como importante para la trama. */
    isKey?: boolean;
    /** Indica si el episodio está visto. */
    watched?: boolean;
    /** Progreso guardado. */
    progress?: EpisodeProgress|null;
    /** Acciones del menú de la tarjeta. */
    menuItems?: import('./HuexCardMenu').HuexCardMenuItem[];
    /** Deshabilita el botón de opciones y sus acciones. */
    menuDisabled?: boolean;
    /** Encabezado del menú de acciones. */
    menuTitle?: string;
    /** Tema visual de la tarjeta. */
    theme?: string;
    /** Acción para quitar la tarjeta de la sección. */
    onRemove?: () => void;
    /** Deshabilita la acción de quitar. */
    removeDisabled?: boolean;
}

/**
 * Muestra una tarjeta de serie, temporada o episodio.
 * @param props Propiedades de la tarjeta.
 */
function HuexCard(props: HuexCardProps) {
    const {
        item,
        onClick,
        showPlayButton = false,
        variant = 'vertical',
        isKey = false,
        watched = false,
        progress = null,
        menuItems = [],
        menuDisabled = false,
        menuTitle,
        theme,
        onRemove,
        removeDisabled = false
    } = props;

    // El tooltip se dibuja fuera del carrusel para que sus bordes no lo recorten.
    const [tooltipVisible, setTooltipVisible] = useState(false);
    const tooltipTimerRef = useRef<number | undefined>(undefined);
    const cardRef = useRef<HTMLButtonElement>(null);
    const tooltipId = useId();

    // Al retirar la tarjeta, cancela cualquier aparición del tooltip que siga pendiente.
    useEffect(() => {
        return () => window.clearTimeout(tooltipTimerRef.current);
    }, []);

    // Cierra el tooltip cuando cambia la posición de la página o el usuario pulsa Escape.
    // Al cerrarlo o desmontar la tarjeta, retira los listeners de esta apertura.
    useEffect(() => {
        if (!tooltipVisible) {
            return;
        }
        /** Oculta el título para que no quede flotando en una posición anterior al desplazamiento. */
        function dismissTooltip() {
            setTooltipVisible(false);
        }
        /** Permite cerrar el texto emergente desde el teclado sin mover el foco. */
        function handleTooltipKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                dismissTooltip();
            }
        }
        document.addEventListener('scroll', dismissTooltip, true);
        window.addEventListener('resize', dismissTooltip);
        document.addEventListener('keydown', handleTooltipKeyDown);
        return () => {
            document.removeEventListener('scroll', dismissTooltip, true);
            window.removeEventListener('resize', dismissTooltip);
            document.removeEventListener('keydown', handleTooltipKeyDown);
        };
    }, [tooltipVisible]);

    // ------------------------- Preparación de la tarjeta -------------------------

    // Series y episodios usan nombre; las temporadas también pueden usar nombreTemporada.
    const title = item.nombre || item.nombreTemporada || 'Sin título';
    const isVertical = variant === 'vertical';

    // Las imágenes genéricas se sustituyen por la que corresponde al estado actual.
    const defaultImage = getDefaultImage(isVertical, watched, progress);
    const isDefaultImage = !item.urlImagen || defaultImages.includes(item.urlImagen);
    const imageUrl = isDefaultImage ? defaultImage : item.urlImagen;

    // Combina el formato de la tarjeta con el tema visual recibido.
    const variantClass = isVertical ? 'huex-card-vertical' : 'huex-card-episode';
    const themeClass = theme ? ` huex-theme-${theme}` : '';
    const keyClass = isKey ? ' is-key' : '';
    const cardClassName = `huex-card ${variantClass}${themeClass}${keyClass}`;

    // La barra usa valores de 0 a 1; un episodio visto se muestra completo.
    let progressValue = 0;
    if (watched) {
        progressValue = 1;
    } else if (progress) {
        progressValue = progress.positionSeconds / progress.durationSeconds;
    }
    const progressLabel = watched ? 'Visto' : progress?.label ?? 'Sin ver';

    // ------------------------- Evento de carga de imagen -------------------------

    /** Ante un fallo de carga, sustituye la imagen por la genérica sin reintentar esa misma ruta. */
    function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
        console.error('Fallo al cargar la imagen con ruta:', item.urlImagen);
        const image = event.currentTarget;
        if (image.getAttribute('src') !== defaultImage) {
            image.src = defaultImage;
        }
    }

    // ------------------------- Título completo emergente -------------------------

    /** Espera brevemente al pasar el ratón para evitar títulos fugaces al recorrer las tarjetas. */
    function scheduleTooltip() {
        window.clearTimeout(tooltipTimerRef.current);
        tooltipTimerRef.current = window.setTimeout(() => {
            if (cardRef.current?.matches(':hover') && !cardRef.current.closest('[inert]')) {
                setTooltipVisible(true);
            }
        }, 450);
    }

    /** Cancela la aparición pendiente y retira el tooltip visible. */
    function hideTooltip() {
        window.clearTimeout(tooltipTimerRef.current);
        setTooltipVisible(false);
    }

    /** Muestra el título al llegar a la tarjeta con el teclado. */
    function showTooltipOnFocus() {
        window.clearTimeout(tooltipTimerRef.current);
        setTooltipVisible(true);
    }

    /** Coloca el tooltip junto a la tarjeta y lo mantiene dentro de los bordes de la ventana. */
    function positionTooltip(element: HTMLDivElement | null) {
        if (!element || !cardRef.current) {
            return;
        }
        const anchor = cardRef.current.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        const margin = 12;
        const left = Math.max(margin, Math.min(anchor.left + anchor.width / 2 - box.width / 2,
            window.innerWidth - box.width - margin));
        const top = anchor.top - box.height - 8 >= margin
            ? anchor.top - box.height - 8
            : Math.max(margin, Math.min(anchor.bottom + 8, window.innerHeight - box.height - margin));
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
    }

    // ------------------------- Renderizado de la tarjeta -------------------------

    // El clic de toda la tarjeta lo gestiona el componente que la utiliza.
    const card = (
        <button type="button" className={cardClassName} onClick={onClick} ref={cardRef}
            aria-describedby={tooltipVisible ? tooltipId : undefined}
            onMouseEnter={scheduleTooltip} onMouseLeave={hideTooltip}
            onFocus={showTooltipOnFocus} onBlur={hideTooltip}
            onMouseDown={hideTooltip} onDragStart={hideTooltip}>
            <div className="huex-thumbnail-container">
                <img
                    key={imageUrl}
                    className="huex-img"
                    src={imageUrl}
                    alt={title}
                    onError={handleImageError}
                />

                {/* La marca de episodio clave es independiente del estado de reproducción. */}
                {isKey && (
                    <span className="huex-card-key-badge">
                        <span aria-hidden="true">★</span>
                        <span>Clave</span>
                    </span>
                )}

                {/* El icono es visual; el clic sigue perteneciendo a la tarjeta. */}
                {showPlayButton && (
                    <div className="episode-play-btn">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                )}
                {/* El progreso se muestra en el formato horizontal. */}
                {!isVertical && (
                    <progress
                        className="episode-progress-bar episode-thumbnail-progress"
                        value={progressValue}
                        max={1}
                        aria-label="Progreso del episodio"
                        aria-valuetext={progressLabel}
                    />
                )}
            </div>

            <div className="huex-card-info">
                <span className="huex-card-title">
                    {title}
                </span>
            </div>
        </button>
    );

    const tooltip = tooltipVisible && createPortal(
        <span id={tooltipId} role="tooltip" className="huex-card-tooltip" ref={positionTooltip}>
            {title}
        </span>, document.body
    );

    // Las acciones quedan fuera del botón de reproducción.
    if (menuItems.length > 0 || onRemove) {
        return (
            <div className="episode-card-shell">
                {card}
                {tooltip}

                {onRemove && (
                    <button
                        type="button"
                        className="series-category-options episode-card-options huex-card-remove"
                        disabled={removeDisabled}
                        aria-label={`Quitar ${title} de Continuar viendo`}
                        draggable={false}
                        onDragStart={event => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                        onClick={event => {
                            event.stopPropagation();
                            onRemove();
                        }}
                    >
                        <TrashIcon size={18} />
                    </button>
                )}

                <HuexCardMenu
                    name={title}
                    menuItems={menuItems}
                    disabled={menuDisabled}
                    title={menuTitle}
                />
            </div>
        );
    }

    return <>{card}{tooltip}</>;
}

export default HuexCard;
