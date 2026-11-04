namespace HuexMediaApp.Server.Models.PlaybackProgress.Legacy;

/// <summary>Archivo antiguo disponible para importar desde Ajustes.</summary>
public sealed class LegacyPlaybackProgressSummary
{
    public string FileName { get; set; } = string.Empty;
    public string LibraryPath { get; set; } = string.Empty;
    public int SeriesCount { get; set; }
    public int WatchedEpisodeCount { get; set; }
    public int InProgressCount { get; set; }
}
