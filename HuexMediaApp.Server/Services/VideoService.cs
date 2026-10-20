
using HuexMediaApp.Server.Models;
using System.Diagnostics;
using System.Globalization;
using System.Text.Json.Nodes;
using System.Collections.Concurrent;

namespace HuexMediaApp.Server.Services;

/// <summary>Analiza vídeos, extrae subtítulos y administra los procesos y temporales de reproducción HLS.</summary>
public class VideoService
{
    // Margen de transporte para evitar DTS negativos al inicio (AAC y fotogramas B).
    // Se comunica al cliente y se resta al convertir al tiempo del episodio.
    private const double TransportTimestampOffsetSeconds = 10;

    private readonly string _ffprobePath;
    private readonly string _ffmpegPath;
    private readonly ILogger<VideoService> _logger;

    // Almacena los procesos FFmpeg activos, identificados por sesión.
    private readonly ConcurrentDictionary<string, Process> _activeSessions = new();

    // La marca acompaña al proceso hasta que termina su supervisión.
    // Las claves débiles evitan conservar procesos que ya no se utilizan.
    private readonly System.Runtime.CompilerServices.ConditionalWeakTable<Process, object> _requestedStops = new();

    // Carpetas pendientes de borrar.
    private readonly ConcurrentDictionary<string, byte> _pendingCleanup = new();

    // Evita ejecutar dos limpiezas simultáneas.
    private readonly SemaphoreSlim _cleanupLock = new(1, 1);
    
    #region Construcción

    /// <summary>Localiza FFprobe y FFmpeg dentro del directorio de contenido del servidor.</summary>
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

    #endregion

    #region Análisis y subtítulos

    /// <summary>
    /// Ejecuta FFprobe, interpreta su respuesta JSON y devuelve la información técnica del archivo.
    /// </summary>
    /// <param name="path">Ruta del archivo de vídeo que se va a analizar.</param>
    /// <param name="cancellationToken">Permite cancelar el análisis e intentar detener FFprobe.</param>
    /// <returns>Duración, resolución, códecs y pistas de audio y subtítulos.</returns>
    public async Task<VideoInfo> GetVideoInfoAsync(string path, CancellationToken cancellationToken = default)
    {
        // 1. Exige una ruta con contenido y un archivo existente antes de ejecutar FFprobe.
        ValidateVideoPath(path);

        // 2. Prepara el programa externo: recoge su respuesta y sus errores
        // desde C#, lo ejecuta directamente y evita abrir una ventana de consola.
        ProcessStartInfo startInfo = new()
        {
            FileName = _ffprobePath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        // Solicita solo mensajes de error y los campos técnicos que utilizamos.
        // Cada argumento se entrega por separado, incluida la ruta completa del archivo.
        startInfo.ArgumentList.Add("-v");
        startInfo.ArgumentList.Add("error");
        startInfo.ArgumentList.Add("-show_entries");
        startInfo.ArgumentList.Add(
            "format=duration:stream=index,codec_type,codec_name,width,height:stream_tags=language,title:stream_disposition=default,forced"
        );
        // FFprobe devolverá los datos estructurados en formato JSON.
        startInfo.ArgumentList.Add("-of");
        startInfo.ArgumentList.Add("json");
        startInfo.ArgumentList.Add(path);

        // using libera los recursos del objeto Process al salir de la función.
        using Process process = new()
        {
            StartInfo = startInfo
        };

        // 3. Arranca FFprobe y registra qué hacer si se cancela la operación.
        process.Start();
        // Register ejecutará este bloque cuando se cancele el token.
        // Su using retira el registro cuando termina la función.
        using CancellationTokenRegistration cancellationRegistration = cancellationToken.Register(() =>
        {
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch (InvalidOperationException)
            {
                // El proceso ya terminó o todavía no dispone de un proceso asociado.
            }
            catch (System.ComponentModel.Win32Exception)
            {
                // La cancelación continúa aunque el sistema operativo rechace Kill.
            }
        });

        // 4. Empieza a leer ambos canales mientras FFprobe trabaja.
        // Así se vacían sus búferes de respuesta y errores durante la ejecución.
        Task<string> outputTask = process.StandardOutput.ReadToEndAsync();
        Task<string> errorTask = process.StandardError.ReadToEndAsync();

        // await espera la salida sin mantener un hilo bloqueado durante la espera.
        await process.WaitForExitAsync();
        // Si se canceló, propaga esa cancelación antes de interpretar el resultado.
        cancellationToken.ThrowIfCancellationRequested();

        string output = await outputTask;
        string error = await errorTask;

        // Un código distinto de cero indica un fallo: registra el detalle y lanza la excepción.
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

        // 5. Interpreta el texto JSON para consultar sus propiedades desde C#.
        // ! expresa que esperamos un resultado no nulo; AsObject exige un objeto JSON.
        JsonObject root = JsonNode.Parse(output)!.AsObject();

        // Este objeto acumula los datos que devolveremos al llamador.
        VideoInfo videoInfo = new();

        // FFprobe entrega la duración como texto, por ejemplo "2700.50".
        string? duration = root["format"]?["duration"]?.GetValue<string>();

        // Convierte ese texto a segundos. InvariantCulture interpreta el punto decimal
        // igual en cualquier idioma de Windows. Si falla, Duration conserva su valor inicial.
        if (double.TryParse(
            duration,
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out double seconds))
        {
            videoInfo.Duration = seconds;
        }

        // 6. Cada stream es una pista: vídeo, audio o subtítulos.
        // Recorre la lista para obtener las pistas y los datos del primer vídeo y audio.
        if (root["streams"] is JsonArray streams)
        {
            foreach (JsonNode? stream in streams)
            {
                if (stream is null)
                {
                    continue;
                }

                // codecType indica el tipo de pista; codecName identifica su códec.
                string codecType = stream["codec_type"]?.GetValue<string>() ?? "";
                string codecName = stream["codec_name"]?.GetValue<string>() ?? "";

                if (codecType is "audio" or "subtitle")
                {
                    // El índice es absoluto dentro del archivo y permite seleccionar
                    // la pista después con FFmpeg. ?? aporta valores para etiquetas ausentes.
                    // Las marcas default y forced se consideran activas cuando valen 1.
                    // El audio se ofrece como seleccionable; los subtítulos se comprueban por códec.
                    MediaTrack track = new MediaTrack
                    {
                        Index = stream["index"]!.GetValue<int>(),
                        Codec = codecName,
                        Language = stream["tags"]?["language"]?.GetValue<string>() ?? "und",
                        Title = stream["tags"]?["title"]?.GetValue<string>() ?? "",
                        IsDefault = stream["disposition"]?["default"]?.GetValue<int>() == 1,
                        IsForced = stream["disposition"]?["forced"]?.GetValue<int>() == 1,
                        IsSupported = codecType == "audio" || IsTextSubtitle(codecName)
                    };
                    if (codecType == "audio")
                    {
                        videoInfo.AudioTracks.Add(track);
                    }
                    else
                    {
                        videoInfo.SubtitleTracks.Add(track);
                    }
                }

                // Solo rellena el códec y la resolución generales con el primer vídeo.
                if (codecType == "video" && videoInfo.VideoCodec == "")
                {
                    videoInfo.VideoCodec = codecName;
                    videoInfo.Width = stream["width"]?.GetValue<int>() ?? 0;
                    videoInfo.Height = stream["height"]?.GetValue<int>() ?? 0;
                }
                // Conserva como códec general de audio el de la primera pista encontrada.
                else if (codecType == "audio" && videoInfo.AudioCodec == "")
                {
                    videoInfo.AudioCodec = codecName;
                }
            }
        }

        // 7. Marca si la combinación detectada difiere de H.264 y AAC.
        // || hace que baste con que uno de los dos códecs sea distinto.
        videoInfo.RequiresTranscoding =
            videoInfo.VideoCodec != "h264" ||
            videoInfo.AudioCodec != "aac";

        // Registra los códecs detectados para poder seguir el análisis en los mensajes del servidor.
        _logger.LogInformation(
            "Vídeo analizado: {Path}. Vídeo: {VideoCodec}, audio: {AudioCodec}.",
            path,
            videoInfo.VideoCodec,
            videoInfo.AudioCodec
        );

        // Devuelve la información que utilizarán el controlador y las operaciones de reproducción.
        return videoInfo;
    }

    /// <summary>Extrae una pista de subtítulos de texto como WebVTT en memoria; la cancelación detiene FFmpeg.</summary>
    public async Task<string> GetSubtitlesAsync(string path, int trackIndex, CancellationToken cancellationToken)
    {
        VideoInfo info = await GetVideoInfoAsync(path, cancellationToken);
        MediaTrack track = info.SubtitleTracks.FirstOrDefault(t => t.Index == trackIndex)
            ?? throw new ArgumentException("La pista de subtítulos no existe.");
        if (!track.IsSupported)
        {
            throw new ArgumentException("Los subtítulos de imagen todavía no son compatibles.");
        }

        using Process process = new Process
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
        foreach (string argument in new[] { "-v", "error", "-i", path, "-map", $"0:{trackIndex}",
                     "-c:s", "webvtt", "-f", "webvtt", "pipe:1" })
        {
            process.StartInfo.ArgumentList.Add(argument);
        }

        cancellationToken.ThrowIfCancellationRequested();
        process.Start();
        using CancellationTokenRegistration registration = cancellationToken.Register(() =>
        {
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch (InvalidOperationException)
            {
                // El proceso ya terminó o todavía no dispone de un proceso asociado.
            }
            catch (System.ComponentModel.Win32Exception)
            {
                // La cancelación continúa aunque el sistema operativo rechace Kill.
            }
        });
        Task<string> outputTask = process.StandardOutput.ReadToEndAsync();
        Task<string> errorTask = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        cancellationToken.ThrowIfCancellationRequested();
        string output = await outputTask;
        string error = await errorTask;
        if (process.ExitCode != 0)
        {
            _logger.LogWarning("Error al extraer subtítulos: {Error}", error);
            throw new InvalidOperationException("No se han podido extraer los subtítulos.");
        }
        // Se devuelve en memoria: no se crean nuevas carpetas temporales.
        return output;
    }

    #endregion

    #region Sesiones y archivos HLS

    /// <summary>Analiza el archivo, inicia una sesión HLS y devuelve las referencias temporales del episodio.</summary>
    public async Task<PlaybackSession> StartHlsAsync(
        string path,
        double startSeconds = 0,
        CancellationToken cancellationToken = default,
        int? audioTrackIndex = null)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ValidateVideoPath(path);
        if (!double.IsFinite(startSeconds) || startSeconds < 0)
        {
            throw new ArgumentException("La posición inicial del vídeo no es válida.", nameof(startSeconds));
        }

        // Analiza los códecs y la duración del vídeo.
        VideoInfo videoInfo = await GetVideoInfoAsync(path, cancellationToken);
        cancellationToken.ThrowIfCancellationRequested();
        if (audioTrackIndex.HasValue && !videoInfo.AudioTracks.Any(t => t.Index == audioTrackIndex.Value))
        {
            throw new ArgumentException("La pista de audio no existe.");
        }

        // Tras el análisis, comprueba el límite superior de la posición solicitada.
        if (videoInfo.Duration > 0 && startSeconds >= videoInfo.Duration)
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

            ProcessStartInfo startInfo = CreateHlsStartInfo(
                path, startSeconds, audioTrackIndex, videoInfo, outputDirectory, playlistPath);

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

            string? firstSegmentPath = await WaitForPlaylistAsync(
                process, playlistPath, outputDirectory, cancellationToken);

            // Si no pudo preparar la reproducción,
            // detiene el proceso y limpia los archivos.
            if (firstSegmentPath is null)
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

            // La supervisión acompaña al proceso después de responder al reproductor.
            _ = Task.Run(() => MonitorSessionAsync(sessionId, process, errorTask));

            _logger.LogInformation(
                "Sesión HLS preparada: {SessionId}. Archivo: {Path}. Posición inicial: {StartSeconds}s.",
                sessionId,
                path,
                startSeconds
            );

            cancellationToken.ThrowIfCancellationRequested();
            double transportStart = await GetHlsStartTimeAsync(firstSegmentPath, cancellationToken);
            return new PlaybackSession
            {
                SessionId = sessionId,
                StartSeconds = startSeconds,
                TimelineStartSeconds = Math.Max(0, transportStart - TransportTimestampOffsetSeconds),
                TransportTimestampOffsetSeconds = TransportTimestampOffsetSeconds
            };
        }
        catch
        {
            // La limpieza no utiliza el token cancelado de la petición.
            // StopHlsAsync conserva los fallos para reintentarlos después.
            await StopHlsAsync(sessionId);
            throw;
        }
    }

    /// <summary>Resuelve un manifiesto o segmento existente junto con su tipo de contenido.</summary>
    public HlsMediaFile GetHlsFile(string sessionId, string fileName)
    {
        string filePath = GetHlsFilePath(sessionId, fileName);
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException("El archivo HLS todavía no está disponible.", filePath);
        }

        return new HlsMediaFile
        {
            FullPath = filePath,
            ContentType = fileName == "index.m3u8" ? "application/vnd.apple.mpegurl" : "video/mp2t"
        };
    }

    /// <summary>Valida la sesión y el nombre y construye una ruta dentro de su carpeta temporal.</summary>
    public string GetHlsFilePath(string sessionId, string fileName)
    {
        // Valida el identificador de la sesión.
        ValidateSessionId(sessionId);

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

    #endregion

    #region Preparación y supervisión de FFmpeg

    /// <summary>Construye los argumentos de FFmpeg para vídeo, audio, marcas temporales y ventana HLS.</summary>
    private ProcessStartInfo CreateHlsStartInfo(
        string path, double startSeconds, int? audioTrackIndex, VideoInfo videoInfo,
        string outputDirectory, string playlistPath)
    {
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

        // Lee el archivo aproximadamente a 1,5 veces
        // la velocidad normal de reproducción.
        startInfo.ArgumentList.Add("-readrate");
        startInfo.ArgumentList.Add("1.5");

        // Conserva la línea temporal original incluso al buscar en un fotograma clave.
        startInfo.ArgumentList.Add("-copyts");
        startInfo.ArgumentList.Add("-start_at_zero");

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

        // Convierte el audio seleccionado a AAC.
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

        // Conserva las marcas del episodio y añade el margen de transporte.
        startInfo.ArgumentList.Add("-avoid_negative_ts");
        startInfo.ArgumentList.Add("disabled");
        startInfo.ArgumentList.Add("-output_ts_offset");
        startInfo.ArgumentList.Add(TransportTimestampOffsetSeconds.ToString(CultureInfo.InvariantCulture));

        // Formato HLS.
        startInfo.ArgumentList.Add("-f");
        startInfo.ArgumentList.Add("hls");
        startInfo.ArgumentList.Add("-hls_segment_options");
        startInfo.ArgumentList.Add("mpegts_copyts=1");

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

        return startInfo;
    }

    /// <summary>Espera hasta 30 segundos a un manifiesto que contenga un segmento con datos.</summary>
    private static async Task<string?> WaitForPlaylistAsync(
        Process process, string playlistPath, string outputDirectory, CancellationToken cancellationToken)
    {
        // Espera hasta 30 segundos a que aparezca
        // un manifiesto con al menos un segmento disponible.

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
                        return segmentPath;
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

        return null;
    }

    /// <summary>Lee la terminación de FFmpeg y distingue las detenciones solicitadas de los fallos.</summary>
    private async Task MonitorSessionAsync(string sessionId, Process process, Task<string> errorTask)
    {
        try
        {
            await process.WaitForExitAsync();

            string error = await errorTask;

            // Una detención solicitada por el reproductor
            // no debe registrarse como fallo de FFmpeg.
            if (process.ExitCode != 0 &&
                !_requestedStops.TryGetValue(process, out _))
            {
                _logger.LogError(
                    "FFmpeg ha terminado con un error en la sesión {SessionId}. Código de salida: {ExitCode}. Detalle: {Error}",
                    sessionId,
                    process.ExitCode,
                    error
                );
            }
            else if (_requestedStops.TryGetValue(process, out _))
            {
                _logger.LogInformation(
                    "FFmpeg detenido por solicitud del reproductor en la sesión {SessionId}.",
                    sessionId
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
    }

    /// <summary>Obtiene la marca temporal inicial del primer segmento para sincronizar el episodio.</summary>
    private async Task<double> GetHlsStartTimeAsync(string segmentPath, CancellationToken cancellationToken)
    {
        using Process process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = _ffprobePath,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };
        foreach (string argument in new[] { "-v", "error", "-show_entries", "format=start_time",
                     "-of", "default=noprint_wrappers=1:nokey=1", segmentPath })
        {
            process.StartInfo.ArgumentList.Add(argument);
        }

        cancellationToken.ThrowIfCancellationRequested();
        process.Start();
        using CancellationTokenRegistration registration = cancellationToken.Register(() =>
        {
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch (InvalidOperationException)
            {
                // El proceso ya terminó o todavía no dispone de un proceso asociado.
            }
            catch (System.ComponentModel.Win32Exception)
            {
                // La cancelación continúa aunque el sistema operativo rechace Kill.
            }
        });
        Task<string> outputTask = process.StandardOutput.ReadToEndAsync();
        Task<string> errorTask = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        string output = await outputTask;
        string error = await errorTask;
        cancellationToken.ThrowIfCancellationRequested();
        if (process.ExitCode != 0 || !double.TryParse(output.Trim(), NumberStyles.Float,
                CultureInfo.InvariantCulture, out double seconds) || !double.IsFinite(seconds))
        {
            _logger.LogWarning("No se ha podido obtener el tiempo del segmento HLS: {Error}", error);
            throw new InvalidOperationException("No se ha podido sincronizar la sesión de vídeo.");
        }
        return seconds;
    }

    #endregion

    #region Detención y limpieza

    /// <summary>Detiene el proceso y elimina sus temporales; conserva los fallos en la cola de reintentos.</summary>
    public async Task StopHlsAsync(string sessionId)
    {
        ValidateSessionId(sessionId);

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
                            // Debe marcarse ANTES de Kill: la supervisión puede
                            // despertarse antes de que retiremos la sesión.
                            _requestedStops.GetValue(process, static _ => new object());
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

    /// <summary>Reintenta las sesiones pendientes respetando la cancelación entre sesiones.</summary>
    public async Task RetryPendingCleanupAsync(
        CancellationToken cancellationToken)
    {
        foreach (string sessionId in _pendingCleanup.Keys)
        {
            cancellationToken.ThrowIfCancellationRequested();

            await StopHlsAsync(sessionId);
        }
    }

    /// <summary>Comprueba la ubicación temporal y reintenta hasta cinco veces el borrado de la carpeta.</summary>
    private async Task<bool> DeleteSessionDirectoryAsync(string sessionId)
    {
        ValidateSessionId(sessionId);

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

    #endregion

    #region Validación

    /// <summary>Identifica los formatos de subtítulos que FFmpeg puede convertir a WebVTT.</summary>
    private static bool IsTextSubtitle(string codec)
    {
        return codec is "subrip" or "ass" or "ssa" or "webvtt" or "mov_text" or "text";
    }

    /// <summary>Exige una ruta con contenido y un archivo de vídeo existente.</summary>
    private static void ValidateVideoPath(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            throw new ArgumentException("La ruta del vídeo no es válida.", nameof(path));
        }
        if (!File.Exists(path))
        {
            throw new FileNotFoundException("No se ha encontrado el archivo de vídeo.", path);
        }
    }

    /// <summary>Exige un identificador GUID de 32 caracteres sin separadores.</summary>
    private static void ValidateSessionId(string sessionId)
    {
        if (!Guid.TryParseExact(sessionId, "N", out _))
        {
            throw new ArgumentException("El identificador de la sesión HLS no es válido.", nameof(sessionId));
        }
    }

    #endregion
}
