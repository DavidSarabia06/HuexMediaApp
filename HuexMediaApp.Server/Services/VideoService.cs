
using HuexMediaApp.Server.Models;
using System.Diagnostics;
using System.Globalization;
using System.Text.Json.Nodes;
using System.Collections.Concurrent;

namespace HuexMediaApp.Server.Services;

public class VideoService
{

    // VideoService: ejecutar ffprobe y ffmpeg, administrar procesos
    // y sesiones de reproducción.

    private readonly string _ffprobePath;
    private readonly string _ffmpegPath;
    private readonly ILogger<VideoService> _logger;

    // Almacena los procesos FFmpeg activos, identificados por sesión.
    private readonly ConcurrentDictionary<string, Process> _activeSessions = new();

    // Carpetas pendientes de borrar.
    private readonly ConcurrentDictionary<string, byte> _pendingCleanup = new();

    // Evita ejecutar dos limpiezas simultáneas.
    private readonly SemaphoreSlim _cleanupLock = new(1, 1);
    
    public VideoService(
        IHostEnvironment environment,
        ILogger<VideoService> logger)
    {
        _logger = logger;

        // Localiza FFprobe dentro del proyecto.
        _ffprobePath = Path.Combine(
            environment.ContentRootPath,
            "Tools",
            "FFmpeg",
            "ffprobe.exe"
        );

        _ffmpegPath = Path.Combine(
            environment.ContentRootPath,
            "Tools",
            "FFmpeg",
            "ffmpeg.exe"
        );
    }

    /// <summary>
    /// Obtiene la información técnica de un archivo de vídeo.
    /// </summary>
    public async Task<VideoInfo> GetVideoInfoAsync(string path, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException(
                "No se ha encontrado el archivo de vídeo.",
                path
            );
        }

        // Configura la ejecución de FFprobe.
        ProcessStartInfo startInfo = new()
        {
            FileName = _ffprobePath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        startInfo.ArgumentList.Add("-v");
        startInfo.ArgumentList.Add("error");
        startInfo.ArgumentList.Add("-show_entries");
        startInfo.ArgumentList.Add(
            "format=duration:stream=index,codec_type,codec_name,width,height:stream_tags=language,title:stream_disposition=default,forced"
        );
        startInfo.ArgumentList.Add("-of");
        startInfo.ArgumentList.Add("json");
        startInfo.ArgumentList.Add(path);

        using Process process = new()
        {
            StartInfo = startInfo
        };

        process.Start();
        using var cancellationRegistration = cancellationToken.Register(() =>
        {
            try { process.Kill(entireProcessTree: true); }
            catch (InvalidOperationException) { }
            catch (System.ComponentModel.Win32Exception) { }
        });

        // Lee la salida de FFprobe y espera a que termine.
        Task<string> outputTask = process.StandardOutput.ReadToEndAsync();
        Task<string> errorTask = process.StandardError.ReadToEndAsync();

        await process.WaitForExitAsync();
        cancellationToken.ThrowIfCancellationRequested();

        string output = await outputTask;
        string error = await errorTask;

        if (process.ExitCode != 0)
        {
            _logger.LogError(
                "Error al analizar el vídeo '{Path}': {Error}",
                path,
                error
            );

            throw new InvalidOperationException(
                "No se ha podido analizar el archivo de vídeo."
            );
        }

        // Convierte la respuesta de FFprobe en un objeto JSON.
        JsonObject root = JsonNode.Parse(output)!.AsObject();

        VideoInfo videoInfo = new();

        // Obtiene la duración del vídeo.
        string? duration = root["format"]?["duration"]?.GetValue<string>();

        if (double.TryParse(
            duration,
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out double seconds))
        {
            videoInfo.Duration = seconds;
        }

        // Obtiene los códecs y la resolución.
        if (root["streams"] is JsonArray streams)
        {
            foreach (JsonNode? stream in streams)
            {
                if (stream is null)
                    continue;

                string codecType = stream["codec_type"]?.GetValue<string>() ?? "";
                string codecName = stream["codec_name"]?.GetValue<string>() ?? "";

                if (codecType is "audio" or "subtitle")
                {
                    var track = new MediaTrack
                    {
                        Index = stream["index"]!.GetValue<int>(),
                        Codec = codecName,
                        Language = stream["tags"]?["language"]?.GetValue<string>() ?? "und",
                        Title = stream["tags"]?["title"]?.GetValue<string>() ?? "",
                        IsDefault = stream["disposition"]?["default"]?.GetValue<int>() == 1,
                        IsForced = stream["disposition"]?["forced"]?.GetValue<int>() == 1,
                        IsSupported = codecType == "audio" || IsTextSubtitle(codecName)
                    };
                    if (codecType == "audio") videoInfo.AudioTracks.Add(track);
                    else videoInfo.SubtitleTracks.Add(track);
                }

                if (codecType == "video" && videoInfo.VideoCodec == "")
                {
                    videoInfo.VideoCodec = codecName;
                    videoInfo.Width = stream["width"]?.GetValue<int>() ?? 0;
                    videoInfo.Height = stream["height"]?.GetValue<int>() ?? 0;
                }
                else if (codecType == "audio" && videoInfo.AudioCodec == "")
                {
                    videoInfo.AudioCodec = codecName;
                }
            }
        }

        // Comprueba si los códecs son compatibles con el navegador.
        videoInfo.RequiresTranscoding =
            videoInfo.VideoCodec != "h264" ||
            videoInfo.AudioCodec != "aac";

        _logger.LogInformation(
            "Vídeo analizado: {Path}. Vídeo: {VideoCodec}, audio: {AudioCodec}.",
            path,
            videoInfo.VideoCodec,
            videoInfo.AudioCodec
        );

        return videoInfo;
    }

    private static bool IsTextSubtitle(string codec) => codec is
        "subrip" or "ass" or "ssa" or "webvtt" or "mov_text" or "text";

    public async Task<string> GetSubtitlesAsync(string path, int trackIndex, CancellationToken cancellationToken)
    {
        var info = await GetVideoInfoAsync(path, cancellationToken);
        var track = info.SubtitleTracks.FirstOrDefault(t => t.Index == trackIndex)
            ?? throw new ArgumentException("La pista de subtítulos no existe.");
        if (!track.IsSupported)
            throw new ArgumentException("Los subtítulos de imagen todavía no son compatibles.");

        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = _ffmpegPath,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                StandardOutputEncoding = System.Text.Encoding.UTF8
            }
        };
        foreach (var argument in new[] { "-v", "error", "-i", path, "-map", $"0:{trackIndex}",
                     "-c:s", "webvtt", "-f", "webvtt", "pipe:1" })
            process.StartInfo.ArgumentList.Add(argument);

        cancellationToken.ThrowIfCancellationRequested();
        process.Start();
        using var registration = cancellationToken.Register(() =>
        {
            try { process.Kill(entireProcessTree: true); }
            catch (InvalidOperationException) { }
            catch (System.ComponentModel.Win32Exception) { }
        });
        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        cancellationToken.ThrowIfCancellationRequested();
        var output = await outputTask;
        var error = await errorTask;
        if (process.ExitCode != 0)
        {
            _logger.LogWarning("Error al extraer subtítulos: {Error}", error);
            throw new InvalidOperationException("No se han podido extraer los subtítulos.");
        }
        // Se devuelve en memoria: no se crean nuevas carpetas temporales.
        return output;
    }

    public string GetHlsFilePath(string sessionId, string fileName)
    {
        // Valida el identificador de la sesión.
        if (!Guid.TryParseExact(sessionId, "N", out _))
        {
            throw new ArgumentException(
                "El identificador de la sesión no es válido."
            );
        }

        // Solo permite la lista de reproducción y los segmentos HLS.
        bool isPlaylist = fileName == "index.m3u8";

        bool isSegment =
            System.Text.RegularExpressions.Regex.IsMatch(
                fileName,
                @"^segment_\d{5,}\.ts$"
            );

        if (!isPlaylist && !isSegment)
        {
            throw new ArgumentException(
                "El archivo HLS solicitado no es válido."
            );
        }

        string sessionDirectory = Path.Combine(
            Path.GetTempPath(),
            "HuexMedia",
            "Hls",
            sessionId
        );

        return Path.Combine(sessionDirectory, fileName);
    }


    public async Task<string> StartHlsAsync(
        string path,
        double startSeconds = 0,
        CancellationToken cancellationToken = default,
        int? audioTrackIndex = null)
    {
        cancellationToken.ThrowIfCancellationRequested();
        // Comprueba que el archivo de vídeo existe.
        if (!File.Exists(path))
        {
            throw new FileNotFoundException(
                "No se ha encontrado el archivo de vídeo.",
                path
            );
        }

        // Analiza los códecs y la duración del vídeo.
        VideoInfo videoInfo = await GetVideoInfoAsync(path, cancellationToken);
        cancellationToken.ThrowIfCancellationRequested();
        if (audioTrackIndex.HasValue && !videoInfo.AudioTracks.Any(t => t.Index == audioTrackIndex.Value))
            throw new ArgumentException("La pista de audio no existe.");

        // Valida la posición inicial solicitada.
        if (!double.IsFinite(startSeconds) ||
            startSeconds < 0 ||
            (videoInfo.Duration > 0 && startSeconds >= videoInfo.Duration))
        {
            throw new ArgumentException(
                "La posición inicial del vídeo no es válida.",
                nameof(startSeconds)
            );
        }

        // Genera un identificador único para la sesión.
        string sessionId = Guid.NewGuid().ToString("N");

        // Crea una carpeta temporal independiente.
        string outputDirectory = Path.Combine(
            Path.GetTempPath(),
            "HuexMedia",
            "Hls",
            sessionId
        );

        try
        {
            Directory.CreateDirectory(outputDirectory);

            // Ruta del manifiesto HLS.
            string playlistPath = Path.Combine(
                outputDirectory,
                "index.m3u8"
            );

            // Configura FFmpeg.
            ProcessStartInfo startInfo = new()
            {
                FileName = _ffmpegPath,
                RedirectStandardOutput = false,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            // Reduce los mensajes de FFmpeg.
            startInfo.ArgumentList.Add("-hide_banner");
            startInfo.ArgumentList.Add("-loglevel");
            startInfo.ArgumentList.Add("error");

            // Lee el archivo aproximadamente a 5 veces
            // la velocidad normal de reproducción.
            startInfo.ArgumentList.Add("-readrate");
            startInfo.ArgumentList.Add("1.5");

            // Busca la posición solicitada antes de abrir el archivo.
            // La precisión depende de los fotogramas clave si copiamos
            // el vídeo sin recodificarlo.
            if (startSeconds > 0)
            {
                startInfo.ArgumentList.Add("-ss");
                startInfo.ArgumentList.Add(
                    startSeconds.ToString(CultureInfo.InvariantCulture)
                );
            }

            // Archivo original.
            startInfo.ArgumentList.Add("-i");
            startInfo.ArgumentList.Add(path);

            // Selecciona la primera pista de vídeo.
            startInfo.ArgumentList.Add("-map");
            startInfo.ArgumentList.Add("0:v:0");

            // Selecciona la primera pista de audio si existe.
            startInfo.ArgumentList.Add("-map");
            startInfo.ArgumentList.Add(audioTrackIndex.HasValue ? $"0:{audioTrackIndex.Value}" : "0:a:0?");

            // Conserva H.264 si es compatible.
            // En caso contrario, convierte el vídeo.
            startInfo.ArgumentList.Add("-c:v");
            startInfo.ArgumentList.Add(
                videoInfo.VideoCodec == "h264"
                    ? "copy"
                    : "libx264"
            );

            // Convierte el audio a AAC.
            // Conservamos la configuración que ya funciona.
            startInfo.ArgumentList.Add("-c:a");
            startInfo.ArgumentList.Add("aac");

            // Bitrate del audio.
            startInfo.ArgumentList.Add("-b:a");
            startInfo.ArgumentList.Add("192k");

            // Frecuencia de muestreo.
            startInfo.ArgumentList.Add("-ar");
            startInfo.ArgumentList.Add("48000");

            // Audio estéreo.
            startInfo.ArgumentList.Add("-ac");
            startInfo.ArgumentList.Add("2");

            // Evita timestamps negativos.
            startInfo.ArgumentList.Add("-avoid_negative_ts");
            startInfo.ArgumentList.Add("make_zero");

            // Formato HLS.
            startInfo.ArgumentList.Add("-f");
            startInfo.ArgumentList.Add("hls");

            // Duración objetivo de los segmentos.
            startInfo.ArgumentList.Add("-hls_time");
            startInfo.ArgumentList.Add("4");

            // Mantiene los últimos 20 segmentos
            // dentro del manifiesto HLS.
            startInfo.ArgumentList.Add("-hls_list_size");
            startInfo.ArgumentList.Add("20");

            // Elimina segmentos antiguos cuando salen
            // de la ventana de reproducción.
            startInfo.ArgumentList.Add("-hls_flags");
            startInfo.ArgumentList.Add(
                "delete_segments+omit_endlist"
            );

            // Conserva algunos segmentos antiguos temporalmente
            // para permitir descargas que todavía estén pendientes.
            startInfo.ArgumentList.Add("-hls_delete_threshold");
            startInfo.ArgumentList.Add("5");

            // Nombres de los segmentos generados.
            startInfo.ArgumentList.Add("-hls_segment_filename");
            startInfo.ArgumentList.Add(
                Path.Combine(
                    outputDirectory,
                    "segment_%05d.ts"
                )
            );

            // Ruta del manifiesto.
            startInfo.ArgumentList.Add(playlistPath);

            // Crea el proceso FFmpeg.
            Process process = new()
            {
                StartInfo = startInfo
            };

            try
            {
                // Inicia FFmpeg.
                if (!process.Start())
                {
                    throw new InvalidOperationException(
                        "No se ha podido iniciar FFmpeg."
                    );
                }

                // Registra la sesión para poder detenerla.
                if (!_activeSessions.TryAdd(sessionId, process))
                {
                    throw new InvalidOperationException(
                        "No se ha podido registrar la sesión HLS."
                    );
                }
            }
            catch
            {
                // Detiene el proceso si falló su inicialización.
                try
                {
                    if (process.Id != 0 && !process.HasExited)
                    {
                        process.Kill(entireProcessTree: true);
                        await process.WaitForExitAsync();
                    }
                }
                catch (InvalidOperationException)
                {
                    // El proceso no llegó a iniciarse
                    // o ya había terminado.
                }
                finally
                {
                    process.Dispose();
                }

                throw;
            }

            // Lee los errores de FFmpeg en segundo plano
            // para evitar que se bloquee su búfer de salida.
            Task<string> errorTask =
                process.StandardError.ReadToEndAsync();

            // Espera hasta 30 segundos a que aparezca
            // un manifiesto con al menos un segmento disponible.
            bool playlistReady = false;

            for (int attempt = 0; attempt < 300; attempt++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (File.Exists(playlistPath))
                {
                    string playlist = await File.ReadAllTextAsync(
                        playlistPath,
                        cancellationToken
                    );

                    // No basta con que exista el manifiesto:
                    // debe incluir un segmento que ya se haya generado.
                    string? segmentName = playlist
                        .Split('\n')
                        .Select(line => line.Trim())
                        .FirstOrDefault(line =>
                            line.StartsWith("segment_") &&
                            line.EndsWith(".ts")
                        );

                    if (segmentName != null)
                    {
                        string segmentPath = Path.Combine(
                            outputDirectory,
                            segmentName
                        );

                        if (File.Exists(segmentPath) &&
                            new FileInfo(segmentPath).Length > 0)
                        {
                            playlistReady = true;
                            break;
                        }
                    }
                }

                // FFmpeg terminó antes de preparar el contenido.
                if (process.HasExited)
                {
                    break;
                }

                await Task.Delay(100, cancellationToken);
            }

            // Si no pudo preparar la reproducción,
            // detiene el proceso y limpia los archivos.
            if (!playlistReady)
            {
                // Recupera primero los mensajes disponibles.
                // StopHlsAsync detendrá el proceso si sigue activo.
                await StopHlsAsync(sessionId);

                string error = await errorTask;

                _logger.LogError(
                    "FFmpeg no ha podido preparar la sesión {SessionId}: {Error}",
                    sessionId,
                    error
                );

                throw new InvalidOperationException(
                    "FFmpeg no ha podido preparar la reproducción HLS."
                );
            }

            // Supervisa el proceso FFmpeg.
            _ = Task.Run(async () =>
            {
                try
                {
                    await process.WaitForExitAsync();

                    string error = await errorTask;

                    // Una detención solicitada por el reproductor
                    // no debe registrarse como fallo de FFmpeg.
                    if (process.ExitCode != 0 &&
                        _activeSessions.ContainsKey(sessionId))
                    {
                        _logger.LogError(
                            "FFmpeg ha terminado con un error en la sesión {SessionId}: {Error}",
                            sessionId,
                            error
                        );
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Error al supervisar la sesión HLS {SessionId}.",
                        sessionId
                    );
                }
            });

            _logger.LogInformation(
                "Sesión HLS preparada: {SessionId}. Archivo: {Path}. Posición inicial: {StartSeconds}s.",
                sessionId,
                path,
                startSeconds
            );

            cancellationToken.ThrowIfCancellationRequested();
            return sessionId;
        }
        catch
        {
            // La limpieza no utiliza el token cancelado de la petición.
            // StopHlsAsync conserva los fallos para reintentarlos después.
            await StopHlsAsync(sessionId);
            throw;
        }
    }



    private async Task<bool> DeleteSessionDirectoryAsync(string sessionId)
    {
        if (!Guid.TryParseExact(sessionId, "N", out _))
        {
            throw new ArgumentException(
                "El identificador de la sesión HLS no es válido.",
                nameof(sessionId)
            );
        }

        string rootDirectory = Path.GetFullPath(
            Path.Combine(Path.GetTempPath(), "HuexMedia", "Hls")
        );

        string sessionDirectory = Path.GetFullPath(
            Path.Combine(rootDirectory, sessionId)
        );

        // El borrado debe quedar dentro del directorio temporal HLS.
        string allowedPrefix =
            rootDirectory.TrimEnd(Path.DirectorySeparatorChar)
            + Path.DirectorySeparatorChar;

        if (!sessionDirectory.StartsWith(
            allowedPrefix,
            StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "La carpeta está fuera del directorio temporal permitido."
            );
        }

        const int maxAttempts = 5;

        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                Directory.Delete(sessionDirectory, recursive: true);

                _logger.LogInformation(
                    "Archivos temporales eliminados: {SessionId}.",
                    sessionId
                );

                return true;
            }
            catch (DirectoryNotFoundException)
            {
                // Ya está eliminada: también es un resultado correcto.
                return true;
            }
            catch (Exception ex) when (
                ex is IOException ||
                ex is UnauthorizedAccessException)
            {
                if (attempt == maxAttempts)
                {
                    _logger.LogWarning(
                        ex,
                        "La carpeta de {SessionId} sigue pendiente de limpieza.",
                        sessionId
                    );

                    return false;
                }

                await Task.Delay(200 * attempt);
            }
        }

        return false;
    }

    public async Task StopHlsAsync(string sessionId)
    {
        if (!Guid.TryParseExact(sessionId, "N", out _))
        {
            throw new ArgumentException(
                "El identificador de la sesión HLS no es válido.",
                nameof(sessionId)
            );
        }

        _pendingCleanup.TryAdd(sessionId, 0);

        await _cleanupLock.WaitAsync();

        try
        {
            if (_activeSessions.TryGetValue(sessionId, out Process? process))
            {
                try
                {
                    if (!process.HasExited)
                    {
                        try
                        {
                            process.Kill(entireProcessTree: true);
                        }
                        catch (InvalidOperationException)
                            when (process.HasExited)
                        {
                            // Terminó entre la comprobación y Kill.
                        }
                    }

                    await process.WaitForExitAsync();

                    _activeSessions.TryRemove(sessionId, out _);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(
                        ex,
                        "No se ha podido detener la sesión {SessionId}. "
                        + "Se volverá a intentar.",
                        sessionId
                    );

                    // No borramos mientras FFmpeg pueda seguir escribiendo.
                    return;
                }
            }

            // También intenta borrar si la sesión ya no está en el registro.
            if (await DeleteSessionDirectoryAsync(sessionId))
            {
                _pendingCleanup.TryRemove(sessionId, out _);
            }
        }
        finally
        {
            _cleanupLock.Release();
        }
    }

    public async Task RetryPendingCleanupAsync(
        CancellationToken cancellationToken)
    {
        foreach (string sessionId in _pendingCleanup.Keys)
        {
            cancellationToken.ThrowIfCancellationRequested();

            await StopHlsAsync(sessionId);
        }
    }
}

