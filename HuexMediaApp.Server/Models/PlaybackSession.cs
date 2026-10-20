namespace HuexMediaApp.Server.Models;

/// <summary>Identifica una sesión HLS y relaciona sus tiempos con el episodio original.</summary>
public class PlaybackSession
{
    #region Identificación y tiempos

    /// <summary>GUID sin separadores que identifica el proceso y su carpeta temporal.</summary>
    public string SessionId { get; set; } = "";
    /// <summary>Posición en segundos solicitada al iniciar o buscar en el vídeo.</summary>
    public double StartSeconds { get; set; }
    /// <summary>Inicio real del primer segmento en la línea temporal del episodio, ajustado como mínimo a cero.</summary>
    public double TimelineStartSeconds { get; set; }
    /// <summary>Margen añadido a las marcas del transporte HLS; el cliente lo resta para obtener el tiempo del episodio.</summary>
    public double TransportTimestampOffsetSeconds { get; set; }

    #endregion
}

/// <summary>Archivo local HLS validado por el servicio para su entrega desde el controlador.</summary>
public sealed class HlsMediaFile
{
    /// <summary>Ruta completa del manifiesto o segmento dentro de la carpeta de sesión.</summary>
    public string FullPath { get; set; } = "";
    /// <summary>Tipo MIME de la lista M3U8 o del segmento MPEG-TS.</summary>
    public string ContentType { get; set; } = "";
}
