import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HuexCard from './HuexCard';
import HuexPageHeader from './HuexPageHeader';
import { pathKey, formatProgressTime, readProgressResponse, waitForProgressSaves } from './playbackProgress';
import './css/HuexStyles.css';

/** Muestra las temporadas y episodios de la serie recibida en el estado de navegación. */
function SeriesDetail() {
    const location = useLocation();
    const navigate = useNavigate();
    const { folderPath, seriesName } = location.state || {};

    // Temporadas recibidas y selección del panel lateral.
    const [temporadas, setTemporadas] = useState([]);
    const [temporadaActiva, setTemporadaActiva] = useState(null);

    // La carga reúne los episodios, la biblioteca configurada y el progreso de esta serie.
    const [isLoading, setIsLoading] = useState(true);
    const [libraryPath, setLibraryPath] = useState('');
    const [progress, setProgress] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [loadAttempt, setLoadAttempt] = useState(0);
    // Bloquea cambios de estado simultáneos y actualiza la disponibilidad de los menús.
    const updatingRef = useRef(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState('');

    // Episodio pendiente de elegir entre empezar de nuevo o continuar desde su minuto guardado.
    const [resumeEpisode, setResumeEpisode] = useState(null);
    const resumeDialogRef = useRef(null);

    // ---------------------------- Carga de episodios -----------------------------

    // Al montar, cambiar de serie o reintentar, carga los datos con una señal de cancelación.
    // La limpieza cancela las peticiones del efecto antes de repetirlo o al salir de la página.
    useEffect(() => {
        if (!folderPath) {
            return;
        }
        const controller = new AbortController();

        /** Carga episodios y configuración, espera guardados pendientes y selecciona la temporada inicial. */
        async function loadEpisodes() {
            setIsLoading(true);
            setLoadError('');
            try {
                const [episodeData, configuration] = await Promise.all([
                    fetch(`/api/series/scan-episodes?path=${encodeURIComponent(folderPath)}`, {
                        signal: controller.signal
                    }).then(readProgressResponse),
                    fetch('/api/configuration/get?key=SeriesLibraryPath', {
                        signal: controller.signal
                    }).then(readProgressResponse)
                ]);
                await waitForProgressSaves();
                if (controller.signal.aborted) {
                    return;
                }
                const savedProgress = await fetch(
                    `/api/playbackprogress?libraryPath=${encodeURIComponent(configuration.value)}`,
                    { signal: controller.signal }
                ).then(readProgressResponse);
                if (controller.signal.aborted) {
                    return;
                }

                const seriesProgress = savedProgress.series.find(item =>
                    pathKey(item.seriesPath) === pathKey(folderPath)
                ) ?? null;
                const inProgressPath = seriesProgress?.inProgress?.episodePath;
                const seasonWithProgress = episodeData.temporadas.find(season =>
                    season.episodios.some(episode =>
                        inProgressPath && pathKey(episode.rutaCompleta) === pathKey(inProgressPath)
                    )
                );

                setLibraryPath(configuration.value);
                setProgress(seriesProgress);
                setTemporadas(episodeData.temporadas);
                setTemporadaActiva(seasonWithProgress ?? episodeData.temporadas[0] ?? null);
            } catch (error) {
                if (!controller.signal.aborted) {
                    setLoadError(error.message);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }

        void loadEpisodes();
        return () => controller.abort();
    }, [folderPath, loadAttempt]);

    /** Incrementa el contador que vuelve a ejecutar el efecto de carga. */
    function retryLoad() {
        setLoadAttempt(attempt => attempt + 1);
    }

    // -------------------------- Selección de temporada ---------------------------

    /** Cambia la temporada cuyos episodios se presentan en la cuadrícula. */
    function selectSeason(season) {
        setTemporadaActiva(season);
    }

    // ------------------------- Selección y reproducción --------------------------

    /** Cierra la confirmación y abre el reproductor con el episodio y su posición inicial. */
    function playEpisode(episode, startSeconds = 0) {
        resumeDialogRef.current?.close();
        navigate('/player', {
            state: { episode, libraryPath, seriesPath: folderPath, startSeconds }
        });
    }

    /** Ofrece continuar si el episodio está empezado; en el resto de casos lo abre desde cero. */
    function selectEpisode(episode) {
        if (updatingRef.current) {
            return;
        }
        if (progress?.inProgress && pathKey(progress.inProgress.episodePath) === pathKey(episode.rutaCompleta)) {
            setResumeEpisode(episode);
            resumeDialogRef.current.showModal();
        } else {
            playEpisode(episode);
        }
    }

    // -------------------------- Diálogo de continuación --------------------------

    /** Cierra el diálogo de continuación y mantiene la página de episodios. */
    function closeResumeDialog() {
        resumeDialogRef.current.close();
    }

    /** Reproduce desde el principio el episodio seleccionado en el diálogo. */
    function restartSelectedEpisode() {
        playEpisode(resumeEpisode);
    }

    /** Reproduce el episodio seleccionado desde la posición guardada. */
    function resumeSelectedEpisode() {
        playEpisode(resumeEpisode, progress?.inProgress?.positionSeconds ?? 0);
    }

    // ------------------------ Actualización del progreso -------------------------

    /** Espera los guardados pendientes y solicita el estado visto/no visto, aplicando la respuesta. */
    async function setEpisodeWatched(episode, watched) {
        if (updatingRef.current) {
            return;
        }
        updatingRef.current = true;
        setIsUpdating(true);
        setUpdateError('');
        try {
            await waitForProgressSaves();
            const updatedProgress = await fetch('/api/playbackprogress/watched', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ libraryPath, seriesPath: folderPath, episodePath: episode.rutaCompleta, watched })
            }).then(readProgressResponse);
            setProgress(updatedProgress);
        } catch (error) {
            setUpdateError(error.message);
        } finally {
            updatingRef.current = false;
            setIsUpdating(false);
        }
    }

    // -------------------------------- Navegación ---------------------------------

    /** Vuelve a la biblioteca de series desde la cabecera o el aviso de ruta ausente. */
    function goBack() {
        navigate('/series');
    }

    // -------------------------- Datos para las tarjetas --------------------------

    /** Comprueba el estado visto mediante las rutas normalizadas del progreso recibido. */
    function isEpisodeWatched(episode) {
        return watchedPaths.has(pathKey(episode.rutaCompleta));
    }

    /** Construye la acción de la tarjeta para solicitar el estado opuesto al actual. */
    function getEpisodeMenuItems(episode) {
        const watched = isEpisodeWatched(episode);
        return [{
            id: 'watched',
            label: watched ? 'Marcar como no visto' : 'Marcar como visto',
            onSelect: () => setEpisodeWatched(episode, !watched)
        }];
    }

    /** Devuelve el progreso con su etiqueta cuando corresponde a esta tarjeta. */
    function getEpisodeProgress(episode) {
        if (inProgressEpisode && pathKey(inProgressEpisode.episodePath) === pathKey(episode.rutaCompleta)) {
            return {
                ...inProgressEpisode,
                label: `Continuar desde ${formatProgressTime(inProgressEpisode.positionSeconds)}`
            };
        }
        return null;
    }

    const watchedPaths = new Set((progress?.watchedEpisodePaths ?? []).map(pathKey));
    const inProgressEpisode = progress?.inProgress;

    // ------------------------- Renderizado de la página --------------------------

    if (!folderPath) {
        return (
            <div className="series-error-container">
                <h3>Error: No se encontró la ruta de la serie.</h3>
                <button onClick={goBack} className="action-btn">Volver</button>
            </div>
        );
    }

    return (
        <div className="huex-container huex-series-detail">

            <HuexPageHeader title={seriesName} onBack={goBack} outlinedTitle />
            {updateError && <p role="alert" className="episode-progress-error">{updateError}</p>}

            {/* Cuadro de dialogo para reanudar o empezar de nuevo episodios */}
            <dialog ref={resumeDialogRef} className="category-dialog" aria-labelledby="resume-dialog-title">
                <div className="category-dialog-form">
                    <h3 id="resume-dialog-title">¿Continuamos?</h3>
                    <p>{resumeEpisode?.nombre}</p>
                    <div className="category-dialog-actions">
                        <button type="button" className="category-dialog-cancel"
                            onClick={closeResumeDialog}>Cancelar</button>
                        <button type="button" className="action-btn" onClick={restartSelectedEpisode}>Empezar de nuevo</button>
                        <button type="button" className="action-btn" autoFocus
                            onClick={resumeSelectedEpisode}>
                            Continuar desde {formatProgressTime(inProgressEpisode?.positionSeconds ?? 0)}
                        </button>
                    </div>
                </div>
            </dialog>

            {isLoading ? (
                <h3 className="loading-text">Buscando episodios...</h3>
            ) : loadError ? (
                <div role="alert"><p>{loadError}</p><button type="button" className="action-btn"
                    onClick={retryLoad}>Reintentar carga</button></div>
            ) : temporadas.length === 0 ? (
                <div className="empty-state">
                    <h3>No se encontraron videos</h3>
                </div>
            ) : (
                <div className="huex-content-layout">

                    {/* Panel Lateral: Menú de Temporadas */}
                    <div className="huex-sidebar">
                        {temporadas.map((season, index) => {
                            const isActive = temporadaActiva && temporadaActiva.nombreTemporada === season.nombreTemporada;
                            return (
                                <button type="button" key={index} aria-pressed={isActive} onClick={() => selectSeason(season)}
                                    className={`huex-item ${isActive ? 'active' : ''}`}
                                >
                                    {season.nombreTemporada}
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
                                    {temporadaActiva.episodios.map((episode, index) => (
                                        <HuexCard
                                            key={index}
                                            item={episode}
                                            onClick={() => selectEpisode(episode)}
                                            watched={isEpisodeWatched(episode)}
                                            menuItems={getEpisodeMenuItems(episode)}
                                            menuDisabled={isUpdating}
                                            progress={getEpisodeProgress(episode)}
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
