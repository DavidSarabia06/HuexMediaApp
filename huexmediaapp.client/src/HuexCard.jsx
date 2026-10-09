import './css/HuexStyles.css';

function HuexCard({ item, onClick, showPlayButton = false, variant = "vertical" }) {
    const nombre = item.nombre || item.nombreTemporada || "Sin título";


    // Clase condicional según si es un póster de serie o un episodio
    const cardClassName = variant === "vertical" ? "huex-card huex-card-vertical" : "huex-card";

    return (
        <div className={cardClassName} onClick={onClick}>
            <div className="huex-thumbnail-container">
                {item.urlImagen ? (
                    <img
                        className="huex-img"
                        src={item.urlImagen}
                        alt={nombre}
                        onError={(e) => {
                            console.error("Fallo al cargar la imagen con ruta:", item.urlImagen);
                            e.target.onerror = null;
                            e.target.src = '/default-episode-horizontal.png';
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
                        <svg viewBox="0 0 24 24" fill="#00e676" width="24px" height="24px">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                )}
            </div>

            <div className="huex-card-info">
                <span className="huex-card-title" title={nombre}>
                    {nombre}
                </span>
            </div>
        </div>
    );
}

export default HuexCard;