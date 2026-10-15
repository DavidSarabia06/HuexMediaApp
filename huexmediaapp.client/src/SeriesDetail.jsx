import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HuexCard from './HuexCard';
import HuexPageHeader from './HuexPageHeader';
import { pathKey, formatProgressTime, readProgressResponse, waitForProgressSaves } from './playbackProgress';
import './css/HuexStyles.css';

function SeriesDetail() {
    const location = useLocation();
    const navigate = useNavigate();
    const { folderPath, seriesName } = location.state || {};

    const [temporadas, setTemporadas] = useState([]);
    const [temporadaActiva, setTemporadaActiva] = useState(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [libraryPath, setLibraryPath] = useState('');
    const [progress, setProgress] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [resumeEpisode, setResumeEpisode] = useState(null);
    const resumeDialogRef = useRef(null);
    const updatingRef = useRef(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState('');


    useEffect(() => {
        if (!folderPath) return;
        const controller = new AbortController();

        const fetchEpisodes = async () => {
            setIsLoading(true);
            setLoadError('');
            try {
                const [data, config] = await Promise.all([
                    fetch(`/api/series/scan-episodes?path=${encodeURIComponent(folderPath)}`, { signal: controller.signal }).then(readProgressResponse),
                    fetch('/api/configuration/get?key=SeriesLibraryPath', { signal: controller.signal }).then(readProgressResponse)
                ]);
                await waitForProgressSaves();
                if (controller.signal.aborted) return;
                const saved = await fetch(`/api/playbackprogress?libraryPath=${encodeURIComponent(config.value)}`,
                    { signal: controller.signal }).then(readProgressResponse);
                if (controller.signal.aborted) return;
                const seriesProgress = saved.series.find(item => pathKey(item.seriesPath) === pathKey(folderPath)) ?? null;
                setLibraryPath(config.value);
                setProgress(seriesProgress);
                setTemporadas(data.temporadas);
                const partialPath = seriesProgress?.inProgress?.episodePath;
                setTemporadaActiva(data.temporadas.find(season => season.episodios.some(ep =>
                    partialPath && pathKey(ep.rutaCompleta) === pathKey(partialPath))) ?? data.temporadas[0] ?? null);
            } catch (error) {
                if (!controller.signal.aborted) setLoadError(error.message);
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };

        fetchEpisodes();
        return () => controller.abort();
    }, [folderPath, loadAttempt]);

    function playEpisode(ep, startSeconds = 0) {
        resumeDialogRef.current?.close();
        navigate('/player', { state: { episode: ep, libraryPath, seriesPath: folderPath, startSeconds } });
    }

    function selectEpisode(ep) {
        if (updatingRef.current) return;
        if (progress?.inProgress && pathKey(progress.inProgress.episodePath) === pathKey(ep.rutaCompleta)) {
            setResumeEpisode(ep);
            resumeDialogRef.current.showModal();
        } else {
            playEpisode(ep);
        }
    }

    async function setEpisodeWatched(ep, watched) {
        if (updatingRef.current) return;
        updatingRef.current = true;
        setIsUpdating(true);
        setUpdateError('');
        try {
            await waitForProgressSaves();
            const saved = await fetch('/api/playbackprogress/watched', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ libraryPath, seriesPath: folderPath, episodePath: ep.rutaCompleta, watched })
            }).then(readProgressResponse);
            setProgress(saved);
        } catch (error) {
            setUpdateError(error.message);
        } finally {
            updatingRef.current = false;
            setIsUpdating(false);
        }
    }

    const watchedPaths = new Set((progress?.watchedEpisodePaths ?? []).map(pathKey));
    const partial = progress?.inProgress;

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

            <HuexPageHeader title={seriesName} onBack={() => navigate('/series')} outlinedTitle />
            {updateError && <p role="alert" className="episode-progress-error">{updateError}</p>}

            <dialog ref={resumeDialogRef} className="category-dialog" aria-labelledby="resume-dialog-title">
                <div className="category-dialog-form">
                    <h3 id="resume-dialog-title">¿Continuamos?</h3>
                    <p>{resumeEpisode?.nombre}</p>
                    <div className="category-dialog-actions">
                        <button type="button" className="category-dialog-cancel"
                            onClick={() => resumeDialogRef.current.close()}>Cancelar</button>
                        <button type="button" className="action-btn" onClick={() => playEpisode(resumeEpisode)}>Empezar de nuevo</button>
                        <button type="button" className="action-btn" autoFocus
                            onClick={() => playEpisode(resumeEpisode, partial?.positionSeconds ?? 0)}>
                            Continuar desde {formatProgressTime(partial?.positionSeconds ?? 0)}
                        </button>
                    </div>
                </div>
            </dialog>

            {isLoading ? (
                <h3 className="loading-text">Buscando episodios...</h3>
            ) : loadError ? (
                <div role="alert"><p>{loadError}</p><button type="button" className="action-btn"
                    onClick={() => setLoadAttempt(attempt => attempt + 1)}>Reintentar carga</button></div>
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
                                            onClick={() => selectEpisode(ep)}
                                            watched={watchedPaths.has(pathKey(ep.rutaCompleta))}
                                            onSetWatched={watched => setEpisodeWatched(ep, watched)}
                                            statusDisabled={isUpdating}
                                            progress={partial && pathKey(partial.episodePath) === pathKey(ep.rutaCompleta)
                                                ? { ...partial, label: `Continuar desde ${formatProgressTime(partial.positionSeconds)}` } : null}
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
