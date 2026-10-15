namespace HuexMediaApp.Server.Models;

public sealed class PlaybackProgressOptions
{
    public double WatchedThresholdPercent { get; set; } = 95;
    public double RemainingSecondsToMarkWatched { get; set; } = 120;
}

public sealed class PlaybackProgressLibrary
{
    public int Version { get; set; } = 1;
    public string LibraryPath { get; set; } = "";
    public List<SeriesPlaybackProgress> Series { get; set; } = [];
}

public sealed class SeriesPlaybackProgress
{
    public string SeriesPath { get; set; } = "";
    public List<string> WatchedEpisodePaths { get; set; } = [];
    public EpisodePlaybackProgress? InProgress { get; set; }
    public string? LastWatchedEpisodePath { get; set; }
    public DateTimeOffset LastRecordedAtUtc { get; set; }
}

public sealed class EpisodePlaybackProgress
{
    public string EpisodePath { get; set; } = "";
    public double PositionSeconds { get; set; }
    public double DurationSeconds { get; set; }
}

public sealed class SavePlaybackProgressRequest
{
    public string LibraryPath { get; set; } = "";
    public string SeriesPath { get; set; } = "";
    public string EpisodePath { get; set; } = "";
    public double PositionSeconds { get; set; }
    public double DurationSeconds { get; set; }
    // Momento de reproducción, para descartar guardados que lleguen fuera de orden.
    public DateTimeOffset RecordedAtUtc { get; set; }
}

public sealed class ResetSeriesProgressRequest
{
    public string LibraryPath { get; set; } = "";
    public string SeriesPath { get; set; } = "";
}

public sealed class SetEpisodeWatchedRequest
{
    public string LibraryPath { get; set; } = "";
    public string SeriesPath { get; set; } = "";
    public string EpisodePath { get; set; } = "";
    public bool Watched { get; set; }
}
