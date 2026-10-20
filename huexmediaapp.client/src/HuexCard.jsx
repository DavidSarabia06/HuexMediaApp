import './css/HuexStyles.css';
import './css/HuexCard.css';
import HuexCardMenu from './HuexCardMenu';

// ------------------------- Imágenes predeterminadas --------------------------

// Permite reconocer las imágenes genéricas recibidas del servidor.
const defaultImages = [
    '/default-episode-horizontal.png',
    '/default-episode-horizontal-ongoing.png',
    '/default-episode-horizontal-viewed.png',
    '/default-episode-vertical.png'
];

/** Elige la imagen genérica por formato y estado; visto tiene prioridad sobre progreso. */
function getDefaultImage(isVertical, watched, progress) {
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

/**
 * @typedef {Object} EpisodeProgress
 * @property {number} positionSeconds Posición guardada en segundos.
 * @property {number} durationSeconds Duración del episodio en segundos.
 * @property {string} [label] Descripción accesible del progreso.
 */

/**
 * @typedef {Object} HuexCardProps
 * @property {{nombre?: string, nombreTemporada?: string, urlImagen?: string}} item Datos del elemento.
 * @property {import('react').MouseEventHandler<HTMLButtonElement>} onClick Acción al pulsar la tarjeta.
 * @property {boolean} [showPlayButton] Muestra el icono de reproducción.
 * @property {string} [variant] Formato vertical u horizontal.
 * @property {boolean} [watched] Indica si el episodio está visto.
 * @property {EpisodeProgress|null} [progress] Progreso guardado.
 * @property {import('./HuexCardMenu').HuexCardMenuItem[]} [menuItems] Acciones del menú de la tarjeta.
 * @property {boolean} [menuDisabled] Deshabilita el botón de opciones y sus acciones.
 * @property {string} [menuTitle] Encabezado del menú de acciones.
 * @property {string} [theme] Tema visual de la tarjeta.
 */

/**
 * Muestra una tarjeta de serie, temporada o episodio.
 * @param {HuexCardProps} props Propiedades de la tarjeta.
 */
function HuexCard(props) {
    const {
        item,
        onClick,
        showPlayButton = false,
        variant = 'vertical',
        watched = false,
        progress = null,
        menuItems = [],
        menuDisabled = false,
        menuTitle,
        theme
    } = props;

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
    const cardClassName = `huex-card ${variantClass}${themeClass}`;

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
    function handleImageError(event) {
        console.error('Fallo al cargar la imagen con ruta:', item.urlImagen);
        const image = event.currentTarget;
        if (image.getAttribute('src') !== defaultImage) {
            image.src = defaultImage;
        }
    }

    // ------------------------- Renderizado de la tarjeta -------------------------

    // El clic de toda la tarjeta lo gestiona el componente que la utiliza.
    const card = (
        <button type="button" className={cardClassName} onClick={onClick}>
            <div className="huex-thumbnail-container">
                <img
                    key={imageUrl}
                    className="huex-img"
                    src={imageUrl}
                    alt={title}
                    onError={handleImageError}
                />

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
                <span className="huex-card-title" title={title}>
                    {title}
                </span>
            </div>
        </button>
    );

    // El menú queda fuera del botón para mantener ambas acciones independientes.
    if (menuItems.length > 0) {
        return (
            <div className="episode-card-shell">
                {card}
                <HuexCardMenu
                    name={title}
                    menuItems={menuItems}
                    disabled={menuDisabled}
                    title={menuTitle}
                />
            </div>
        );
    }

    return card;
}

export default HuexCard;
