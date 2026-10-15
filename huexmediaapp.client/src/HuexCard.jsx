import './css/HuexStyles.css';
import EpisodeCardMenu from './EpisodeCardMenu';

function HuexCard({ item, onClick, showPlayButton = false, variant = "vertical", watched = false, progress = null, onSetWatched, statusDisabled = false, theme }) {
    const nombre = item.nombre || item.nombreTemporada || "Sin título";
    const defaultImage = variant === 'vertical'
        ? '/default-episode-vertical.png'
        : watched
            ? '/default-episode-horizontal-viewed.png'
            : progress
                ? '/default-episode-horizontal-ongoing.png'
                : '/default-episode-horizontal.png';
    const isDefaultImage = !item.urlImagen || [
        '/default-episode-horizontal.png',
        '/default-episode-horizontal-ongoing.png',
        '/default-episode-horizontal-viewed.png',
        '/default-episode-vertical.png'
    ].includes(item.urlImagen);
    const imageUrl = isDefaultImage ? defaultImage : item.urlImagen;


    // Clase condicional según si es un póster de serie o un episodio
    const cardClassName = `${variant === "vertical" ? "huex-card huex-card-vertical" : "huex-card huex-card-episode"}${theme ? ` huex-theme-${theme}` : ''}`;

    const card = (
        <button type="button" className={cardClassName} onClick={onClick}>
            <div className="huex-thumbnail-container">
                {imageUrl ? (
                    <img
                        key={imageUrl}
                        className="huex-img"
                        src={imageUrl}
                        alt={nombre}
                        onError={(e) => {
                            console.error("Fallo al cargar la imagen con ruta:", item.urlImagen);
                            if (e.currentTarget.getAttribute('src') !== defaultImage) {
                                e.currentTarget.src = defaultImage;
                            }
                        }}
                    />
                ) : (
                    <div className="huex-default-icon">
                        <svg viewBox="0 0 24 24" fill="#555" width="60px" height="60px">
                            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8zm0 3h4v2h-4zm0-6h8v2h-8z" />
                        </svg>
                    </div>
                )}

                {showPlayButton && (
                    <div className="episode-play-btn">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                )}
                {variant !== 'vertical' && <>
                    <progress className="episode-progress-bar episode-thumbnail-progress"
                        value={watched ? 1 : progress ? progress.positionSeconds / progress.durationSeconds : 0}
                        max={1}
                        aria-label="Progreso del episodio"
                        aria-valuetext={watched ? 'Visto' : progress?.label ?? 'Sin ver'} />
                </>}
            </div>

            <div className="huex-card-info">
                <span className="huex-card-title" title={nombre}>
                    {nombre}
                </span>
            </div>
        </button>
    );
    return onSetWatched && variant !== 'vertical' ? <div className="episode-card-shell">
        {card}
        <EpisodeCardMenu name={nombre} watched={watched} onSetWatched={onSetWatched} disabled={statusDisabled} />
    </div> : card;
}

export default HuexCard;
