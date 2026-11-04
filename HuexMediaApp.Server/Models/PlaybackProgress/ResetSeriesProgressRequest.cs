namespace HuexMediaApp.Server.Models.PlaybackProgress;

/// <summary>Serie cuyo historial y episodio en curso se quieren reiniciar.</summary>
public sealed class ResetSeriesProgressRequest
{
    /// <summary>Ruta completa de la carpeta de la serie.</summary>
    public string SeriesPath { get; set; } = string.Empty;
}