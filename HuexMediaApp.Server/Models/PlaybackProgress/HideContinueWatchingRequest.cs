namespace HuexMediaApp.Server.Models.PlaybackProgress;

/// <summary>Vídeo que se quiere ocultar de «Continuar viendo».</summary>
public sealed class HideContinueWatchingRequest
{
    public string VideoPath { get; set; } = string.Empty;
}