namespace HuexMediaApp.Server.Models.PlaybackProgress.Legacy;

/// <summary>Archivo antiguo y biblioteca que recibirá su progreso.</summary>
public sealed class MigratePlaybackProgressRequest
{
    public string FileName { get; set; } = string.Empty;
    public Guid LibraryId { get; set; }
}
