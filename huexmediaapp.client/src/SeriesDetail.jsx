import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HuexCard from './HuexCard';
import HuexPageHeader from './HuexPageHeader';
import './css/HuexStyles.css';

function SeriesDetail() {
    const location = useLocation();
    const navigate = useNavigate();
    const { folderPath, seriesName } = location.state || {};

    const [temporadas, setTemporadas] = useState([]);
    const [temporadaActiva, setTemporadaActiva] = useState(null);
    
    const [isLoading, setIsLoading] = useState(true);


    useEffect(() => {
        if (!folderPath) return;

        const fetchEpisodes = async () => {
            try {
                const response = await fetch(`/api/series/scan-episodes?path=${encodeURIComponent(folderPath)}`);
                if (response.ok) {
                    const data = await response.json();

                    setTemporadas(data.temporadas);

                    if (data.temporadas.length > 0) {
                        setTemporadaActiva(data.temporadas[0]);
                    }
                }
            } catch (error) {
                console.error("Error al cargar episodios:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEpisodes();
    }, [folderPath]);

    if (!folderPath) {
        return (
            <div className="series-error-container">
                <h3>Error: No se encontró la ruta de la serie.</h3>
                <button onClick={() => navigate('/series')} className="action-btn">Volver</button>
            </div>
        );
    }

    return (
        <div className="huex-container">

            <HuexPageHeader title={seriesName} onBack={() => navigate('/series')} />

            {isLoading ? (
                <h3 className="loading-text">Buscando episodios...</h3>
            ) : temporadas.length === 0 ? (
                <div className="empty-state">
                    <h3>No se encontraron videos</h3>
                </div>
            ) : (
                <div className="huex-content-layout">

                    {/* Panel Lateral: Menú de Temporadas */}
                    <div className="huex-sidebar">
                        {temporadas.map((temp, index) => {
                            const isActive = temporadaActiva && temporadaActiva.nombreTemporada === temp.nombreTemporada;
                            return (
                                <button type="button" key={index} aria-pressed={isActive} onClick={() => setTemporadaActiva(temp)}
                                    className={`huex-item ${isActive ? 'active' : ''}`}
                                >
                                    {temp.nombreTemporada}
                                </button>
                            );
                        })}
                    </div>

                    {/* Panel Principal: Cuadrícula de Episodios */}
                    <div className="huex-main-panel">
                        {temporadaActiva && (
                            <>
                                <h3 className="huex-title">{temporadaActiva.nombreTemporada}</h3>

                                        <div className="huex-grid">
                                    {temporadaActiva.episodios.map((ep, index) => (
                                        <HuexCard
                                            key={index}
                                            item={ep}
                                            // Abre el reproductor y le envía el episodio seleccionado.
                                            onClick={() => navigate('/player', {
                                                state: {
                                                    episode: ep
                                                }
                                            })}
                                            showPlayButton={true}
                                            variant="horizontal"
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
}

export default SeriesDetail;
