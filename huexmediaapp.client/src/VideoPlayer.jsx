
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Hls from "hls.js";
import HuexPageHeader from "./HuexPageHeader";
import "./css/VideoPlayer.css";
import { parseSubtitles, subtitleAt, trackLabel } from "./subtitles";

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) {
        return "00:00";
    }

    const totalSeconds = Math.floor(Math.max(0, seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    const pad = (value) => String(value).padStart(2, "0");

    return hours > 0
        ? `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`
        : `${pad(minutes)}:${pad(remainingSeconds)}`;
}

async function stopSession(sessionId) {
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

export default function VideoPlayer() {
    const location = useLocation();
    const navigate = useNavigate();

    const episode = location.state?.episode;
    const videoPath = episode?.rutaCompleta;

    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const playAfterSeekRef = useRef(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const hlsRef = useRef(null);
    const sessionRef = useRef(null);
    const requestRef = useRef(0);
    const startOffsetRef = useRef(0);

    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [startOffset, setStartOffset] = useState(0);
    const [seekTarget, setSeekTarget] = useState(0);
    const [audioTracks, setAudioTracks] = useState([]);
    const [subtitleTracks, setSubtitleTracks] = useState([]);
    const [selectedAudio, setSelectedAudio] = useState(null);
    const [selectedSubtitle, setSelectedSubtitle] = useState("");
    const [subtitleData, setSubtitleData] = useState(null);

    const [isDragging, setIsDragging] = useState(false);
    const [dragTime, setDragTime] = useState(0);
    const [loading, setLoading] = useState(true);
    const [buffering, setBuffering] = useState(false);
    const [error, setError] = useState(null);
    const [controlsIdle, setControlsIdle] = useState(false);
    const [lastInteraction, setLastInteraction] = useState(0);

    const hideControls = controlsIdle && isPlaying && !loading && !buffering && !isDragging && !error;

    function showControls() {
        setControlsIdle(false);
        setLastInteraction(Date.now());
    }

    useEffect(() => {
        if (!isPlaying || loading || buffering || isDragging || error) return;
        const timer = window.setTimeout(() => setControlsIdle(true), 3000);
        return () => window.clearTimeout(timer);
    }, [isPlaying, loading, buffering, isDragging, error, lastInteraction]);

    // Obtiene la duración total del episodio.
    useEffect(() => {
        if (!videoPath) {
            return;
        }

        const controller = new AbortController();

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

                const info = await response.json();

                if (!controller.signal.aborted) {
                    setDuration(info.duration ?? 0);
                    setAudioTracks(info.audioTracks ?? []);
                    setSubtitleTracks(info.subtitleTracks ?? []);
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    console.error(err);
                    setError(err.message);
                }
            }
        }

        loadVideoInfo();

        return () => controller.abort();
    }, [videoPath]);

    // Las marcas de tiempo pertenecen al episodio completo, no a cada sesión HLS.
    useEffect(() => {
        if (!videoPath || selectedSubtitle === "") return;
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const params = new URLSearchParams({ path: videoPath, trackIndex: selectedSubtitle });
                const response = await fetch(`/api/video/subtitles?${params}`, { signal: controller.signal });
                if (!response.ok) throw new Error("No se han podido cargar los subtítulos.");
                const cues = parseSubtitles(await response.text());
                if (!controller.signal.aborted) {
                    setSubtitleData({ path: videoPath, track: selectedSubtitle, cues });
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setSubtitleData({ path: videoPath, track: selectedSubtitle, cues: [], error: err.message });
                }
            }
        }, 0);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [videoPath, selectedSubtitle]);

    // Inicia una nueva sesión cada vez que cambia la posición.
    useEffect(() => {
        if (!videoPath) {
            return;
        }

        const requestId = ++requestRef.current;
        const controller = new AbortController();

        let cancelled = false;
        let localSessionId = null;
        let localHls = null;

        const video = videoRef.current;

        async function playWhenReady() {
            if (!video || cancelled || requestId !== requestRef.current || !playAfterSeekRef.current) return;
            try {
                await video.play();
            } catch (err) {
                if (cancelled || requestId !== requestRef.current) return;
                // Si el navegador bloquea el inicio con sonido, prueba silenciado.
                if (err.name === "NotAllowedError") {
                    video.muted = true;
                    setMuted(true);
                    try {
                        await video.play();
                        return;
                    } catch (retryError) {
                        if (cancelled || requestId !== requestRef.current || retryError.name === "AbortError") return;
                    }
                    setError("Pulsa Reproducir para iniciar el vídeo.");
                } else if (err.name !== "AbortError") {
                    setError("No se ha podido iniciar el vídeo. Pulsa Reproducir para intentarlo de nuevo.");
                }
            }
        }

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

                // Detiene la sesión anterior antes de iniciar otra.
                const previousSession = sessionRef.current;
                sessionRef.current = null;

                if (previousSession) {
                    void stopSession(previousSession);
                }

                const params = new URLSearchParams({
                    path: videoPath,
                    startSeconds: String(seekTarget)
                });
                if (selectedAudio !== null) params.set("audioTrackIndex", String(selectedAudio));

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

                const data = await response.json();

                localSessionId = data.sessionId;

                // Si ya existe una solicitud más reciente,
                // descarta esta sesión y la detiene.
                if (cancelled || requestId !== requestRef.current) {
                    await stopSession(localSessionId);
                    localSessionId = null;
                    return;
                }

                sessionRef.current = localSessionId;
                startOffsetRef.current = seekTarget;

                setStartOffset(seekTarget);
                setCurrentTime(seekTarget);

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

                    localHls.on(Hls.Events.ERROR, (_, data) => {
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

                    localHls.on(
                        Hls.Events.MANIFEST_PARSED,
                        () => {
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
                setError(err.message);
                setLoading(false);
            }
        }

        const startTimer = window.setTimeout(() => {
            if (!cancelled) {
                void startPlayback();
            }
        }, 0);

        return () => {
            cancelled = true;
            window.clearTimeout(startTimer);
            controller.abort();

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

    // Actualiza la posición global mostrada.
    function handleTimeUpdate() {
        const video = videoRef.current;

        if (!video || isDragging) {
            return;
        }

        const globalTime =
            startOffsetRef.current + video.currentTime;

        setCurrentTime(
            duration > 0
                ? Math.min(globalTime, duration)
                : globalTime
        );
    }

    // Solicita una nueva sesión desde el segundo seleccionado.
    function handleSeek(seconds) {
        setIsDragging(false);
        if (!duration || loading) {
            return;
        }

        const target = Math.max(
            0,
            Math.min(seconds, duration - 0.1)
        );

        playAfterSeekRef.current = !videoRef.current.paused;
        setCurrentTime(target);
        setIsDragging(false);

        // Si selecciona la misma posición inicial,
        // no necesitamos reiniciar la sesión.
        if (Math.abs(target - seekTarget) < 0.1) {
            videoRef.current.currentTime = 0;
            return;
        }

        setLoading(true);
        setSeekTarget(target);
    }

    async function togglePlayback() {
        const video = videoRef.current;
        if (!video || loading) return;
        showControls();
        if (!video.paused) {
            video.pause();
        } else {
            try { await video.play(); }
            catch { setError("No se ha podido reproducir el vídeo."); }
        }
    }

    function changeAudio(event) {
        if (loading) return;
        const index = Number(event.target.value);
        if (index === (selectedAudio ?? audioTracks[0]?.index)) return;
        playAfterSeekRef.current = !videoRef.current.paused;
        const position = Math.max(0, Math.min(
            startOffsetRef.current + videoRef.current.currentTime, Math.max(0, duration - 0.1)));
        setCurrentTime(position);
        setSeekTarget(position);
        setSelectedAudio(index);
        setLoading(true);
    }

    const activeSubtitles = selectedSubtitle !== "" && subtitleData?.path === videoPath &&
        subtitleData?.track === selectedSubtitle ? subtitleData : null;
    const caption = !loading && !isDragging && activeSubtitles
        ? subtitleAt(activeSubtitles.cues, currentTime) : "";

    const displayedTime = isDragging
        ? dragTime
        : currentTime;

    if (!videoPath) {
        return (
            <div style={{ padding: "20px" }}>
                <p>No se ha seleccionado ningún episodio.</p>
                <button onClick={() => navigate(-1)}>
                    Volver
                </button>
            </div>
        );
    }

    return (
        <div className="huex-container huex-player-page">
            <HuexPageHeader title={episode?.nombre ?? "Reproductor"} onBack={() => navigate(-1)} />

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
                    onPlay={() => { setIsPlaying(true); setError(null); showControls(); }}
                    onWaiting={() => setBuffering(true)}
                    onCanPlay={() => setBuffering(false)}
                    onPlaying={() => setBuffering(false)}
                    onPause={() => { setIsPlaying(false); setBuffering(false); }}
                    onEnded={() => { setIsPlaying(false); setBuffering(false); }}
                    onVolumeChange={() => {
                        setVolume(videoRef.current.volume);
                        setMuted(videoRef.current.muted);
                    }}
                    onTimeUpdate={handleTimeUpdate}
                />

                {caption && <div className={`custom-video-caption${hideControls ? "" : " above-controls"}`}>
                    <span>{caption}</span>
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
                    aria-valuetext={`${formatTime(displayedTime)} de ${formatTime(duration)}`}
                    type="range"
                    min="0"
                    max={duration || 1}
                    step="1"
                    value={displayedTime}
                    disabled={!duration || loading}
                    onChange={(event) => {
                        setIsDragging(true);
                        setDragTime(Number(event.target.value));
                    }}
                    onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
                    onPointerUp={(event) => handleSeek(Number(event.currentTarget.value))}
                    onPointerCancel={() => setIsDragging(false)}
                    onKeyUp={() => {
                        if (isDragging) {
                            handleSeek(dragTime);
                        }
                    }}
                    onBlur={(event) => {
                        if (isDragging) handleSeek(Number(event.currentTarget.value));
                    }}
                    style={{
                        width: "100%",
                        cursor: "pointer",
                        accentColor: "#e50914"
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
                    <span>{formatTime(displayedTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
                <div className="custom-video-buttons">
                    <button disabled={loading} aria-label={isPlaying ? "Pausar" : "Reproducir"}
                        onClick={togglePlayback}>
                        {isPlaying ? "❚❚" : "▶"}
                    </button>
                    <button disabled={!duration || loading} onClick={() => handleSeek(currentTime - 10)} aria-label="Retroceder 10 segundos">−10 s</button>
                    <button disabled={!duration || loading} onClick={() => handleSeek(currentTime + 10)} aria-label="Avanzar 10 segundos">+10 s</button>
                    <button onClick={() => { videoRef.current.muted = !muted; }} aria-label={muted ? "Activar sonido" : "Silenciar"}>
                        {muted || volume === 0 ? "🔇" : "🔊"}
                    </button>
                    <input aria-label="Volumen" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                        onChange={(event) => {
                            videoRef.current.volume = Number(event.target.value);
                            videoRef.current.muted = false;
                        }} />
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
                            onChange={(event) => { setSelectedSubtitle(event.target.value); showControls(); }}>
                            <option value="">{subtitleTracks.length ? "Desactivados" : "Sin subtítulos"}</option>
                            {subtitleTracks.map((track, index) => <option key={track.index} value={String(track.index)}
                                disabled={!track.isSupported}>
                                {trackLabel(track, index)}{!track.isSupported ? " · No compatible" : ""}
                            </option>)}
                        </select>
                    </label>
                    <button className="custom-video-fullscreen" aria-label="Alternar pantalla completa"
                        onClick={async () => {
                            try {
                                if (document.fullscreenElement === playerRef.current) await document.exitFullscreen();
                                else await playerRef.current.requestFullscreen();
                            } catch { setError("No se ha podido cambiar la pantalla completa."); }
                        }}>⛶</button>
                </div>
            </div>
            </div>

            {selectedSubtitle !== "" && !activeSubtitles && <p className="custom-subtitle-status" role="status">Cargando subtítulos…</p>}
            {activeSubtitles?.error && <p className="custom-subtitle-error" role="alert">{activeSubtitles.error}</p>}

            {error && (
                <p style={{ color: "#ff7777", marginTop: "14px" }}>
                    {error}
                </p>
            )}

            <p
                style={{
                    color: "#888",
                    fontSize: "12px",
                    marginTop: "12px"
                }}
            >
                Sesión iniciada desde: {formatTime(startOffset)}
            </p>
        </div>
    );
}

