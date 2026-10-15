using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HuexMediaApp.Server.Models;
using Microsoft.Extensions.Options;

namespace HuexMediaApp.Server.Services;

public sealed class PlaybackProgressService(IHostEnvironment environment, IOptionsMonitor<PlaybackProgressOptions> options)
{
    private readonly string _directory = Path.Combine(environment.ContentRootPath, "App_Data", "PlaybackProgress");
    private readonly SemaphoreSlim _gate = new(1, 1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public async Task<PlaybackProgressLibrary> GetAsync(string libraryPath, CancellationToken cancellationToken = default)
    {
        var library = NormalizeLibrary(libraryPath);
        await _gate.WaitAsync(cancellationToken);
        try { return await LoadAsync(library, cancellationToken); }
        finally { _gate.Release(); }
    }

    public async Task<SeriesPlaybackProgress> SaveAsync(SavePlaybackProgressRequest request, CancellationToken cancellationToken = default)
    {
        var library = NormalizeLibrary(request.LibraryPath);
        var series = NormalizePath(request.SeriesPath);
        var episode = NormalizePath(request.EpisodePath);
        if (!Same(Path.GetDirectoryName(series), library) || !IsDescendant(series, episode) ||
            !Directory.Exists(series) || !File.Exists(episode) ||
            !new[] { ".mkv", ".mp4", ".avi" }.Contains(Path.GetExtension(episode), StringComparer.OrdinalIgnoreCase))
            throw new ArgumentException("El episodio no pertenece a esta serie y biblioteca o no existe.");
        ValidateTimes(request.PositionSeconds, request.DurationSeconds);
        if (request.RecordedAtUtc == default || request.RecordedAtUtc > DateTimeOffset.UtcNow.AddMinutes(1))
            throw new ArgumentException("La fecha de reproducción no es válida.");

        var settings = options.CurrentValue;
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(library, cancellationToken);
            var progress = data.Series.Find(item => Same(item.SeriesPath, series));
            if (progress is null)
            {
                progress = new SeriesPlaybackProgress { SeriesPath = series };
                data.Series.Add(progress);
            }
            if (request.RecordedAtUtc <= progress.LastRecordedAtUtc) return progress;
            // Abrir un vídeo sin reproducirlo no sustituye el capítulo a medias.
            if (request.PositionSeconds == 0) return progress;
            progress.LastRecordedAtUtc = request.RecordedAtUtc;
            var watched = request.PositionSeconds / request.DurationSeconds * 100 >= settings.WatchedThresholdPercent ||
                request.DurationSeconds - request.PositionSeconds <= settings.RemainingSecondsToMarkWatched;
            if (watched && !progress.WatchedEpisodePaths.Any(path => Same(path, episode)))
                progress.WatchedEpisodePaths.Add(episode);
            if (watched) progress.LastWatchedEpisodePath = episode;

            // El último episodio reproducido sustituye al anterior, conservando los vistos.
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
        finally { _gate.Release(); }
    }

    public async Task<SeriesPlaybackProgress> SetWatchedAsync(SetEpisodeWatchedRequest request, CancellationToken cancellationToken = default)
    {
        var library = NormalizeLibrary(request.LibraryPath);
        var series = NormalizePath(request.SeriesPath);
        var episode = NormalizePath(request.EpisodePath);
        if (!Same(Path.GetDirectoryName(series), library) || !IsDescendant(series, episode) ||
            !Directory.Exists(series) || !File.Exists(episode) ||
            !new[] { ".mkv", ".mp4", ".avi" }.Contains(Path.GetExtension(episode), StringComparer.OrdinalIgnoreCase))
            throw new ArgumentException("El episodio no pertenece a esta serie y biblioteca o no existe.");
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(library, cancellationToken);
            var progress = data.Series.Find(item => Same(item.SeriesPath, series));
            if (progress is null)
            {
                progress = new SeriesPlaybackProgress { SeriesPath = series };
                data.Series.Add(progress);
            }
            if (request.Watched)
            {
                if (!progress.WatchedEpisodePaths.Any(path => Same(path, episode))) progress.WatchedEpisodePaths.Add(episode);
                progress.LastWatchedEpisodePath = episode;
            }
            else
            {
                progress.WatchedEpisodePaths.RemoveAll(path => Same(path, episode));
                if (Same(progress.LastWatchedEpisodePath, episode))
                    progress.LastWatchedEpisodePath = progress.WatchedEpisodePaths.LastOrDefault();
            }
            if (progress.InProgress is { } partial && Same(partial.EpisodePath, episode)) progress.InProgress = null;
            var now = DateTimeOffset.UtcNow;
            if (now > progress.LastRecordedAtUtc) progress.LastRecordedAtUtc = now;
            await WriteAsync(library, data, cancellationToken);
            return progress;
        }
        finally { _gate.Release(); }
    }

    public async Task<SeriesPlaybackProgress> ResetAsync(ResetSeriesProgressRequest request, CancellationToken cancellationToken = default)
    {
        var library = NormalizeLibrary(request.LibraryPath);
        var series = NormalizePath(request.SeriesPath);
        if (!Same(Path.GetDirectoryName(series), library) || !Directory.Exists(series))
            throw new ArgumentException("La serie no pertenece a esta biblioteca o su carpeta no existe.");
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(library, cancellationToken);
            var progress = data.Series.Find(item => Same(item.SeriesPath, series));
            if (progress is null)
            {
                progress = new SeriesPlaybackProgress { SeriesPath = series };
                data.Series.Add(progress);
            }
            progress.WatchedEpisodePaths.Clear();
            progress.InProgress = null;
            progress.LastWatchedEpisodePath = null;
            // Conserva la fecha del reinicio para descartar guardados anteriores que lleguen tarde.
            var now = DateTimeOffset.UtcNow;
            if (now > progress.LastRecordedAtUtc) progress.LastRecordedAtUtc = now;
            await WriteAsync(library, data, cancellationToken);
            return progress;
        }
        finally { _gate.Release(); }
    }

    private static bool Same(string? left, string? right) => string.Equals(left, right, StringComparison.OrdinalIgnoreCase);
    private static bool IsDescendant(string parent, string child) =>
        child.StartsWith(Path.TrimEndingDirectorySeparator(parent) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);

    private static string NormalizePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path))
            throw new ArgumentException("La ruta no es válida.");
        return Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
    }

    private static string NormalizeLibrary(string path)
    {
        var library = NormalizePath(path);
        if (!Directory.Exists(library)) throw new ArgumentException("La biblioteca no existe.");
        return library;
    }

    private static void ValidateTimes(double position, double duration)
    {
        if (!double.IsFinite(position) || !double.IsFinite(duration) || duration <= 0 || position < 0 || position > duration)
            throw new ArgumentException("La posición y la duración del episodio no son válidas.");
    }

    private string GetFilePath(string library)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(library.ToUpperInvariant())));
        var name = new string(Path.GetFileName(library).Select(character =>
            Path.GetInvalidFileNameChars().Contains(character) ? '_' : character).ToArray()).Trim().TrimEnd('.');
        if (string.IsNullOrWhiteSpace(name)) name = "Biblioteca";
        if (name.Length > 80) name = name[..80];
        return Path.Combine(_directory, $"{name}-{hash[..8]}.json");
    }

    private async Task<PlaybackProgressLibrary> LoadAsync(string library, CancellationToken cancellationToken)
    {
        PlaybackProgressLibrary? data;
        try
        {
            await using var stream = new FileStream(GetFilePath(library), FileMode.Open, FileAccess.Read, FileShare.Read);
            data = await JsonSerializer.DeserializeAsync<PlaybackProgressLibrary>(stream, JsonOptions, cancellationToken);
        }
        catch (FileNotFoundException) { return new() { LibraryPath = library }; }
        catch (DirectoryNotFoundException) { return new() { LibraryPath = library }; }
        catch (JsonException ex) { throw new InvalidDataException("El archivo de progreso no se puede leer. Se ha conservado sin modificar.", ex); }
        try
        {
            if (data is null || data.Version != 1 || !Same(data.LibraryPath, library) || data.Series is null)
                throw new ArgumentException();
            var seriesPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var item in data.Series)
            {
                if (item is null) throw new ArgumentException();
                var series = NormalizePath(item.SeriesPath);
                if (!Same(Path.GetDirectoryName(series), library) || !seriesPaths.Add(series) ||
                    item.WatchedEpisodePaths is null || item.LastRecordedAtUtc == default)
                    throw new ArgumentException();
                var episodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var path in item.WatchedEpisodePaths)
                    if (!IsDescendant(series, NormalizePath(path)) || !episodes.Add(NormalizePath(path))) throw new ArgumentException();
                if (item.LastWatchedEpisodePath is { } lastWatched && !episodes.Contains(NormalizePath(lastWatched)))
                    throw new ArgumentException();
                if (item.InProgress is { } partial)
                {
                    ValidateTimes(partial.PositionSeconds, partial.DurationSeconds);
                    if (!IsDescendant(series, NormalizePath(partial.EpisodePath)) || episodes.Contains(NormalizePath(partial.EpisodePath)))
                        throw new ArgumentException();
                }
            }
        }
        catch (ArgumentException ex) { throw new InvalidDataException("El archivo de progreso contiene datos inválidos. Se ha conservado sin modificar.", ex); }
        return data;
    }

    private async Task WriteAsync(string library, PlaybackProgressLibrary data, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_directory);
        var destination = GetFilePath(library);
        var temporary = destination + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                4096, FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, data, JsonOptions, cancellationToken);
                await stream.FlushAsync(cancellationToken);
                stream.Flush(flushToDisk: true);
            }
            cancellationToken.ThrowIfCancellationRequested();
            if (File.Exists(destination)) File.Replace(temporary, destination, null);
            else File.Move(temporary, destination);
        }
        finally
        {
            try { File.Delete(temporary); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }
}
