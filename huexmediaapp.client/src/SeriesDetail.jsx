import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HuexCard from './HuexCard';
import './css/HuexStyles.css';

function SeriesDetail() {
    const location = useLocation();
    const navigate = useNavigate();
    const { folderPath, seriesName } = location.state || {};

    const [temporadas, setTemporadas] = useState([]);
    const [temporadaActiva, setTemporadaActiva] = useState(null);
    const [fondoSerie, setFondoSerie] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!folderPath) return;

        const fetchEpisodes = async () => {
            try {
                const response = await fetch(`/api/series/scan-episodes?path=${encodeURIComponent(folderPath)}`);
                if (response.ok) {
                    const data = await response.json();
                    setFondoSerie(data.fondoSerie);
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

            {/* Cabecera */}
            <div className="huex-header">
                <button onClick={() => navigate('/series')} className="back-btn" title="Volver">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="32px" height="32px">
                        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                    </svg>
                </button>
                <h2 className="huex-title">{seriesName}</h2>
            </div>

            <hr className="huex-divider" />

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
                                <div key={index} onClick={() => setTemporadaActiva(temp)}
                                    className={`huex-item ${isActive ? 'active' : ''}`}
                                >
                                    {temp.nombreTemporada}
                                </div>
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
                                            onClick={() => alert(`Reproducir episodio: ${ep.nombre}`)}
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