using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HuexMediaApp.Server.Models;
using Microsoft.Extensions.Options;

namespace HuexMediaApp.Server.Services;

/// <summary>Consulta y guarda los episodios vistos y el único episodio en curso de cada serie.</summary>
public sealed class PlaybackProgressService
{
    private readonly string _directory;
    private readonly IOptionsMonitor<PlaybackProgressOptions> _options;
    // Serializa las lecturas y cambios de esta instancia compartida del servicio.
    private readonly SemaphoreSlim _gate = new(1, 1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    #region Construcción y operaciones públicas

    /// <summary>Localiza el almacenamiento y recibe los márgenes de finalización configurados.</summary>
    public PlaybackProgressService(AppStoragePaths storagePaths, IOptionsMonitor<PlaybackProgressOptions> options)
    {
        _directory = Path.Combine(storagePaths.DataDirectory, "PlaybackProgress");
        _options = options;
    }

    /// <summary>Lee el progreso completo de una biblioteca; una biblioteca nueva devuelve datos vacíos en memoria.</summary>
    public async Task<PlaybackProgressLibrary> GetAsync(string libraryPath, CancellationToken cancellationToken = default)
    {
        string library = NormalizeLibrary(libraryPath);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            return await LoadAsync(library, cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Aplica la última muestra de reproducción y clasifica el episodio como visto o en curso.</summary>
    public async Task<SeriesPlaybackProgress> SaveAsync(SavePlaybackProgressRequest request, CancellationToken cancellationToken = default)
    {
        string library = NormalizeLibrary(request.LibraryPath);
        string series = NormalizePath(request.SeriesPath);
        string episode = NormalizePath(request.EpisodePath);
        ValidateEpisode(library, series, episode);
        ValidateTimes(request.PositionSeconds, request.DurationSeconds);
        ValidateRecordedAt(request.RecordedAtUtc);

        // Captura los ajustes vigentes para utilizar los mismos durante esta operación.
        PlaybackProgressOptions settings = _options.CurrentValue;
        await _gate.WaitAsync(cancellationToken);
        try
        {
            PlaybackProgressLibrary data = await LoadAsync(library, cancellationToken);
            SeriesPlaybackProgress progress = GetOrCreateSeries(data, series);

            // Una muestra atrasada no puede recuperar un estado anterior de la serie.
            if (request.RecordedAtUtc <= progress.LastRecordedAtUtc)
            {
                return progress;
            }
            // Abrir un episodio sin reproducirlo conserva el progreso anterior.
            if (request.PositionSeconds == 0)
            {
                return progress;
            }

            progress.LastRecordedAtUtc = request.RecordedAtUtc;
            bool watched = request.PositionSeconds / request.DurationSeconds * 100 >= settings.WatchedThresholdPercent ||
                request.DurationSeconds - request.PositionSeconds <= settings.RemainingSecondsToMarkWatched;
            if (watched && !progress.WatchedEpisodePaths.Any(path => Same(path, episode)))
            {
                progress.WatchedEpisodePaths.Add(episode);
            }
            if (watched)
            {
                progress.LastWatchedEpisodePath = episode;
            }

            // La última reproducción sustituye al episodio en curso anterior y conserva los vistos.
            // Si este episodio ya consta como visto, su reproducción también deja InProgress vacío.
            progress.InProgress = watched || progress.WatchedEpisodePaths.Any(path => Same(path, episode))
                ? null
                : new EpisodePlaybackProgress
                {
                    EpisodePath = episode,
                    PositionSeconds = request.PositionSeconds,
                    DurationSeconds = request.DurationSeconds
                };
            await WriteAsync(library, data, cancellationToken);
            return progress;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Marca o desmarca un episodio y elimina su posición parcial si era el episodio en curso.</summary>
    public async Task<SeriesPlaybackProgress> SetWatchedAsync(SetEpisodeWatchedRequest request, CancellationToken cancellationToken = default)
    {
        string library = NormalizeLibrary(request.LibraryPath);
        string series = NormalizePath(request.SeriesPath);
        string episode = NormalizePath(request.EpisodePath);
        ValidateEpisode(library, series, episode);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            PlaybackProgressLibrary data = await LoadAsync(library, cancellationToken);
            SeriesPlaybackProgress progress = GetOrCreateSeries(data, series);
            // Watched indica la acción manual: true marca como visto; false lo deja pendiente.
            if (request.Watched)
            {
                // Any comprueba si ya está en la lista; ! permite añadirlo solo cuando falta.
                // Same compara las rutas sin distinguir mayúsculas y minúsculas.
                if (!progress.WatchedEpisodePaths.Any(path => Same(path, episode)))
                {
                    progress.WatchedEpisodePaths.Add(episode);
                }
                // Este pasa a ser el último episodio registrado como visto, aunque ya estuviera en la lista.
                // El cliente utiliza esta referencia para buscar el siguiente episodio pendiente.
                progress.LastWatchedEpisodePath = episode;
            }
            else
            {
                // Retira de los vistos las entradas que correspondan al episodio elegido.
                progress.WatchedEpisodePaths.RemoveAll(path => Same(path, episode));
                // Si era la referencia al último visto, la sustituye por la última ruta que quede
                // en la lista. LastOrDefault devuelve null cuando la lista está vacía.
                if (Same(progress.LastWatchedEpisodePath, episode))
                {
                    progress.LastWatchedEpisodePath = progress.WatchedEpisodePaths.LastOrDefault();
                }
            }
            // Si el episodio en curso es el que acabamos de marcar o desmarcar, borra su minuto guardado.
            // Si es otro episodio, conserva su posición.
            EpisodePlaybackProgress? inProgressEpisode = progress.InProgress;
            if (inProgressEpisode != null && Same(inProgressEpisode.EpisodePath, episode))
            {
                progress.InProgress = null;
            }
            // Avanza la fecha para descartar muestras anteriores a esta decisión manual.
            AdvanceRecordedAt(progress);
            await WriteAsync(library, data, cancellationToken);
            return progress;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Vacía los vistos, la posición parcial y el último visto de una serie.</summary>
    public async Task<SeriesPlaybackProgress> ResetAsync(ResetSeriesProgressRequest request, CancellationToken cancellationToken = default)
    {
        string library = NormalizeLibrary(request.LibraryPath);
        string series = NormalizePath(request.SeriesPath);
        if (!Same(Path.GetDirectoryName(series), library) || !Directory.Exists(series))
        {
            throw new ArgumentException("La serie no pertenece a esta biblioteca o su carpeta no existe.");
        }
        await _gate.WaitAsync(cancellationToken);
        try
        {
            PlaybackProgressLibrary data = await LoadAsync(library, cancellationToken);
            SeriesPlaybackProgress progress = GetOrCreateSeries(data, series);
            progress.WatchedEpisodePaths.Clear();
            progress.InProgress = null;
            progress.LastWatchedEpisodePath = null;
            // La fecha del reinicio impide restaurar progreso con guardados que lleguen tarde.
            AdvanceRecordedAt(progress);
            await WriteAsync(library, data, cancellationToken);
            return progress;
        }
        finally
        {
            _gate.Release();
        }
    }

    #endregion

    #region Estado de la serie

    /// <summary>Obtiene la entrada de una serie o la añade a los datos cargados en memoria.</summary>
    private static SeriesPlaybackProgress GetOrCreateSeries(PlaybackProgressLibrary data, string series)
    {
        SeriesPlaybackProgress? progress = data.Series.Find(item => Same(item.SeriesPath, series));
        if (progress is null)
        {
            progress = new SeriesPlaybackProgress { SeriesPath = series };
            data.Series.Add(progress);
        }
        return progress;
    }

    /// <summary>Actualiza la fecha con el reloj UTC del servidor cuando supera la fecha almacenada.</summary>
    private static void AdvanceRecordedAt(SeriesPlaybackProgress progress)
    {
        DateTimeOffset now = DateTimeOffset.UtcNow;
        if (now > progress.LastRecordedAtUtc)
        {
            progress.LastRecordedAtUtc = now;
        }
    }

    #endregion

    #region Validación y rutas

    /// <summary>Compara rutas sin distinguir mayúsculas y minúsculas.</summary>
    private static bool Same(string? left, string? right)
    {
        return string.Equals(left, right, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Comprueba la pertenencia a una ruta descendiente utilizando el separador de carpetas.</summary>
    private static bool IsDescendant(string parent, string child)
    {
        return child.StartsWith(Path.TrimEndingDirectorySeparator(parent) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Exige una ruta absoluta y obtiene su forma completa sin separador final redundante.</summary>
    private static string NormalizePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path))
        {
            throw new ArgumentException("La ruta no es válida.");
        }
        return Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
    }

    /// <summary>Normaliza la biblioteca y comprueba que su carpeta exista.</summary>
    private static string NormalizeLibrary(string path)
    {
        string library = NormalizePath(path);
        if (!Directory.Exists(library))
        {
            throw new ArgumentException("La biblioteca no existe.");
        }
        return library;
    }

    /// <summary>Valida que la serie sea hija directa de la biblioteca y el episodio pertenezca a ella y exista.</summary>
    private static void ValidateEpisode(string library, string series, string episode)
    {
        if (!Same(Path.GetDirectoryName(series), library) || !IsDescendant(series, episode) ||
            !Directory.Exists(series) || !File.Exists(episode) ||
            !new[] { ".mkv", ".mp4", ".avi" }.Contains(Path.GetExtension(episode), StringComparer.OrdinalIgnoreCase))
        {
            throw new ArgumentException("El episodio no pertenece a esta serie y biblioteca o no existe.");
        }
    }

    /// <summary>Exige tiempos finitos, duración positiva y una posición comprendida entre cero y la duración.</summary>
    private static void ValidateTimes(double position, double duration)
    {
        if (!double.IsFinite(position) || !double.IsFinite(duration) || duration <= 0 || position < 0 || position > duration)
        {
            throw new ArgumentException("La posición y la duración del episodio no son válidas.");
        }
    }

    /// <summary>Exige una fecha y tolera como máximo un minuto de adelanto respecto al servidor.</summary>
    private static void ValidateRecordedAt(DateTimeOffset recordedAt)
    {
        if (recordedAt == default || recordedAt > DateTimeOffset.UtcNow.AddMinutes(1))
        {
            throw new ArgumentException("La fecha de reproducción no es válida.");
        }
    }

    /// <summary>Construye el nombre legible de la biblioteca con ocho caracteres del hash de su ruta.</summary>
    private string GetFilePath(string library)
    {
        byte[] pathBytes = Encoding.UTF8.GetBytes(library.ToUpperInvariant());
        byte[] hashBytes = SHA256.HashData(pathBytes);
        string hash = Convert.ToHexString(hashBytes);
        string name = new string(Path.GetFileName(library).Select(character =>
            Path.GetInvalidFileNameChars().Contains(character) ? '_' : character).ToArray()).Trim().TrimEnd('.');
        if (string.IsNullOrWhiteSpace(name))
        {
            name = "Biblioteca";
        }
        if (name.Length > 80)
        {
            name = name[..80];
        }
        return Path.Combine(_directory, $"{name}-{hash[..8]}.json");
    }

    #endregion

    #region Lectura y validación del archivo

    /// <summary>Lee el JSON y valida su contenido; si falta el archivo, devuelve una biblioteca vacía en memoria.</summary>
    private async Task<PlaybackProgressLibrary> LoadAsync(string library, CancellationToken cancellationToken)
    {
        PlaybackProgressLibrary? data;
        try
        {
            await using FileStream stream = new(GetFilePath(library), FileMode.Open, FileAccess.Read, FileShare.Read);
            data = await JsonSerializer.DeserializeAsync<PlaybackProgressLibrary>(stream, JsonOptions, cancellationToken);
        }
        catch (FileNotFoundException)
        {
            return new PlaybackProgressLibrary { LibraryPath = library };
        }
        catch (DirectoryNotFoundException)
        {
            return new PlaybackProgressLibrary { LibraryPath = library };
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException("El archivo de progreso no se puede leer. Se ha conservado sin modificar.", ex);
        }
        try
        {
            ValidateLibraryData(data, library);
        }
        catch (ArgumentException ex)
        {
            throw new InvalidDataException("El archivo de progreso contiene datos inválidos. Se ha conservado sin modificar.", ex);
        }
        return data!;
    }

    /// <summary>Comprueba la cabecera y la coherencia de series, vistos y episodios en curso del JSON.</summary>
    private static void ValidateLibraryData(PlaybackProgressLibrary? data, string library)
    {
        // La cabecera debe contener la versión admitida, la biblioteca consultada y su lista de series.
        if (data is null || data.Version != 1 || !Same(data.LibraryPath, library) || data.Series is null)
        {
            throw new ArgumentException();
        }
        HashSet<string> seriesPaths = new(StringComparer.OrdinalIgnoreCase);
        foreach (SeriesPlaybackProgress item in data.Series)
        {
            // Cada entrada representa una serie hija directa, única y con fecha y lista de vistos.
            if (item is null)
            {
                throw new ArgumentException();
            }
            string series = NormalizePath(item.SeriesPath);
            if (!Same(Path.GetDirectoryName(series), library) || !seriesPaths.Add(series) ||
                item.WatchedEpisodePaths is null || item.LastRecordedAtUtc == default)
            {
                throw new ArgumentException();
            }
            // HashSet.Add devuelve false si ya existe esa ruta de episodio.
            HashSet<string> episodes = new(StringComparer.OrdinalIgnoreCase);
            foreach (string path in item.WatchedEpisodePaths)
            {
                if (!IsDescendant(series, NormalizePath(path)) || !episodes.Add(NormalizePath(path)))
                {
                    throw new ArgumentException();
                }
            }
            // El último visto debe estar incluido entre los episodios marcados como vistos.
            string? lastWatchedEpisodePath = item.LastWatchedEpisodePath;
            if (lastWatchedEpisodePath != null && !episodes.Contains(NormalizePath(lastWatchedEpisodePath)))
            {
                throw new ArgumentException();
            }
            // El episodio en curso necesita tiempos válidos y pertenencia a la serie, y debe estar pendiente de ver.
            EpisodePlaybackProgress? inProgressEpisode = item.InProgress;
            if (inProgressEpisode != null)
            {
                ValidateTimes(inProgressEpisode.PositionSeconds, inProgressEpisode.DurationSeconds);
                string inProgressEpisodePath = NormalizePath(inProgressEpisode.EpisodePath);
                if (!IsDescendant(series, inProgressEpisodePath) || episodes.Contains(inProgressEpisodePath))
                {
                    throw new ArgumentException();
                }
            }
        }
    }

    #endregion

    #region Guardado seguro

    /// <summary>Escribe un temporal completo, lo publica como JSON de destino y trata de retirar el temporal restante.</summary>
    private async Task WriteAsync(string library, PlaybackProgressLibrary data, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_directory);
        string destination = GetFilePath(library);
        string temporary = destination + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            // El archivo se escribe sin lectores concurrentes; WriteThrough solicita escritura a través de los búferes.
            await using (FileStream stream = new(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                4096, FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, data, JsonOptions, cancellationToken);
                // Vacía los datos pendientes del flujo y solicita su vaciado hasta disco antes de publicar.
                await stream.FlushAsync(cancellationToken);
                stream.Flush(flushToDisk: true);
            }
            // El temporal ya está cerrado. Una cancelación aquí conserva el destino anterior.
            cancellationToken.ThrowIfCancellationRequested();
            if (File.Exists(destination))
            {
                File.Replace(temporary, destination, null);
            }
            else
            {
                File.Move(temporary, destination);
            }
        }
        finally
        {
            TryDeleteTemporary(temporary);
        }
    }

    /// <summary>Intenta borrar el temporal sobrante preservando el resultado o la excepción principal.</summary>
    private static void TryDeleteTemporary(string temporary)
    {
        try
        {
            File.Delete(temporary);
        }
        catch (IOException)
        {
            // Un bloqueo del temporal no sustituye el resultado de la operación principal.
        }
        catch (UnauthorizedAccessException)
        {
            // Se conserva el fallo principal si el sistema impide limpiar el temporal.
        }
    }

    #endregion
}
