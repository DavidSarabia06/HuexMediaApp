namespace HuexMediaApp.Server.Models.PlaybackProgress;

/// <summary>Muestra de reproducción de un episodio o una película.</summary>
public sealed class SavePlaybackProgressRequest
{
    /// <summary>Ruta completa del vídeo reproducido.</summary>
    public string VideoPath { get; set; } = string.Empty;

    /// <summary>Carpeta de la serie para episodios; null para películas.</summary>
    public string? SeriesPath { get; set; }

    /// <summary>Posición global dentro del vídeo, en segundos.</summary>
    public double PositionSeconds { get; set; }

    /// <summary>Duración completa del vídeo, en segundos.</summary>
    public double DurationSeconds { get; set; }

    /// <summary>Instante UTC en el que el cliente registró esta muestra.</summary>
    public DateTimeOffset RecordedAtUtc { get; set; }
}