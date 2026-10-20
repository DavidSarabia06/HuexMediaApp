// ------------------------- Coordinación de guardados -------------------------

// Promesas de envío activas, compartidas por los guardadores del módulo.
const pendingSaves = new Set();

/** Espera los envíos registrados en este momento, aunque alguno termine con error. */
export async function waitForProgressSaves() {
    await Promise.allSettled([...pendingSaves]);
}

// --------------------------- Funciones auxiliares ----------------------------

/** Unifica separadores y mayúsculas para comparar rutas de series y episodios. */
export function pathKey(path) {
    return path.replaceAll('/', '\\').replace(/\\+$/, '').toUpperCase();
}

/** Convierte segundos a minutos:segundos o a horas:minutos:segundos. */
export function formatProgressTime(seconds) {
    const total = Math.floor(Math.max(0, seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total / 60) % 60;
    const rest = String(total % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/** Lee el JSON y convierte respuestas fallidas o nulas en un error para el cliente. */
export async function readProgressResponse(response) {
    const data = await response.json().catch(() => null);
    if (!response.ok || data === null) {
        throw new Error(data?.error ?? 'No se ha podido cargar o guardar el progreso.');
    }
    return data;
}

// ----------------------------- Continuar viendo ------------------------------

/** Construye las tarjetas de continuación a partir del progreso y los episodios disponibles. */
export async function loadContinueWatching(libraryPath, series, signal) {
    await waitForProgressSaves();
    if (signal?.aborted) {
        return [];
    }
    const saved = await fetch(`/api/playbackprogress?libraryPath=${encodeURIComponent(libraryPath)}`, { signal })
        .then(readProgressResponse);
    const available = new Map(series.map(item => [pathKey(item.rutaCompleta), item]));
    const entries = saved.series.filter(item => (item.inProgress || item.lastWatchedEpisodePath || item.watchedEpisodePaths?.length) && available.has(pathKey(item.seriesPath)))
        .sort((left, right) => Date.parse(right.lastRecordedAtUtc) - Date.parse(left.lastRecordedAtUtc));
    /** Localiza el episodio en curso o el siguiente pendiente y prepara su tarjeta. */
    async function loadSeriesEpisode(entry) {
        const data = await fetch(`/api/series/scan-episodes?path=${encodeURIComponent(entry.seriesPath)}`, { signal })
            .then(readProgressResponse);
        /** Ordena nombres en español teniendo en cuenta los números de temporada y episodio. */
        function compareNames(left, right) {
            return left.localeCompare(right, 'es', { numeric: true, sensitivity: 'base' });
        }
        const ordered = [...data.temporadas].sort((left, right) => compareNames(left.nombreTemporada ?? '', right.nombreTemporada ?? ''))
            .flatMap(season => [...season.episodios].sort((left, right) => compareNames(left.nombre, right.nombre)));
        let episode;
        const nextEpisode = !entry.inProgress;
        if (entry.inProgress) {
            episode = ordered.find(item => pathKey(item.rutaCompleta) === pathKey(entry.inProgress.episodePath));
        } else {
            // Compatibilidad con los JSON guardados antes de añadir LastWatchedEpisodePath.
            const lastWatched = entry.lastWatchedEpisodePath ?? entry.watchedEpisodePaths?.at(-1);
            const index = ordered.findIndex(item => pathKey(item.rutaCompleta) === pathKey(lastWatched));
            const watched = new Set((entry.watchedEpisodePaths ?? []).map(pathKey));
            if (index >= 0) {
                episode = ordered.slice(index + 1).find(item => !watched.has(pathKey(item.rutaCompleta)));
            }
        }
        if (!episode) {
            return null;
        }
        const seriesName = available.get(pathKey(entry.seriesPath)).nombre;
        return { ...episode, nombre: `${seriesName} · ${episode.nombre}`, seriesPath: entry.seriesPath, nextEpisode,
            playbackProgress: entry.inProgress
                ? { ...entry.inProgress, label: `Continuar desde ${formatProgressTime(entry.inProgress.positionSeconds)}` }
                : { episodePath: episode.rutaCompleta, positionSeconds: 0, durationSeconds: 0 } };
    }

    const episodes = await Promise.all(entries.map(loadSeriesEpisode));
    return episodes.filter(Boolean);
}

// --------------------------- Guardador de progreso ---------------------------

/** Crea un guardador por episodio que agrupa muestras y mantiene una sola petición activa. */
export function createProgressSaver(identity, onError) {
    // Última muestra registrada y fecha de la última confirmada por el servidor.
    let latest = null;
    let savedAt = null;
    // Envío activo y petición de volver a revisar la última muestra.
    let running = null;
    let pending = false;
    // Hace que cada muestra tenga una fecha posterior a la anterior.
    let lastTimestamp = 0;

    /** Envía la última muestra pendiente y atiende los flush solicitados durante el envío. */
    async function drain() {
        while (pending) {
            pending = false;
            const snapshot = latest;
            if (!snapshot || snapshot.recordedAtUtc === savedAt) {
                continue;
            }
            try {
                await fetch('/api/playbackprogress', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(snapshot),
                    keepalive: true
                }).then(readProgressResponse);
                savedAt = snapshot.recordedAtUtc;
                onError('');
            } catch (error) {
                onError(`No se ha podido guardar el progreso. Se volverá a intentar: ${error.message}`);
                // Se conserva la última muestra para reintentarlo en el siguiente guardado.
                pending = false;
                break;
            }
        }
    }

    /** Guarda en memoria una posición válida, limitada a la duración, con fecha UTC creciente. */
    function record(positionSeconds, durationSeconds) {
        if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || positionSeconds <= 0) {
            return;
        }
        lastTimestamp = Math.max(Date.now(), lastTimestamp + 1);
        latest = {
            ...identity,
            positionSeconds: Math.min(positionSeconds, durationSeconds),
            durationSeconds,
            recordedAtUtc: new Date(lastTimestamp).toISOString()
        };
    }

    /** Solicita el envío de la última muestra y devuelve la promesa del ciclo activo. */
    function flush() {
        pending = true;
        if (!running) {
            running = drain().finally(() => {
                pendingSaves.delete(running);
                running = null;
            });
            pendingSaves.add(running);
        }
        return running;
    }

    return { record, flush };
}
