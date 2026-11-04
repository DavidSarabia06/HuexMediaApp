using HuexMediaApp.Server.Models.Libraries;
using HuexMediaApp.Server.Models.PlaybackProgress;
using HuexMediaApp.Server.Models.PlaybackProgress.Legacy;
using Microsoft.Extensions.Options;

namespace HuexMediaApp.Server.Services;

/// <summary>Gestiona el progreso de series y películas asociado a cada biblioteca guardada.</summary>
public sealed class PlaybackProgressService
{
    private static readonly string[] VideoExtensions = [".mkv", ".mp4", ".avi"];
    private readonly string _directory;
    private readonly LibraryService _libraryService;
    private readonly JsonFileStoreService _fileStore;
    private readonly IOptionsMonitor<PlaybackProgressOptions> _options;
    private readonly SemaphoreSlim _gate = new SemaphoreSlim(1, 1);

    #region Construcción

    public PlaybackProgressService(AppStoragePaths storagePaths, LibraryService libraryService,
        JsonFileStoreService fileStore, IOptionsMonitor<PlaybackProgressOptions> options)
    {
        _directory = Path.Combine(storagePaths.DataDirectory, "PlaybackProgress");
        _libraryService = libraryService;
        _fileStore = fileStore;
        _options = options;
    }

    #endregion

    #region Consulta y guardado de muestras

    /// <summary>Obtiene el progreso de la biblioteca y recupera sus datos guardados.</summary>
    public Task<LibraryPlaybackProgress> GetAsync(Guid libraryId, CancellationToken cancellationToken = default)
    {
        return ExecuteAsync(libraryId, null, cancellationToken);
    }

    /// <summary>Registra una posición y calcula si el vídeo ha alcanzado los márgenes de finalización.</summary>
    public Task<LibraryPlaybackProgress> SaveAsync(Guid libraryId, SavePlaybackProgressRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidateTimes(request.PositionSeconds, request.DurationSeconds);
        ValidateRecordedAt(request.RecordedAtUtc);
        PlaybackProgressOptions settings = _options.CurrentValue;

        return ExecuteAsync(libraryId, (library, data) =>
        {
            string video = NormalizePath(request.VideoPath);
            string? series = ValidateVideo(library, video, request.SeriesPath);

            // Entrar al vídeo sin avanzar conserva la posición que ya estaba guardada.
            if (request.PositionSeconds == 0)
            {
                return false;
            }

            bool watched = request.PositionSeconds / request.DurationSeconds * 100 >= settings.WatchedThresholdPercent ||
                request.DurationSeconds - request.PositionSeconds <= settings.RemainingSecondsToMarkWatched;

            if (series is not null)
            {
                return SaveSeriesSample(data, series, video, request, watched);
            }
            return SaveMovieSample(data, video, request, watched);
        }, cancellationToken);
    }

    #endregion

    #region Marcas manuales y reinicio

    /// <summary>Marca o desmarca un vídeo como visto y retira su posición pendiente.</summary>
    public Task<LibraryPlaybackProgress> SetWatchedAsync(Guid libraryId, SetPlaybackWatchedRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return ExecuteAsync(libraryId, (library, data) =>
        {
            string video = NormalizePath(request.VideoPath);
            string? series = ValidateVideo(library, video, request.SeriesPath);
            if (series is not null)
            {
                SeriesPlaybackProgress progress = GetOrCreateSeries(data, series);
                if (request.Watched)
                {
                    if (!progress.WatchedEpisodePaths.Any(path => Same(path, video)))
                    {
                        progress.WatchedEpisodePaths.Add(video);
                    }
                    progress.LastWatchedEpisodePath = video;
                }
                else
                {
                    progress.WatchedEpisodePaths.RemoveAll(path => Same(path, video));
                    if (Same(progress.LastWatchedEpisodePath, video))
                    {
                        progress.LastWatchedEpisodePath = progress.WatchedEpisodePaths.LastOrDefault();
                    }
                }

                EpisodePlaybackProgress? inProgress = progress.InProgress;
                if (inProgress is not null && Same(inProgress.EpisodePath, video))
                {
                    progress.InProgress = null;
                }
                progress.LastRecordedAtUtc = LatestDate(progress.LastRecordedAtUtc);
            }
            else
            {
                MoviePlaybackProgress progress = GetOrCreateMovie(data, video);
                progress.Watched = request.Watched;
                progress.PositionSeconds = 0;
                progress.LastRecordedAtUtc = LatestDate(progress.LastRecordedAtUtc);
            }
            return true;
        }, cancellationToken);
    }

    /// <summary>Vacía los vistos y el episodio en curso de una serie.</summary>
    public Task<LibraryPlaybackProgress> ResetAsync(Guid libraryId, ResetSeriesProgressRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        return ExecuteAsync(libraryId, (library, data) =>
        {
            if (library.MediaType != MediaType.Series)
            {
                throw new ArgumentException("El reinicio requiere una biblioteca de series.");
            }
            string series = NormalizePath(request.SeriesPath);
            ValidateSeriesPath(library.LibraryPath, series);
            if (!Directory.Exists(series))
            {
                throw new ArgumentException("La carpeta de la serie no existe.");
            }

            SeriesPlaybackProgress progress = GetOrCreateSeries(data, series);
            progress.HiddenFromContinueWatching = false;
            progress.WatchedEpisodePaths.Clear();
            progress.InProgress = null;
            progress.LastWatchedEpisodePath = null;
            progress.LastRecordedAtUtc = LatestDate(progress.LastRecordedAtUtc);
            return true;
        }, cancellationToken);
    }

    #endregion

    #region Coordinación del documento

    /// <summary>Protege la lectura, el cambio y el guardado con un mismo bloqueo.</summary>
    private async Task<LibraryPlaybackProgress> ExecuteAsync(Guid libraryId,
        Func<MediaLibrary, LibraryPlaybackProgress, bool>? update, CancellationToken cancellationToken)
    {
        MediaLibrary library = await _libraryService.GetAsync(libraryId, cancellationToken);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            LibraryPlaybackProgress data = await LoadAsync(library, cancellationToken);

            // Las consultas limpian referencias; los guardados aplican únicamente su cambio solicitado.
            bool changed = update is null
                ? CleanupMissingProgress(library, data, cancellationToken)
                : update(library, data);
            if (changed)
            {
                ValidateLibraryData(data, library);
                await _fileStore.WriteAsync(GetFilePath(library.Id), data, cancellationToken);
            }
            return data;
        }
        finally
        {
            _gate.Release();
        }
    }

    #endregion

    #region Limpieza del progreso al cargar

    /// <summary>Elimina referencias ausentes después de completar un escaneo accesible.</summary>
    private static bool CleanupMissingProgress(MediaLibrary library, LibraryPlaybackProgress data,
        CancellationToken cancellationToken)
    {
        LibraryContentSnapshot? snapshot = LibraryContentSnapshot.TryRead(library, cancellationToken);
        if (snapshot is null)
        {
            return false;
        }
        bool changed = data.Movies.RemoveAll(movie => !snapshot.ContainsVideo(movie.MoviePath)) > 0;
        if (data.Series.RemoveAll(series => !snapshot.ContainsItem(series.SeriesPath)) > 0)
        {
            changed = true;
        }
        foreach (SeriesPlaybackProgress series in data.Series)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (series.WatchedEpisodePaths.RemoveAll(path => !snapshot.ContainsVideo(path)) > 0)
            {
                changed = true;
            }
            if (series.LastWatchedEpisodePath is not null && !snapshot.ContainsVideo(series.LastWatchedEpisodePath))
            {
                series.LastWatchedEpisodePath = series.WatchedEpisodePaths.LastOrDefault();
                changed = true;
            }
            if (series.InProgress is not null && !snapshot.ContainsVideo(series.InProgress.EpisodePath))
            {
                series.InProgress = null;
                changed = true;
            }
        }
        return changed;
    }

    #endregion

    #region Visibilidad de continuar viendo

    /// <summary>Oculta la tarjeta de una serie conservando sus vistos y posición.</summary>
    public Task<LibraryPlaybackProgress> HideSeriesAsync(Guid libraryId, string seriesPath,
        CancellationToken cancellationToken = default)
    {
        return ExecuteAsync(libraryId, (library, data) =>
        {
            if (library.MediaType != MediaType.Series)
            {
                throw new ArgumentException("Esta operación requiere una biblioteca de series.");
            }
            string series = NormalizePath(seriesPath);
            ValidateSeriesPath(library.LibraryPath, series);
            SeriesPlaybackProgress? progress = data.Series.Find(item => Same(item.SeriesPath, series));
            if (progress is null)
            {
                throw new KeyNotFoundException("La serie no tiene progreso guardado.");
            }
            progress.HiddenFromContinueWatching = true;
            return true;
        }, cancellationToken);
    }

    /// <summary>Oculta una película de la sección sin modificar su posición ni su estado de visto.</summary>
    public Task<LibraryPlaybackProgress> HideMovieAsync(
        Guid libraryId,
        string videoPath,
        CancellationToken cancellationToken = default)
    {
        return ExecuteAsync(libraryId, (library, data) =>
        {
            if (library.MediaType != MediaType.Movies)
            {
                throw new ArgumentException(
                    "Esta operación requiere una biblioteca de películas.");
            }

            string video = NormalizePath(videoPath);
            ValidateVideo(library, video, null);

            MoviePlaybackProgress? progress = data.Movies.Find(
                item => Same(item.MoviePath, video));

            if (progress is null)
            {
                throw new KeyNotFoundException(
                    "La película no tiene progreso guardado.");
            }

            progress.HiddenFromContinueWatching = true;
            return true;
        }, cancellationToken);
    }

    #endregion

    #region Estado de series y películas

    /// <summary>Conserva todos los vistos y solo el último episodio pendiente de cada serie.</summary>
    private static bool SaveSeriesSample(LibraryPlaybackProgress data, string series, string video,
        SavePlaybackProgressRequest request, bool watched)
    {
        SeriesPlaybackProgress progress = GetOrCreateSeries(data, series);
        if (request.RecordedAtUtc <= progress.LastRecordedAtUtc)
        {
            return false;
        }
        progress.LastRecordedAtUtc = request.RecordedAtUtc;
        progress.HiddenFromContinueWatching = false;
        bool alreadyWatched = progress.WatchedEpisodePaths.Any(path => Same(path, video));
        if (watched)
        {
            if (!alreadyWatched)
            {
                progress.WatchedEpisodePaths.Add(video);
            }
            progress.LastWatchedEpisodePath = video;
        }
        progress.InProgress = watched || alreadyWatched ? null : new EpisodePlaybackProgress
        {
            EpisodePath = video,
            PositionSeconds = request.PositionSeconds,
            DurationSeconds = request.DurationSeconds
        };
        return true;
    }

    /// <summary>Guarda cada película sin sustituir el progreso de las demás.</summary>
    private static bool SaveMovieSample(LibraryPlaybackProgress data, string video,
        SavePlaybackProgressRequest request, bool watched)
    {
        MoviePlaybackProgress progress = GetOrCreateMovie(data, video);
        if (request.RecordedAtUtc <= progress.LastRecordedAtUtc)
        {
            return false;
        }
        progress.PositionSeconds = request.PositionSeconds;
        progress.DurationSeconds = request.DurationSeconds;
        progress.Watched = progress.Watched || watched;
        progress.HiddenFromContinueWatching = false;
        progress.LastRecordedAtUtc = request.RecordedAtUtc;

        return true;
    }

    /// <summary>Localiza la serie o crea su entrada en memoria.</summary>
    private static SeriesPlaybackProgress GetOrCreateSeries(LibraryPlaybackProgress data, string series)
    {
        SeriesPlaybackProgress? progress = data.Series.Find(item => Same(item.SeriesPath, series));
        if (progress is null)
        {
            progress = new SeriesPlaybackProgress { SeriesPath = series };
            data.Series.Add(progress);
        }
        return progress;
    }

    /// <summary>Localiza la película o crea su entrada en memoria.</summary>
    private static MoviePlaybackProgress GetOrCreateMovie(LibraryPlaybackProgress data, string video)
    {
        MoviePlaybackProgress? progress = data.Movies.Find(item => Same(item.MoviePath, video));
        if (progress is null)
        {
            progress = new MoviePlaybackProgress { MoviePath = video };
            data.Movies.Add(progress);
        }
        return progress;
    }

    /// <summary>Protege los cambios manuales frente a muestras anteriores que lleguen tarde.</summary>
    private static DateTimeOffset LatestDate(DateTimeOffset previous)
    {
        DateTimeOffset now = DateTimeOffset.UtcNow;
        return now > previous ? now : previous;
    }

    #endregion

    #region Lectura del progreso

    /// <summary>Forma el nombre estable del documento de la biblioteca.</summary>
    private string GetFilePath(Guid libraryId)
    {
        return Path.Combine(_directory, $"Progress-{libraryId:N}.json");
    }

    /// <summary>Lee el formato común o prepara un documento vacío cuando aún no existe.</summary>
    private async Task<LibraryPlaybackProgress> LoadAsync(MediaLibrary library, CancellationToken cancellationToken)
    {
        LibraryPlaybackProgress? data = await _fileStore.ReadAsync<LibraryPlaybackProgress>(
            GetFilePath(library.Id), cancellationToken);
        if (data is null)
        {
            return new LibraryPlaybackProgress { LibraryId = library.Id };
        }
        ValidateLibraryData(data, library);
        return data;
    }

    #endregion

    #region Migración manual del progreso antiguo

    /// <summary>Busca documentos de versión 1 sin modificar sus archivos.</summary>
    public async Task<List<LegacyPlaybackProgressSummary>> GetLegacyProgressAsync(
        CancellationToken cancellationToken = default)
    {
        List<LegacyPlaybackProgressSummary> summaries = new List<LegacyPlaybackProgressSummary>();
        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (!Directory.Exists(_directory))
            {
                return summaries;
            }
            string[] files = Directory.GetFiles(_directory, "*.json", SearchOption.TopDirectoryOnly);
            foreach (string filePath in files.OrderBy(path => path, StringComparer.OrdinalIgnoreCase))
            {
                cancellationToken.ThrowIfCancellationRequested();
                LegacyPlaybackProgressDocument? document = await _fileStore.ReadAsync<LegacyPlaybackProgressDocument>(
                    filePath, cancellationToken);
                if (document is null || document.Version != 1)
                {
                    continue;
                }
                ValidateLegacyDocument(document);
                summaries.Add(new LegacyPlaybackProgressSummary
                {
                    FileName = Path.GetFileName(filePath),
                    LibraryPath = document.LibraryPath,
                    SeriesCount = document.Series.Count,
                    WatchedEpisodeCount = document.Series.Sum(series => series.WatchedEpisodePaths.Count),
                    InProgressCount = document.Series.Count(series => series.InProgress is not null)
                });
            }
            return summaries;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Importa el archivo elegido conservando el original y cualquier progreso existente.</summary>
    public async Task<LibraryPlaybackProgress> MigrateLegacyProgressAsync(
        string fileName, Guid libraryId, CancellationToken cancellationToken = default)
    {
        // Solo se admiten archivos JSON de la carpeta de progreso, nunca rutas recibidas del cliente.
        if (string.IsNullOrWhiteSpace(fileName) || fileName != Path.GetFileName(fileName) ||
            fileName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 ||
            !string.Equals(Path.GetExtension(fileName), ".json", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("El nombre del archivo de progreso no es válido.");
        }
        MediaLibrary library = await _libraryService.GetAsync(libraryId, cancellationToken);
        if (library.MediaType != MediaType.Series)
        {
            throw new ArgumentException("El progreso antiguo requiere una biblioteca de series.");
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            string destination = GetFilePath(library.Id);
            if (File.Exists(destination))
            {
                throw new ArgumentException("Esta biblioteca ya tiene un archivo de progreso. No se ha sobrescrito.");
            }
            LegacyPlaybackProgressDocument? document = await _fileStore.ReadAsync<LegacyPlaybackProgressDocument>(
                Path.Combine(_directory, fileName), cancellationToken);
            if (document is null)
            {
                throw new KeyNotFoundException("El archivo de progreso antiguo ya no existe.");
            }
            ValidateLegacyDocument(document);

            // Conserva la estructura relativa cuando la biblioteca está en otra unidad o carpeta.
            foreach (SeriesPlaybackProgress series in document.Series)
            {
                series.SeriesPath = RebasePath(series.SeriesPath, document.LibraryPath, library.LibraryPath);
                series.WatchedEpisodePaths = series.WatchedEpisodePaths
                    .Select(path => RebasePath(path, document.LibraryPath, library.LibraryPath)).ToList();
                if (series.LastWatchedEpisodePath is not null)
                {
                    series.LastWatchedEpisodePath = RebasePath(
                        series.LastWatchedEpisodePath, document.LibraryPath, library.LibraryPath);
                }
                if (series.InProgress is not null)
                {
                    series.InProgress.EpisodePath = RebasePath(
                        series.InProgress.EpisodePath, document.LibraryPath, library.LibraryPath);
                }
            }
            LibraryPlaybackProgress data = new LibraryPlaybackProgress
            {
                LibraryId = library.Id,
                Series = document.Series
            };
            ValidateLibraryData(data, library);
            cancellationToken.ThrowIfCancellationRequested();
            await _fileStore.WriteAsync(destination, data, cancellationToken);
            return data;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Comprueba el formato antiguo y sus rutas antes de adaptar la raíz.</summary>
    private static void ValidateLegacyDocument(LegacyPlaybackProgressDocument document)
    {
        try
        {
            if (document.Version != 1 || document.Series is null)
            {
                throw new ArgumentException("El archivo no contiene progreso de versión 1.");
            }
            document.LibraryPath = NormalizePath(document.LibraryPath);
            MediaLibrary originalLibrary = new MediaLibrary
            {
                Id = Guid.NewGuid(),
                MediaType = MediaType.Series,
                LibraryPath = document.LibraryPath
            };
            ValidateLibraryData(new LibraryPlaybackProgress
            {
                LibraryId = originalLibrary.Id,
                Series = document.Series
            }, originalLibrary);
        }
        catch (ArgumentException exception)
        {
            throw new InvalidDataException("El archivo de progreso antiguo no es válido. Se ha conservado sin modificar.", exception);
        }
    }

    /// <summary>Sustituye la raíz manteniendo el nombre de la serie, temporadas y episodios.</summary>
    private static string RebasePath(string path, string oldRoot, string newRoot)
    {
        return NormalizePath(Path.Combine(newRoot, Path.GetRelativePath(oldRoot, path)));
    }

    #endregion

    #region Validación de peticiones y rutas

    /// <summary>Obtiene una ruta absoluta sin separador final redundante.</summary>
    private static string NormalizePath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path))
        {
            throw new ArgumentException("La ruta no es válida.");
        }
        return Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
    }

    /// <summary>Compara rutas normalizadas sin distinguir mayúsculas.</summary>
    private static bool Same(string? left, string? right)
    {
        return string.Equals(left, right, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Comprueba la pertenencia a una carpeta, también si es la raíz de una unidad.</summary>
    private static bool IsDescendant(string parent, string child)
    {
        string prefix = Path.EndsInDirectorySeparator(parent) ? parent : parent + Path.DirectorySeparatorChar;
        return child.StartsWith(prefix, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Comprueba que la serie sea hija directa de la biblioteca.</summary>
    private static void ValidateSeriesPath(string libraryPath, string series)
    {
        if (!Same(Path.GetDirectoryName(series), NormalizePath(libraryPath)))
        {
            throw new ArgumentException("La serie no pertenece a esta biblioteca.");
        }
    }

    /// <summary>Valida el archivo y devuelve la carpeta de serie, o null para una película.</summary>
    private static string? ValidateVideo(MediaLibrary library, string video, string? seriesPath)
    {
        if (!IsDescendant(NormalizePath(library.LibraryPath), video) || !File.Exists(video) ||
            !VideoExtensions.Contains(Path.GetExtension(video), StringComparer.OrdinalIgnoreCase))
        {
            throw new ArgumentException("El vídeo no pertenece a esta biblioteca, no existe o tiene un formato no admitido.");
        }
        if (library.MediaType == MediaType.Series)
        {
            string series = NormalizePath(seriesPath);
            ValidateSeriesPath(library.LibraryPath, series);
            if (!IsDescendant(series, video))
            {
                throw new ArgumentException("El episodio no pertenece a la serie indicada.");
            }
            return series;
        }
        if (library.MediaType != MediaType.Movies || !string.IsNullOrWhiteSpace(seriesPath))
        {
            throw new ArgumentException("Los datos no corresponden al tipo de biblioteca.");
        }
        return null;
    }

    /// <summary>Comprueba duración positiva, tiempos finitos y posición dentro de la duración.</summary>
    private static void ValidateTimes(double position, double duration)
    {
        if (!double.IsFinite(position) || !double.IsFinite(duration) || duration <= 0 || position < 0 || position > duration)
        {
            throw new ArgumentException("La posición y la duración del vídeo no son válidas.");
        }
    }

    /// <summary>Rechaza fechas vacías o adelantadas más de un minuto al reloj del servidor.</summary>
    private static void ValidateRecordedAt(DateTimeOffset recordedAt)
    {
        if (recordedAt == default || recordedAt > DateTimeOffset.UtcNow.AddMinutes(1))
        {
            throw new ArgumentException("La fecha de reproducción no es válida.");
        }
    }

    #endregion

    #region Validación del documento guardado

    /// <summary>Comprueba identidad, rutas únicas y coherencia sin exigir que el disco esté conectado.</summary>
    private static void ValidateLibraryData(LibraryPlaybackProgress data, MediaLibrary library)
    {
        try
        {
            if (data.Version != 2 || data.LibraryId != library.Id || data.Series is null || data.Movies is null ||
                (library.MediaType == MediaType.Series && data.Movies.Count != 0) ||
                (library.MediaType == MediaType.Movies && data.Series.Count != 0))
            {
                throw new ArgumentException("La cabecera no corresponde a la biblioteca.");
            }
            HashSet<string> paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (SeriesPlaybackProgress series in data.Series)
            {
                if (series is null || series.WatchedEpisodePaths is null || series.LastRecordedAtUtc == default)
                {
                    throw new ArgumentException("Una entrada de serie está incompleta.");
                }
                series.SeriesPath = NormalizePath(series.SeriesPath);
                ValidateSeriesPath(library.LibraryPath, series.SeriesPath);
                if (!paths.Add(series.SeriesPath))
                {
                    throw new ArgumentException("Hay series repetidas.");
                }
                HashSet<string> watched = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                for (int index = 0; index < series.WatchedEpisodePaths.Count; index++)
                {
                    string episode = NormalizePath(series.WatchedEpisodePaths[index]);
                    if (!IsDescendant(series.SeriesPath, episode) || !watched.Add(episode))
                    {
                        throw new ArgumentException("Un episodio visto está repetido o no pertenece a su serie.");
                    }
                    series.WatchedEpisodePaths[index] = episode;
                }
                if (series.LastWatchedEpisodePath is not null)
                {
                    series.LastWatchedEpisodePath = NormalizePath(series.LastWatchedEpisodePath);
                    if (!watched.Contains(series.LastWatchedEpisodePath))
                    {
                        throw new ArgumentException("El último episodio visto no figura entre los vistos.");
                    }
                }
                EpisodePlaybackProgress? inProgress = series.InProgress;
                if (inProgress is not null)
                {
                    inProgress.EpisodePath = NormalizePath(inProgress.EpisodePath);
                    ValidateTimes(inProgress.PositionSeconds, inProgress.DurationSeconds);
                    if (!IsDescendant(series.SeriesPath, inProgress.EpisodePath) || watched.Contains(inProgress.EpisodePath))
                    {
                        throw new ArgumentException("El episodio en curso no pertenece a su serie o ya está visto.");
                    }
                }
            }
            paths.Clear();
            foreach (MoviePlaybackProgress movie in data.Movies)
            {
                if (movie is null || movie.LastRecordedAtUtc == default)
                {
                    throw new ArgumentException("Una entrada de película está incompleta.");
                }
                movie.MoviePath = NormalizePath(movie.MoviePath);
                if (!IsDescendant(NormalizePath(library.LibraryPath), movie.MoviePath) || !paths.Add(movie.MoviePath))
                {
                    throw new ArgumentException("Una película está repetida o no pertenece a su biblioteca.");
                }
                // Una marca manual puede existir antes de conocer la duración del vídeo.
                if (movie.DurationSeconds != 0 || movie.PositionSeconds != 0)
                {
                    ValidateTimes(movie.PositionSeconds, movie.DurationSeconds);
                }
            }
        }
        catch (ArgumentException exception)
        {
            throw new InvalidDataException("El archivo de progreso contiene datos inválidos. Se ha conservado sin modificar.", exception);
        }
    }

    #endregion
}
