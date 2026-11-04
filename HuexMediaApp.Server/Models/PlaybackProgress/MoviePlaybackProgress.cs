namespace HuexMediaApp.Server.Models.PlaybackProgress;

/// <summary>Estado de reproducción guardado de una película.</summary>
public sealed class MoviePlaybackProgress
{
    /// <summary>Ruta completa de la película.</summary>
    public string MoviePath { get; set; } = string.Empty;

    /// <summary>Última posición registrada en segundos del archivo original.</summary>
    public double PositionSeconds { get; set; }

    /// <summary>Duración completa de la película, en segundos.</summary>
    public double DurationSeconds { get; set; }

    /// <summary>Indica si la película está marcada como vista.</summary>
    public bool Watched { get; set; }

    /// <summary>Fecha del último cambio aceptado para descartar guardados anteriores.</summary>
    public DateTimeOffset LastRecordedAtUtc { get; set; }

    /// <summary>Oculta la película de «Continuar viendo» sin eliminar su progreso.</summary>
    public bool HiddenFromContinueWatching { get; set; }
}