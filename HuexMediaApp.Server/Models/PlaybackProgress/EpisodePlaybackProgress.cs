namespace HuexMediaApp.Server.Models.PlaybackProgress;

/// <summary>Posición guardada del único episodio en curso de una serie.</summary>
public sealed class EpisodePlaybackProgress
{
    /// <summary>Ruta completa del episodio.</summary>
    public string EpisodePath { get; set; } = string.Empty;

    /// <summary>Posición global dentro del episodio, en segundos.</summary>
    public double PositionSeconds { get; set; }

    /// <summary>Duración completa del episodio, en segundos.</summary>
    public double DurationSeconds { get; set; }
}