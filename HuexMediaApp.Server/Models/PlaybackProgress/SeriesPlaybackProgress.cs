namespace HuexMediaApp.Server.Models.PlaybackProgress;

/// <summary>Historial de episodios vistos y único episodio en curso de una serie.</summary>
public sealed class SeriesPlaybackProgress
{
    /// <summary>Ruta completa de la carpeta de la serie.</summary>
    public string SeriesPath { get; set; } = string.Empty;

    /// <summary>Rutas de los episodios marcados como vistos.</summary>
    public List<string> WatchedEpisodePaths { get; set; } = [];

    /// <summary>Último episodio pendiente reproducido; null cuando no hay ninguno en curso.</summary>
    public EpisodePlaybackProgress? InProgress { get; set; }

    /// <summary>Último episodio visto, utilizado para ofrecer el siguiente pendiente.</summary>
    public string? LastWatchedEpisodePath { get; set; }

    /// <summary>Oculta la serie de continuar viendo conservando el progreso.</summary>
    public bool HiddenFromContinueWatching { get; set; }

    /// <summary>Fecha del último cambio aceptado para descartar guardados anteriores.</summary>
    public DateTimeOffset LastRecordedAtUtc { get; set; }
}