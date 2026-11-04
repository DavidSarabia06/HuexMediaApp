import { errorMessage } from '../utils/generalUtils';
import type { ProgressSaver } from '../utils/playbackProgress';
import type { MediaTrack, SubtitleCue } from '../utils/subtitles';
import type { CategoryRowItem } from '../components/SeriesCategoryRow';
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Hls from "hls.js";
import HuexPageHeader from "../components/HuexPageHeader";
import "../css/VideoPlayer.css";
import { parseSubtitles, subtitleAt, trackLabel } from "../utils/subtitles";
import { createProgressSaver } from "../utils/playbackProgress";
import { formatProgressTime } from "../utils/generalUtils";

interface PlayerNavigationState {
    libraryId?: string;
    mediaType?: 'Series' | 'Movies';
    episode?: CategoryRowItem;
    seriesPath?: string;
    startSeconds?: number;
}
interface AudioGraph { context: AudioContext; source: MediaElementAudioSourceNode; gain: GainNode; }
interface SubtitleResult { cues: SubtitleCue[]; error?: string; }
interface SubtitleData extends SubtitleResult { path: string; track: string; attempt: number; }
interface VideoInfo { duration: number; audioTracks: MediaTrack[]; subtitleTracks: MediaTrack[]; }
interface PlaybackSession { sessionId: string; timelineStartSeconds: number; transportTimestampOffsetSeconds: number; playlistUrl: string; }



// --------------------------- Funciones auxiliares ----------------------------

/** Solicita al servidor detener la sesión HLS y limpiar sus temporales, incluso al salir de la página. */
async function stopSession(sessionId: string | null | undefined) {
    if (!sessionId) {
        return;
    }

    try {
        await fetch(`/api/video/stop/${sessionId}`, {
            method: "POST",
            keepalive: true
        });
    } catch (error) {
        console.warn(
            "No se ha podido detener la sesión HLS.",
            error
        );
    }
}

/** Reproduce el episodio recibido por navegación y coordina HLS, controles, pistas y progreso. */
export default function VideoPlayer() {
    const location = useLocation();
    const navigate = useNavigate();

    const navigationState = location.state as PlayerNavigationState | null;
    const libraryId = navigationState?.libraryId;
    const isMovie = navigationState?.mediaType === 'Movies';
    const episode = navigationState?.episode;
    const videoPath = episode?.rutaCompleta ?? '';
    const seriesPath = navigationState?.seriesPath;

    // Guardador asociado a la identidad de biblioteca, serie y episodio.
    const progressSaverRef = useRef<ProgressSaver | null>(null);
    const [progressError, setProgressError] = useState('');

    // Elementos del DOM y estado de reproducción que muestran los controles.
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<HTMLDivElement>(null);
    const playAfterSeekRef = useRef(true);
    const [isPlaying, setIsPlaying] = useState(false);
    // El volumen usa 0..2; las referencias conservan la amplificación y el aviso temporal.
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const audioGraphRef = useRef<AudioGraph | null>(null);
    const volumeRef = useRef(1);
    const volumeNoticeTimerRef = useRef<number | undefined>(undefined);
    const [volumeNotice, setVolumeNotice] = useState<number | null>(null);
    // Sesión vigente y versión de petición para descartar respuestas anteriores.
    const hlsRef = useRef<Hls | null>(null);
    const sessionRef = useRef<string | null>(null);
    const requestRef = useRef(0);
    const startOffsetRef = useRef(0);

    // Tiempos globales del episodio y punto desde el que se pide iniciar la sesión.
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [startOffset, setStartOffset] = useState(0);
    const [seekTarget, setSeekTarget] = useState(() => Math.max(0, navigationState?.startSeconds ?? 0));
    // Pistas disponibles, selección y resultado del último intento de subtítulos.
    const [audioTracks, setAudioTracks] = useState<MediaTrack[]>([]);
    const [subtitleTracks, setSubtitleTracks] = useState<MediaTrack[]>([]);
    const [selectedAudio, setSelectedAudio] = useState<number | null>(null);
    const [selectedSubtitle, setSelectedSubtitle] = useState("");
    const [subtitleData, setSubtitleData] = useState<SubtitleData | null>(null);
    const [subtitleAttempt, setSubtitleAttempt] = useState(0);

    // Previsualización de la barra, espera de vídeo y ocultación de controles.
    const [isDragging, setIsDragging] = useState(false);
    const [dragTime, setDragTime] = useState(0);
    const [loading, setLoading] = useState(true);
    const [buffering, setBuffering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [controlsIdle, setControlsIdle] = useState(false);
    const [lastInteraction, setLastInteraction] = useState(0);

    const hideControls = controlsIdle && isPlaying && !loading && !buffering && !isDragging && !error;

    // ---------------------------- Volumen y silencio -----------------------------

    /** Ajusta el volumen entre 0 y 200 %, activa la amplificación cuando hace falta y muestra el porcentaje. */
    function changeVolume(value: number) {
        const video = videoRef.current;
        if (!video) {
            return;
        }
        let nextVolume = Math.round(Math.max(0, Math.min(2, value)) * 100) / 100;

        // El volumen nativo llega a 1; la ganancia permite superar el 100 %.
        if (nextVolume > 1 && !audioGraphRef.current) {
            try {
                const context = new AudioContext();
                const source = context.createMediaElementSource(video);
                const gain = context.createGain();
                source.connect(gain);
                gain.connect(context.destination);
                audioGraphRef.current = { context, source, gain };
            } catch (audioError) {
                console.warn("No se pudo activar la amplificación de audio.", audioError);
                nextVolume = 1;
            }
        }

        const graph = audioGraphRef.current;
        if (graph) {
            graph.gain.gain.value = Math.max(1, nextVolume);
            if (graph.context.state === "suspended") {
                void graph.context.resume().catch(audioError => {
                    console.warn("No se pudo reanudar el audio.", audioError);
                });
            }
        }
        video.volume = Math.min(1, nextVolume);
        video.muted = false;
        volumeRef.current = nextVolume;
        setVolume(nextVolume);
        setMuted(false);
        setVolumeNotice(Math.round(nextVolume * 100));
        window.clearTimeout(volumeNoticeTimerRef.current);
        volumeNoticeTimerRef.current = window.setTimeout(() => setVolumeNotice(null), 1200);
    }

    /** Sincroniza volumen y silencio con el vídeo, incluyendo la ganancia de amplificación. */
    function handleVolumeChange() {
        const gain = audioGraphRef.current?.gain.gain.value ?? 1;
        const currentVolume = videoRef.current!.volume * gain;
        volumeRef.current = currentVolume;
        setVolume(currentVolume);
        setMuted(videoRef.current!.muted);
    }

    /** Alterna el silencio sin cambiar el nivel de volumen guardado. */
    function toggleMute() {
        videoRef.current!.muted = !muted;
    }

    /** Aplica el valor de la barra de volumen al audio del reproductor. */
    function handleVolumeInput(event: React.ChangeEvent<HTMLInputElement>) {
        changeVolume(Number(event.target.value));
    }

    // En cada renderizado, conecta la rueda al reproductor con el manejador vigente.
    // passive:false permite cancelar el scroll de página; la limpieza retira el manejador anterior.
    useEffect(() => {
        const player = playerRef.current;
        if (!player) {
            return;
        }
        /** Sube o baja un 5 % con la rueda, respetando el zoom y los selectores de pistas. */
        function handleWheel(event: WheelEvent) {
            if (event.ctrlKey || event.deltaY === 0) {
                return;
            }
            if ((event.target as Element | null)?.closest("select")) {
                return;
            }
            event.preventDefault();
            const currentVolume = videoRef.current?.muted ? 0 : volumeRef.current;
            changeVolume(currentVolume + (event.deltaY < 0 ? 0.05 : -0.05));
        }
        player.addEventListener("wheel", handleWheel, { passive: false });
        return () => player.removeEventListener("wheel", handleWheel);
    });

    // Al desmontar, cancela el aviso de volumen y libera las conexiones y el AudioContext creados.
    useEffect(() => {
        return () => {
            window.clearTimeout(volumeNoticeTimerRef.current);
            const graph = audioGraphRef.current;
            if (graph) {
                graph.source.disconnect();
                graph.gain.disconnect();
                void graph.context.close().catch(() => {});
                audioGraphRef.current = null;
            }
        };
    }, []);

    // --------------------------- Guardado del progreso ---------------------------

    // Crea un guardador por vídeo y envía el progreso cada 10 segundos.
    // La limpieza guarda lo pendiente y retira los eventos y el temporizador.
    useEffect(() => {
        if (!libraryId || !videoPath || (!isMovie && !seriesPath)) {
            return;
        }

        const identity = {
            libraryId,
            videoPath,
            seriesPath: isMovie ? null : seriesPath
        };

        let active = true;

        const saver = createProgressSaver(identity, message => {
            if (active) {
                setProgressError(message);
            }
        });

        progressSaverRef.current = saver;

        /** Envía la última muestra registrada. */
        function save() {
            void saver.flush();
        }

        /** Guarda cuando la pestaña pasa a estar oculta. */
        function onVisibility() {
            if (document.visibilityState === 'hidden') {
                save();
            }
        }

        const timer = window.setInterval(save, 10_000);

        window.addEventListener('pagehide', save);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            active = false;

            window.clearInterval(timer);
            window.removeEventListener('pagehide', save);
            document.removeEventListener('visibilitychange', onVisibility);

            void saver.flush();

            if (progressSaverRef.current === saver) {
                progressSaverRef.current = null;
            }
        };
    }, [libraryId, seriesPath, videoPath, isMovie]);

    // ----------------------- Visibilidad de los controles ------------------------

    /** Muestra los controles y renueva el instante de interacción que reinicia su temporizador. */
    function showControls() {
        setControlsIdle(false);
        setLastInteraction(Date.now());
    }

    // Oculta los controles tras 3 segundos de reproducción sin interacción.
    // Cada cambio de actividad o estado cancela el temporizador anterior antes de programar otro.
    useEffect(() => {
        if (!isPlaying || loading || buffering || isDragging || error) {
            return;
        }
        const timer = window.setTimeout(() => setControlsIdle(true), 3000);
        return () => window.clearTimeout(timer);
    }, [isPlaying, loading, buffering, isDragging, error, lastInteraction]);

    // --------------------------- Información del vídeo ---------------------------

    // Al cambiar el vídeo, consulta duración y pistas. La limpieza cancela la petición anterior.
    useEffect(() => {
        if (!videoPath) {
            return;
        }

        const controller = new AbortController();

        /** Lee los metadatos del episodio y los aplica si la petición sigue vigente. */
        async function loadVideoInfo() {
            try {
                const response = await fetch(
                    `/api/video/info?path=${encodeURIComponent(videoPath)}`,
                    { signal: controller.signal }
                );

                if (!response.ok) {
                    throw new Error(
                        "No se ha podido obtener la información del vídeo."
                    );
                }

                const info: VideoInfo = await response.json();

                if (!controller.signal.aborted) {
                    setDuration(info.duration ?? 0);
                    setAudioTracks(info.audioTracks ?? []);
                    setSubtitleTracks(info.subtitleTracks ?? []);
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    console.error(err);
                    setError(errorMessage(err));
                }
            }
        }

        loadVideoInfo();

        return () => controller.abort();
    }, [videoPath]);

    // -------------------------------- Subtítulos ---------------------------------

    // Al elegir pista o reintentar, carga sus subtítulos con un límite de 20 segundos.
    // La limpieza cancela la petición y sus temporizadores. Los tiempos pertenecen al episodio completo.
    useEffect(() => {
        if (!videoPath || selectedSubtitle === "") {
            return;
        }
        const controller = new AbortController();
        let timeoutId: number | undefined;
        /** Asocia el resultado al vídeo, pista e intento que lo han solicitado. */
        function saveResult(result: SubtitleResult) {
            setSubtitleData({ path: videoPath, track: selectedSubtitle, attempt: subtitleAttempt, ...result });
        }
        /** Informa del tiempo agotado y cancela la petición de esta pista. */
        function handleSubtitleTimeout() {
            saveResult({ cues: [], error: "La carga de subtítulos ha superado los 20 segundos. Puedes volver a intentarlo." });
            controller.abort();
        }
        /** Descarga y valida WebVTT y transforma su texto en intervenciones con inicio y fin. */
        async function loadSubtitles() {
            timeoutId = window.setTimeout(handleSubtitleTimeout, 20_000);
            try {
                const params = new URLSearchParams({ path: videoPath, trackIndex: selectedSubtitle });
                const response = await fetch(`/api/video/subtitles?${params}`, { signal: controller.signal });
                const body = await response.text();
                if (!response.ok) {
                    let message = `No se han podido cargar los subtítulos (HTTP ${response.status}).`;
                    try {
                        const details = JSON.parse(body);
                        const detail = details.error ?? details.message ?? details.detail;
                        if (typeof detail === "string" && detail.trim()) {
                            message = detail;
                        }
                    } catch { /* Conserva el mensaje HTTP si la respuesta no es JSON. */ }
                    throw new Error(message);
                }
                if (!body.replace(/^\uFEFF/, "").trimStart().startsWith("WEBVTT")) {
                    throw new Error("El servidor no ha devuelto subtítulos WebVTT válidos.");
                }
                const cues = parseSubtitles(body);
                if (!controller.signal.aborted) {
                    saveResult({ cues });
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    saveResult({ cues: [], error: errorMessage(err) || "No se ha podido conectar para cargar los subtítulos." });
                }
            } finally {
                window.clearTimeout(timeoutId);
            }
        }
        const timer = window.setTimeout(loadSubtitles, 0);
        return () => {
            window.clearTimeout(timer);
            window.clearTimeout(timeoutId);
            controller.abort();
        };
    }, [videoPath, selectedSubtitle, subtitleAttempt]);

    /** Selecciona o desactiva subtítulos y renueva la visibilidad de los controles. */
    function changeSubtitle(event: React.ChangeEvent<HTMLSelectElement>) {
        setSelectedSubtitle(event.target.value);
        showControls();
    }

    /** Incrementa el intento que vuelve a ejecutar la carga de la pista de subtítulos. */
    function retrySubtitles() {
        setSubtitleAttempt(attempt => attempt + 1);
    }

    // ----------------------- Sesiones HLS y sincronización -----------------------

    // Al cambiar vídeo, posición solicitada o audio, prepara una sesión HLS y descarta respuestas antiguas.
    // El inicio diferido permite cancelar montajes descartados; la limpieza aborta, destruye HLS y detiene su sesión.
    useEffect(() => {
        if (!videoPath) {
            return;
        }

        const requestId = ++requestRef.current;
        const controller = new AbortController();

        let cancelled = false;
        let localSessionId: string | null = null;
        let localHls: Hls | null = null;
        let detachNativeTimeline: (() => void) | null = null;

        const video = videoRef.current;

        /** Intenta el arranque solicitado; si el navegador bloquea el sonido, prueba a reproducir silenciado. */
        async function playWhenReady() {
            if (!video || cancelled || requestId !== requestRef.current || !playAfterSeekRef.current) {
                return;
            }
            try {
                await video.play();
            } catch (err) {
                if (cancelled || requestId !== requestRef.current) {
                    return;
                }
                // Si el navegador bloquea el inicio con sonido, prueba silenciado.
                if ((err instanceof Error ? err.name : "") === "NotAllowedError") {
                    video.muted = true;
                    setMuted(true);
                    try {
                        await video.play();
                        return;
                    } catch (retryError) {
                        if (cancelled || requestId !== requestRef.current || (retryError instanceof Error ? retryError.name : "") === "AbortError") {
                            return;
                        }
                    }
                    setError("Pulsa Reproducir para iniciar el vídeo.");
                } else if ((err instanceof Error ? err.name : "") !== "AbortError") {
                    setError("No se ha podido iniciar el vídeo. Pulsa Reproducir para intentarlo de nuevo.");
                }
            }
        }

        /** Sustituye la sesión anterior, solicita una nueva y conecta Hls.js o el HLS nativo del navegador. */
        async function startPlayback() {
            setLoading(true);
            setBuffering(true);
            setError(null);

            try {
                // Destruye el reproductor anterior.
                if (hlsRef.current) {
                    hlsRef.current.destroy();
                    hlsRef.current = null;
                }

                if (video) {
                    video.pause();
                    video.removeAttribute("src");
                    video.load();
                }

                // Solicita detener la sesión anterior al preparar la siguiente.
                const previousSession = sessionRef.current;
                sessionRef.current = null;

                if (previousSession) {
                    void stopSession(previousSession);
                }

                const params = new URLSearchParams({
                    path: videoPath,
                    startSeconds: String(seekTarget)
                });
                if (selectedAudio !== null) {
                    params.set("audioTrackIndex", String(selectedAudio));
                }

                const response = await fetch(
                    `/api/video/start?${params.toString()}`,
                    {
                        method: "POST",
                        signal: controller.signal
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        "No se ha podido iniciar la reproducción."
                    );
                }

                const data: PlaybackSession = await response.json();

                localSessionId = data.sessionId;

                // Si ya existe una solicitud más reciente,
                // descarta esta sesión y la detiene.
                if (cancelled || requestId !== requestRef.current) {
                    await stopSession(localSessionId);
                    localSessionId = null;
                    return;
                }

                sessionRef.current = localSessionId;
                startOffsetRef.current = data.timelineStartSeconds;

                setStartOffset(data.timelineStartSeconds);
                setCurrentTime(data.timelineStartSeconds);

                if (!video) {
                    throw new Error(
                        "No se ha encontrado el elemento de vídeo."
                    );
                }

                if (Hls.isSupported()) {
                    localHls = new Hls({
                        // Búfer de reproducción.
                        maxBufferLength: 30,
                        maxMaxBufferLength: 60,

                        // La lista HLS es deslizante.
                        // Intentamos mantenernos lejos de su extremo.
                        liveSyncDurationCount: 15,
                        liveMaxLatencyDurationCount: 20,

                        // Comienza desde el inicio disponible.
                        startPosition: 0
                    });

                    hlsRef.current = localHls;

                    /** Recupera el desfase real del episodio desde los PTS de transporte de Hls.js. */
                    localHls.on(Hls.Events.INIT_PTS_FOUND, function handleInitialPts(_, timing) {
                        if (cancelled || requestId !== requestRef.current || timing.id !== "main" ||
                            !Number.isFinite(timing.initPTS) || !(timing.timescale > 0)) {
                            return;
                        }
                        const offset = timing.initPTS / timing.timescale - data.transportTimestampOffsetSeconds;
                        startOffsetRef.current = offset;
                        setStartOffset(offset);
                        setCurrentTime(Math.max(0, offset + video!.currentTime));
                    });

                    /** Registra el error HLS vigente y muestra los fallos fatales en la interfaz. */
                    localHls.on(Hls.Events.ERROR, function handleHlsError(_, data) {
                        if (
                            cancelled ||
                            requestId !== requestRef.current
                        ) {
                            return;
                        }

                        console.error("Error HLS:", data);

                        if (data.fatal) {
                            setError(
                                "Se ha producido un error durante la reproducción."
                            );
                            setLoading(false);
                        }
                    });

                    /** Retira la carga inicial y solicita reproducción cuando el manifiesto está preparado. */
                    localHls.on(
                        Hls.Events.MANIFEST_PARSED,
                        function handleManifestParsed() {
                            if (
                                cancelled ||
                                requestId !== requestRef.current
                            ) {
                                return;
                            }

                            setLoading(false);

                            void playWhenReady();
                        }
                    );

                    localHls.attachMedia(video);
                    localHls.loadSource(data.playlistUrl);
                } else if (
                    video.canPlayType(
                        "application/vnd.apple.mpegurl"
                    )
                ) {
                    let calibrated = false;
                    /** Calibra una vez la posición del episodio usando el primer tiempo nativo disponible. */
                    function calibrateTimeline() {
                        if (calibrated || cancelled || requestId !== requestRef.current || !video!.seekable.length) {
                            return;
                        }
                        calibrated = true;
                        const offset = data.timelineStartSeconds - video!.seekable.start(0);
                        startOffsetRef.current = offset;
                        setStartOffset(offset);
                        setCurrentTime(Math.max(0, offset + video!.currentTime));
                    }
                    video.addEventListener("loadedmetadata", calibrateTimeline);
                    video.addEventListener("canplay", calibrateTimeline);
                    /** Retira los eventos de calibración al sustituir o cerrar la sesión nativa. */
                    detachNativeTimeline = function detachNativeTimelineListeners() {
                        video.removeEventListener("loadedmetadata", calibrateTimeline);
                        video.removeEventListener("canplay", calibrateTimeline);
                    };
                    video.src = data.playlistUrl;
                    setLoading(false);

                    void playWhenReady();
                } else {
                    throw new Error(
                        "El navegador no admite reproducción HLS."
                    );
                }
            } catch (err) {
                if (cancelled || requestId !== requestRef.current) {
                    return;
                }

                console.error(err);
                setError(errorMessage(err));
                setLoading(false);
            }
        }

        /** Inicia la petición diferida solo si el efecto sigue activo. */
        function startCurrentRequest() {
            if (!cancelled) {
                void startPlayback();
            }
        }
        const startTimer = window.setTimeout(startCurrentRequest, 0);

        return () => {
            cancelled = true;
            window.clearTimeout(startTimer);
            controller.abort();
            detachNativeTimeline?.();

            if (localHls) {
                localHls.destroy();

                if (hlsRef.current === localHls) {
                    hlsRef.current = null;
                }
            }

            if (localSessionId) {
                if (sessionRef.current === localSessionId) {
                    sessionRef.current = null;
                }

                void stopSession(localSessionId);
            }
        };
    }, [videoPath, seekTarget, selectedAudio]);

    // -------------------------- Eventos de reproducción --------------------------

    /** Alterna reproducción y pausa desde el vídeo o su botón, conservando los controles visibles. */
    async function togglePlayback() {
        const video = videoRef.current;
        if (!video || loading) {
            return;
        }
        showControls();
        if (!video.paused) {
            video.pause();
        } else {
            try {
                await video.play();
            } catch {
                setError("No se ha podido reproducir el vídeo.");
            }
        }
    }

    /** Actualiza el estado visual cuando el elemento de vídeo empieza a reproducirse. */
    function handleVideoPlay() {
        setIsPlaying(true);
        setError(null);
        showControls();
    }

    /** Activa la espera de datos cuando el vídeo agota su contenido disponible. */
    function handleVideoWaiting() {
        setBuffering(true);
    }

    /** Retira la espera cuando el navegador puede reproducir o ya está reproduciendo. */
    function handleVideoReady() {
        setBuffering(false);
    }

    /** Refleja la pausa y solicita enviar la última muestra de progreso. */
    function handleVideoPause() {
        setIsPlaying(false);
        setBuffering(false);
        void progressSaverRef.current?.flush();
    }

    /** Registra el final del episodio y envía el progreso pendiente. */
    function handleVideoEnded() {
        setIsPlaying(false);
        setBuffering(false);
        progressSaverRef.current?.record(duration, duration);
        void progressSaverRef.current?.flush();
    }

    // ---------------------------- Posición y búsqueda ----------------------------

    /** Convierte el tiempo local del vídeo al del episodio y registra muestras válidas de progreso. */
    function handleTimeUpdate() {
        const video = videoRef.current;

        if (!video || isDragging) {
            return;
        }

        const globalTime = Math.max(0,
            startOffsetRef.current + video.currentTime);

        if (!loading && !buffering && !video.paused && !video.seeking) {
            progressSaverRef.current?.record(globalTime, duration);
        }

        setCurrentTime(
            duration > 0
                ? Math.min(globalTime, duration)
                : globalTime
        );
    }

    /** Limita el salto al episodio y solicita otra sesión, o ajusta la actual si coincide su inicio. */
    function handleSeek(seconds: number) {
        setIsDragging(false);
        if (!duration || loading) {
            return;
        }

        const target = Math.max(
            0,
            Math.min(seconds, duration - 0.1)
        );

        playAfterSeekRef.current = !videoRef.current!.paused;
        setCurrentTime(target);
        setIsDragging(false);

        // Si selecciona la misma posición inicial,
        // no necesitamos reiniciar la sesión.
        if (Math.abs(target - seekTarget) < 0.1) {
            const video = videoRef.current;
            const firstAvailable = video!.seekable.length ? video!.seekable.start(0) : 0;
            video!.currentTime = Math.max(firstAvailable, target - startOffsetRef.current);
            return;
        }

        setLoading(true);
        setSeekTarget(target);
    }

    /** Actualiza la posición de previsualización mientras se mueve la barra del episodio. */
    function handleSeekInput(event: React.ChangeEvent<HTMLInputElement>) {
        setIsDragging(true);
        setDragTime(Number(event.target.value));
    }

    /** Mantiene los eventos del puntero en la barra aunque salga de sus límites durante el arrastre. */
    function handleSeekPointerDown(event: React.PointerEvent<HTMLInputElement>) {
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    /** Confirma el salto al soltar el puntero sobre la barra. */
    function handleSeekPointerUp(event: React.PointerEvent<HTMLInputElement>) {
        handleSeek(Number(event.currentTarget.value));
    }

    /** Finaliza la previsualización si el navegador cancela el arrastre. */
    function handleSeekPointerCancel() {
        setIsDragging(false);
    }

    /** Confirma la posición elegida con el teclado al soltar la tecla. */
    function handleSeekKeyUp() {
        if (isDragging) {
            handleSeek(dragTime);
        }
    }

    /** Confirma el salto pendiente si el foco abandona la barra. */
    function handleSeekBlur(event: React.FocusEvent<HTMLInputElement>) {
        if (isDragging) {
            handleSeek(Number(event.currentTarget.value));
        }
    }

    // ------------------------------ Cambio de audio ------------------------------

    /** Cambia la pista de audio creando otra sesión desde la posición actual y conservando pausa/reproducción. */
    function changeAudio(event: React.ChangeEvent<HTMLSelectElement>) {
        if (loading) {
            return;
        }
        const index = Number(event.target.value);
        if (index === (selectedAudio ?? audioTracks[0]?.index)) {
            return;
        }
        playAfterSeekRef.current = !videoRef.current!.paused;
        const position = Math.max(0, Math.min(
            startOffsetRef.current + videoRef.current!.currentTime, Math.max(0, duration - 0.1)));
        setCurrentTime(position);
        setSeekTarget(position);
        setSelectedAudio(index);
        setLoading(true);
    }

    // ---------------------- Pantalla completa y navegación -----------------------

    /** Alterna la pantalla completa del contenedor del vídeo. */
    async function toggleFullscreen() {
        try {
            if (document.fullscreenElement === playerRef.current) {
                await document.exitFullscreen();
            } else {
                await playerRef.current?.requestFullscreen();
            }
        } catch {
            setError("No se ha podido cambiar la pantalla completa.");
        }
    }

    /** Vuelve a películas o a los episodios según el contenido reproducido. */
    async function handleBack() {
        videoRef.current?.pause();
        await progressSaverRef.current?.flush();

        if (isMovie) {
            navigate('/movies', { replace: true });
            return;
        }

        if (seriesPath) {
            navigate('/series/episodes', {
                replace: true,
                state: {
                    folderPath: seriesPath,
                    libraryId,
                    seriesName: seriesPath
                        .replaceAll('\\', '/')
                        .replace(/\/+$/, '')
                        .split('/')
                        .pop()
                }
            });
        } else {
            navigate('/series', { replace: true });
        }
    }

    // ---------------------------- Datos para la vista ----------------------------

    const activeSubtitles = selectedSubtitle !== "" && subtitleData?.path === videoPath &&
        subtitleData?.track === selectedSubtitle && subtitleData?.attempt === subtitleAttempt ? subtitleData : null;
    const caption = !loading && !isDragging && activeSubtitles
        ? subtitleAt(activeSubtitles.cues, currentTime) : "";

    const displayedTime = isDragging
        ? dragTime
        : currentTime;

    // ------------------------ Renderizado del reproductor ------------------------

    if (!videoPath) {
        return (
            <div style={{ padding: "20px" }}>
                <p>No se ha seleccionado ningún episodio.</p>
                <button onClick={handleBack}>
                    Volver
                </button>
            </div>
        );
    }

    return (
        <div className="huex-container huex-player-page">
            <HuexPageHeader title={episode?.nombre ?? "Reproductor"} onBack={handleBack} />

            <div
                ref={playerRef}
                className={`custom-video-player${hideControls ? " controls-hidden" : ""}`}
                onPointerMove={showControls}
                onPointerDown={showControls}
                onKeyDown={showControls}
                onFocus={showControls}
                style={{
                    position: "relative",
                    backgroundColor: "black"
                }}
            >
                <video
                    ref={videoRef}
                    playsInline
                    onClick={togglePlayback}
                    onPlay={handleVideoPlay}
                    onWaiting={handleVideoWaiting}
                    onCanPlay={handleVideoReady}
                    onPlaying={handleVideoReady}
                    onPause={handleVideoPause}
                    onEnded={handleVideoEnded}
                    onVolumeChange={handleVolumeChange}
                    onTimeUpdate={handleTimeUpdate}
                />

                {volumeNotice !== null && <div className="custom-video-volume-notice" role="status">
                    Volumen {volumeNotice} %
                </div>}

                {caption && <div className={`custom-video-caption${hideControls ? "" : " above-controls"}`}>
                    <span>{caption}</span>
                </div>}

                {selectedSubtitle !== "" && <div className="custom-subtitle-notice">
                    {!activeSubtitles ? (
                        <p className="custom-subtitle-status" role="status">Cargando subtítulos…</p>
                    ) : activeSubtitles.error ? (
                        <div className="custom-subtitle-error">
                            <p role="alert">{activeSubtitles.error}</p>
                            <button className="custom-subtitle-retry" onClick={retrySubtitles}>
                                Reintentar subtítulos
                            </button>
                        </div>
                    ) : (
                        <p className="custom-subtitle-status" role="status">
                            {activeSubtitles.cues.length > 0
                                ? `Subtítulos cargados: ${activeSubtitles.cues.length} intervenciones.`
                                : "La pista seleccionada no contiene intervenciones."}
                        </p>
                    )}
                </div>}

                {(loading || buffering) && !error && (
                    <div className="custom-video-loading" role="status" aria-live="polite">
                        <span className="custom-video-spinner" aria-hidden="true" />
                        <span>Cargando…</span>
                    </div>
                )}

            {/* Barra de tiempo global del episodio */}
            <div
                className="custom-video-controls"
                style={{
                    padding: "12px",
                    background: "linear-gradient(transparent, #000e)"
                }}
            >
                <input
                    aria-label="Posición del episodio"
                    aria-valuetext={`${formatProgressTime(displayedTime)} de ${formatProgressTime(duration)}`}
                    type="range"
                    min="0"
                    max={duration || 1}
                    step="1"
                    value={displayedTime}
                    disabled={!duration || loading}
                    onChange={handleSeekInput}
                    onPointerDown={handleSeekPointerDown}
                    onPointerUp={handleSeekPointerUp}
                    onPointerCancel={handleSeekPointerCancel}
                    onKeyUp={handleSeekKeyUp}
                    onBlur={handleSeekBlur}
                    style={{
                        width: "100%",
                        cursor: "pointer",
                        accentColor: "var(--huex-accent)"
                    }}
                />

                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "14px",
                        marginTop: "8px",
                        color: "#ccc"
                    }}
                >
                    <span>{formatProgressTime(displayedTime)}</span>
                    <span>{formatProgressTime(duration)}</span>
                </div>
                <div className="custom-video-buttons">
                    <button disabled={loading} aria-label={isPlaying ? "Pausar" : "Reproducir"}
                        onClick={togglePlayback}>
                        {isPlaying ? "❚❚" : "▶"}
                    </button>
                    <button disabled={!duration || loading} onClick={() => handleSeek(currentTime - 10)} aria-label="Retroceder 10 segundos">−10 s</button>
                    <button disabled={!duration || loading} onClick={() => handleSeek(currentTime + 10)} aria-label="Avanzar 10 segundos">+10 s</button>
                    <button onClick={toggleMute} aria-label={muted ? "Activar sonido" : "Silenciar"}>
                        {muted || volume === 0 ? "🔇" : "🔊"}
                    </button>
                    <input aria-label="Volumen" aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} %`}
                        type="range" min="0" max="2" step="0.05" value={muted ? 0 : volume}
                        onChange={handleVolumeInput} />
                    <label className="custom-video-track">
                        <span>Audio</span>
                        <select aria-label="Idioma del audio" value={selectedAudio ?? audioTracks[0]?.index ?? ""}
                            disabled={loading || audioTracks.length < 2} onChange={changeAudio}>
                            {audioTracks.length === 0 && <option value="">Sin audio</option>}
                            {audioTracks.map((track, index) => <option key={track.index} value={track.index}>
                                {trackLabel(track, index)}
                            </option>)}
                        </select>
                    </label>
                    <label className="custom-video-track">
                        <span>Subtítulos</span>
                        <select aria-label="Idioma de los subtítulos" value={selectedSubtitle}
                            disabled={subtitleTracks.length === 0}
                            onChange={changeSubtitle}>
                            <option value="">{subtitleTracks.length ? "Desactivados" : "Sin subtítulos"}</option>
                            {subtitleTracks.map((track, index) => <option key={track.index} value={String(track.index)}
                                disabled={!track.isSupported}>
                                {trackLabel(track, index)}{!track.isSupported ? " · No compatible" : ""}
                            </option>)}
                        </select>
                    </label>
                    <button className="custom-video-fullscreen" aria-label="Alternar pantalla completa"
                        onClick={toggleFullscreen}>⛶</button>
                </div>
            </div>
            </div>

            {error && (
                <p style={{ color: "#ff7777", marginTop: "14px" }}>
                    {error}
                </p>
            )}
            {progressError && <p role="alert" className="episode-progress-error">{progressError}</p>}

            <p
                style={{
                    color: "#888",
                    fontSize: "12px",
                    marginTop: "12px"
                }}
            >
                Sesión iniciada desde: {formatProgressTime(startOffset)}
            </p>
        </div>
    );
}

