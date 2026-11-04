namespace HuexMediaApp.Server.Models.PlaybackProgress.Legacy;

/// <summary>Datos del documento de progreso de series de versión 1.</summary>
public sealed class LegacyPlaybackProgressDocument
{
    public int Version { get; set; }
    public string LibraryPath { get; set; } = string.Empty;
    public List<SeriesPlaybackProgress> Series { get; set; } = [];
}
