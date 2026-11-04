namespace HuexMediaApp.Server.Models.PlaybackProgress;

/// <summary>Solicitud manual de marcar o desmarcar un vídeo como visto.</summary>
public sealed class SetPlaybackWatchedRequest
{
    /// <summary>Ruta completa del episodio o película.</summary>
    public string VideoPath { get; set; } = string.Empty;

    /// <summary>Carpeta de la serie para episodios; null para películas.</summary>
    public string? SeriesPath { get; set; }

    /// <summary>true para marcar como visto; false para dejarlo pendiente.</summary>
    public bool Watched { get; set; }
}