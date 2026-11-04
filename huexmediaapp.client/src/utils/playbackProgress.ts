import { errorMessage } from './generalUtils';
import { normalizePathForComparison, readJson, formatProgressTime } from './generalUtils';

// ----------------------------- Tipos de progreso -----------------------------

export type MediaItem = import('../components/SeriesCategoryRow').CategoryRowItem;
export type EpisodePlaybackProgress = import('../components/HuexCard').EpisodeProgress & {episodePath: string};
export type SeriesContinuationItem = MediaItem & {seriesPath: string};
export type SeriesEpisodes = {temporadas: {nombreTemporada: string, episodios: MediaItem[]}[]};

export interface SeriesPlaybackProgress {
    /** Carpeta de la serie. */
    seriesPath: string;
    /** Rutas de los episodios vistos. */
    watchedEpisodePaths: string[];
    /** Único episodio en curso de la serie. */
    inProgress: EpisodePlaybackProgress|null;
    /** Último episodio visto. */
    lastWatchedEpisodePath: string|null;
    /** Fecha ISO del último cambio aceptado. */
    lastRecordedAtUtc: string;
    /** Oculta la tarjeta conservando su progreso. */
    hiddenFromContinueWatching?: boolean;
}

export interface MoviePlaybackProgress {
    /** Ruta del archivo de película. */
    moviePath: string;
    /** Minuto guardado expresado en segundos. */
    positionSeconds: number;
    /** Duración total en segundos. */
    durationSeconds: number;
    /** Indica si la película está vista. */
    watched: boolean;
    /** Fecha ISO del último cambio aceptado. */
    lastRecordedAtUtc: string;
    /** Oculta la tarjeta conservando su progreso. */
    hiddenFromContinueWatching?: boolean;
}

export interface LibraryPlaybackProgress {
    /** Versión del documento común. */
    version: number;
    /** Identificador de la biblioteca. */
    libraryId: string;
    /** Entradas de progreso por serie. */
    series: SeriesPlaybackProgress[];
    /** Entradas de progreso por película. */
    movies: MoviePlaybackProgress[];
}

export interface ProgressIdentity {
    /** Identificador de la biblioteca. */
    libraryId: string;
    /** Ruta completa del vídeo reproducido. */
    videoPath: string;
    /** Carpeta de la serie; null para películas. */
    seriesPath?: string|null;
}

export interface ProgressSaver {
    /** Registra la muestra más reciente. */
    record: (positionSeconds: number, durationSeconds: number) => void;
    /** Solicita el envío y devuelve la promesa del ciclo activo. */
    flush: () => Promise<void>;
}

// ------------------------- Coordinación de guardados -------------------------

// Promesas de envío activas, compartidas por los guardadores del módulo.
const pendingSaves = new Set<Promise<void>>();

/**
 * Espera los ciclos de envío activos antes de consultar o modificar el progreso.
 * Promise.allSettled permite terminar la espera aunque algún envío haya fallado.
 * @returns Se resuelve cuando terminan los ciclos registrados en ese momento.
 */
export async function waitForProgressSaves(): Promise<void> {
    await Promise.allSettled([...pendingSaves]);
}

// --------------------------- Consultas al servidor ---------------------------

/**
 * Espera los guardados pendientes y consulta el documento común mediante libraryId.
 * Comprueba que la respuesta corresponda a esa biblioteca y contenga las listas de series y películas.
 * @param libraryId Identificador de la biblioteca.
 * @param [signal] Señal para cancelar la petición al salir de la página.
 * @returns Documento común de la biblioteca.
 */
export async function getLibraryProgress(libraryId: string, signal?: AbortSignal): Promise<LibraryPlaybackProgress> {
    await waitForProgressSaves();
    signal?.throwIfAborted();

    const progress = await fetch(
        `/api/playbackprogress?libraryId=${encodeURIComponent(libraryId)}`,
        { signal }
    ).then(readJson<LibraryPlaybackProgress>);

    if (progress.libraryId !== libraryId ||
        !Array.isArray(progress.movies) ||
        !Array.isArray(progress.series)) {
        throw new Error('El progreso recibido no corresponde a esta biblioteca.');
    }

    return progress;
}

/**
 * Consulta las temporadas y episodios de seriesPath dentro de la biblioteca libraryId.
 * Pasa signal al escaneo y devuelve el JSON leído con readJson.
 * @param libraryId Identificador de la biblioteca.
 * @param seriesPath Carpeta completa de la serie.
 * @param [signal] Señal para cancelar la petición al salir de la página.
 * @returns Temporadas y episodios disponibles.
 */
export async function getSeriesEpisodes(libraryId: string, seriesPath: string, signal?: AbortSignal): Promise<SeriesEpisodes> {
    return fetch(`/api/series/scan-episodes?libraryId=${encodeURIComponent(libraryId)}&path=${encodeURIComponent(seriesPath)}`, { signal })
        .then(readJson<SeriesEpisodes>);
}

// ------------------------- Acciones sobre el progreso ------------------------

/**
 * Solicita ocultar videoPath de continuar viendo en la biblioteca libraryId.
 * Espera los guardados pendientes y devuelve el progreso confirmado, conservando su posición y estado de visto.
 * @param libraryId Identificador de la biblioteca.
 * @param videoPath Ruta de la película que se oculta.
 * @param [signal] Señal para cancelar la petición al salir de la página.
 * @returns Progreso actualizado conservando la posición guardada.
 */
export async function hideMovieFromContinueWatching(libraryId: string, videoPath: string, signal?: AbortSignal): Promise<LibraryPlaybackProgress> {
    await waitForProgressSaves();
    signal?.throwIfAborted();

    const progress = await fetch(
        `/api/playbackprogress/hide?libraryId=${encodeURIComponent(libraryId)}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            signal,
            body: JSON.stringify({ videoPath })
        }
    ).then(readJson<LibraryPlaybackProgress>);

    if (progress.libraryId !== libraryId || !Array.isArray(progress.movies)) {
        throw new Error('El progreso recibido no corresponde a esta biblioteca.');
    }

    return progress;
}

/**
 * Comparte la espera de guardados, el POST y la comprobación de respuesta de las acciones de Series.
 * action elige el endpoint; body contiene los datos de la acción y signal permite cancelar la petición.
 * @param libraryId Identificador de la biblioteca.
 * @param action Acción que determina el endpoint.
 * @param body Datos específicos de la acción.
 * @param [signal] Señal para cancelar la petición al salir de la página.
 * @returns Documento confirmado por el servidor.
 */
async function updateSeriesProgress(libraryId: string, action: 'reset'|'hide-series'|'watched', body: {seriesPath: string, videoPath?: string, watched?: boolean}, signal?: AbortSignal): Promise<LibraryPlaybackProgress> {
    await waitForProgressSaves();
    signal?.throwIfAborted();
    const progress = await fetch(`/api/playbackprogress/${action}?libraryId=${encodeURIComponent(libraryId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
    }).then(readJson<LibraryPlaybackProgress>);
    if (progress.libraryId !== libraryId || !Array.isArray(progress.series)) {
        throw new Error('El progreso recibido no corresponde a esta biblioteca.');
    }
    return progress;
}

/**
 * Solicita reiniciar los vistos y el episodio en curso de seriesPath mediante la acción reset.
 * Devuelve el documento de progreso confirmado para que la página actualice su estado.
 * @param libraryId Identificador de la biblioteca.
 * @param seriesPath Carpeta de la serie que se reinicia.
 * @param [signal] Señal para cancelar la petición al salir de la página.
 * @returns Documento con el progreso reiniciado.
 */
export function resetSeriesProgress(libraryId: string, seriesPath: string, signal?: AbortSignal): Promise<LibraryPlaybackProgress> {
    return updateSeriesProgress(libraryId, 'reset', { seriesPath }, signal);
}

/**
 * Solicita ocultar la tarjeta de seriesPath mediante la acción hide-series.
 * Devuelve el documento actualizado conservando los episodios vistos y el minuto guardado.
 * @param libraryId Identificador de la biblioteca.
 * @param seriesPath Carpeta de la serie que se oculta.
 * @param [signal] Señal para cancelar la petición al salir de la página.
 * @returns Documento con la tarjeta marcada como oculta.
 */
export function hideSeriesFromContinueWatching(libraryId: string, seriesPath: string, signal?: AbortSignal): Promise<LibraryPlaybackProgress> {
    return updateSeriesProgress(libraryId, 'hide-series', { seriesPath }, signal);
}

/**
 * Solicita marcar videoPath como visto o no visto dentro de seriesPath según watched.
 * Utiliza la acción watched y devuelve el documento de progreso actualizado.
 * @param libraryId Identificador de la biblioteca.
 * @param videoPath Ruta completa del episodio.
 * @param seriesPath Carpeta de la serie a la que pertenece.
 * @param watched Estado de visto solicitado.
 * @param [signal] Señal para cancelar la petición al salir de la página.
 * @returns Documento con la marca de visto actualizada.
 */
export function setVideoWatched(libraryId: string, videoPath: string, seriesPath: string, watched: boolean, signal?: AbortSignal): Promise<LibraryPlaybackProgress> {
    return updateSeriesProgress(libraryId, 'watched', { videoPath, seriesPath, watched }, signal);
}

// ------------------------ Tarjetas de continuar viendo -----------------------

/**
 * Relaciona las entradas de progress con las películas disponibles en movies.
 * Filtra las pendientes y visibles, ordena por última reproducción y añade su barra y etiqueta de continuación.
 * @param movies Películas disponibles en el escaneo.
 * @param progress Entradas de progreso de las películas.
 * @returns Tarjetas pendientes y visibles con sus datos de continuación.
 */
export function buildContinueWatchingMovies(movies: MediaItem[], progress: MoviePlaybackProgress[]): MediaItem[] {
    const availableMovies = new Map(movies.map(movie => {
        return [normalizePathForComparison(movie.rutaCompleta), movie];
    }));

    return progress
        .filter(item => {
            return !item.watched &&
                !item.hiddenFromContinueWatching &&
                item.positionSeconds > 0 &&
                item.positionSeconds < item.durationSeconds &&
                availableMovies.has(normalizePathForComparison(item.moviePath));
        })
        .sort((left, right) => {
            return Date.parse(right.lastRecordedAtUtc) -
                Date.parse(left.lastRecordedAtUtc);
        })
        .map(item => {
            const movie = availableMovies.get(normalizePathForComparison(item.moviePath))!;

            // Copia la película y añade la información que utiliza la barra de progreso.
            return {
                ...movie,
                playbackProgress: {
                    positionSeconds: item.positionSeconds,
                    durationSeconds: item.durationSeconds,
                    label: `Continuar desde ${formatProgressTime(item.positionSeconds)}`
                }
            };
        });
}

/**
 * Prepara una tarjeta por serie disponible con su episodio en curso o el siguiente pendiente.
 * Consulta los episodios mediante libraryId y reúne las tarjetas en el orden de la última reproducción.
 * @param libraryId Identificador de la biblioteca.
 * @param series Series disponibles en el escaneo.
 * @param progress Entradas de progreso de las series.
 * @param [signal] Señal para cancelar la petición al salir de la página.
 * @returns Tarjetas de episodios en curso o siguientes pendientes.
 */
export async function buildContinueWatchingSeries(libraryId: string, series: MediaItem[], progress: SeriesPlaybackProgress[], signal?: AbortSignal): Promise<SeriesContinuationItem[]> {
    await waitForProgressSaves();
    if (signal?.aborted) {
        return [];
    }
    const available = new Map(series.map(item => [normalizePathForComparison(item.rutaCompleta), item]));
    const entries = progress.filter(item => !item.hiddenFromContinueWatching && (item.inProgress || item.lastWatchedEpisodePath || item.watchedEpisodePaths?.length) && available.has(normalizePathForComparison(item.seriesPath)))
        .sort((left, right) => Date.parse(right.lastRecordedAtUtc) - Date.parse(left.lastRecordedAtUtc));
    /**
     * Localiza el episodio en curso o el siguiente pendiente y prepara su tarjeta.
     * @param entry Progreso guardado de la serie que se consulta.
     * @returns Tarjeta del episodio elegido o null si falta un candidato.
     */
    async function loadSeriesEpisode(entry: SeriesPlaybackProgress): Promise<SeriesContinuationItem|null> {
        const data = await getSeriesEpisodes(libraryId, entry.seriesPath, signal);
        /**
         * Ordena nombres en español teniendo en cuenta los números de temporada y episodio.
         * @param left Primer nombre de temporada o episodio.
         * @param right Segundo nombre que se compara.
         * @returns Valor negativo, cero o positivo para establecer el orden.
         */
        function compareNames(left: string, right: string): number {
            return left.localeCompare(right, 'es', { numeric: true, sensitivity: 'base' });
        }
        const ordered = [...data.temporadas].sort((left, right) => compareNames(left.nombreTemporada ?? '', right.nombreTemporada ?? ''))
            .flatMap(season => [...season.episodios].sort((left, right) => compareNames(left.nombre, right.nombre)));
        let episode;
        const nextEpisode = !entry.inProgress;
        if (entry.inProgress) {
            episode = ordered.find(item => normalizePathForComparison(item.rutaCompleta) === normalizePathForComparison(entry.inProgress!.episodePath));
        } else {
            // Compatibilidad con los JSON guardados antes de añadir LastWatchedEpisodePath.
            const lastWatched = entry.lastWatchedEpisodePath ?? entry.watchedEpisodePaths?.at(-1);
            const index = lastWatched ? ordered.findIndex(item => normalizePathForComparison(item.rutaCompleta) === normalizePathForComparison(lastWatched)) : -1;
            const watched = new Set((entry.watchedEpisodePaths ?? []).map(normalizePathForComparison));
            if (index >= 0) {
                episode = ordered.slice(index + 1).find(item => !watched.has(normalizePathForComparison(item.rutaCompleta)));
            }
        }
        if (!episode) {
            return null;
        }
        const seriesName = available.get(normalizePathForComparison(entry.seriesPath))!.nombre;
        return { ...episode, nombre: `${seriesName} · ${episode.nombre}`, seriesPath: entry.seriesPath, nextEpisode,
            playbackProgress: entry.inProgress
                ? { ...entry.inProgress, label: `Continuar desde ${formatProgressTime(entry.inProgress.positionSeconds)}` }
                : { episodePath: episode.rutaCompleta, positionSeconds: 0, durationSeconds: 0 } };
    }

    const episodes = await Promise.all(entries.map(loadSeriesEpisode));
    return episodes.filter((episode): episode is SeriesContinuationItem => episode !== null);
}

// --------------------------- Guardador de progreso ---------------------------

/**
 * Crea un guardador por vídeo que reúne las muestras y mantiene un único ciclo de envío activo.
 * identity contiene libraryId, videoPath y seriesPath opcional; onError actualiza el aviso de la página.
 * @param identity Biblioteca, vídeo y serie opcional.
 * @param onError Recibe el aviso de guardado; cadena vacía al confirmar el envío.
 * @returns Métodos para registrar posiciones y solicitar su envío.
 */
export function createProgressSaver(identity: ProgressIdentity, onError: (message: string) => void): ProgressSaver {
    // --------------------------- Estado de las muestras --------------------------

    // Última muestra registrada y fecha de la última confirmada por el servidor.
    let latest: (Omit<ProgressIdentity, "libraryId"> & { positionSeconds: number; durationSeconds: number; recordedAtUtc: string }) | null = null;
    let savedAt: string | null = null;
    // Envío activo y petición de volver a revisar la última muestra.
    let running: Promise<void> | null = null;
    let pending = false;
    // Hace que cada muestra tenga una fecha posterior a la anterior.
    let lastTimestamp = 0;

    const endpoint = `/api/playbackprogress?libraryId=${encodeURIComponent(identity.libraryId)}`;
    const videoIdentity = {
        videoPath: identity.videoPath,
        seriesPath: identity.seriesPath ?? null
    };

    // ----------------------------- Envío de muestras -----------------------------

    /**
     * Envía la última muestra pendiente y atiende los flush solicitados durante el envío.
     * @returns Se resuelve cuando termina el ciclo de envío.
     */
    async function drain(): Promise<void> {
        while (pending) {
            pending = false;
            const snapshot = latest;
            if (!snapshot || snapshot.recordedAtUtc === savedAt) {
                continue;
            }
            try {
                await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(snapshot),
                    keepalive: true
                }).then(readJson<void>);
                savedAt = snapshot.recordedAtUtc;
                onError('');
            } catch (error) {
                onError(`No se ha podido guardar el progreso. Se volverá a intentar: ${errorMessage(error)}`);
                // Se conserva la última muestra para reintentarlo en el siguiente guardado.
                pending = false;
                break;
            }
        }
    }

    // ---------------------------- Registro de posición ---------------------------

    /**
     * Crea un guardador por vídeo que agrupa muestras y mantiene una sola petición activa.
     * @param positionSeconds Posición actual en segundos.
     * @param durationSeconds Duración total del vídeo en segundos.
     * @returns Actualiza la última muestra válida en memoria.
     */
    function record(positionSeconds: number, durationSeconds: number): void {
        // Registra en memoria la posición más reciente con una fecha creciente.
        if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || positionSeconds <= 0) {
            return;
        }
        lastTimestamp = Math.max(Date.now(), lastTimestamp + 1);
        latest = {
            ...videoIdentity,
            positionSeconds: Math.min(positionSeconds, durationSeconds),
            durationSeconds,
            recordedAtUtc: new Date(lastTimestamp).toISOString()
        };
    }

    // --------------------------- Solicitud de guardado ---------------------------

    /**
     * Solicita el envío de la última muestra y devuelve la promesa del ciclo activo.
     * @returns Promesa del ciclo de envío activo.
     */
    function flush(): Promise<void> {
        pending = true;
        if (!running) {
            running = drain().finally(() => {
                pendingSaves.delete(running!);
                running = null;
            });
            pendingSaves.add(running);
        }
        return running;
    }

    return { record, flush };
}
