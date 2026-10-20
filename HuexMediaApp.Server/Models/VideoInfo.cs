namespace HuexMediaApp.Server.Models;

/// <summary>Información técnica del archivo original obtenida mediante FFprobe.</summary>
public class VideoInfo
{
    #region Datos del vídeo

    /// <summary>Códec de la primera pista de vídeo.</summary>
    public string VideoCodec { get; set; } = string.Empty;
    /// <summary>Códec de la primera pista de audio.</summary>
    public string AudioCodec { get; set; } = string.Empty;
    /// <summary>Duración del archivo original expresada en segundos.</summary>
    public double Duration { get; set; }
    /// <summary>Anchura de la primera pista de vídeo en píxeles.</summary>
    public int Width { get; set; }
    /// <summary>Altura de la primera pista de vídeo en píxeles.</summary>
    public int Height { get; set; }
    /// <summary>Indica si los códecs detectados difieren de la combinación H.264 y AAC.</summary>
    public bool RequiresTranscoding { get; set; }

    #endregion

    #region Pistas disponibles

    /// <summary>Pistas de audio con su índice absoluto en el archivo.</summary>
    public List<MediaTrack> AudioTracks { get; set; } = [];
    /// <summary>Pistas de subtítulos y su compatibilidad con la extracción a WebVTT.</summary>
    public List<MediaTrack> SubtitleTracks { get; set; } = [];

    #endregion
}

/// <summary>Describe una pista de audio o subtítulos del archivo original.</summary>
public class MediaTrack
{
    #region Identificación y formato

    /// <summary>Índice absoluto del stream, utilizado por FFmpeg con -map 0:Index.</summary>
    public int Index { get; set; }
    /// <summary>Idioma declarado por el archivo; und representa un idioma sin determinar.</summary>
    public string Language { get; set; } = "und";
    /// <summary>Título declarado en las etiquetas de la pista.</summary>
    public string Title { get; set; } = "";
    /// <summary>Códec de la pista.</summary>
    public string Codec { get; set; } = "";

    #endregion

    #region Selección y compatibilidad

    /// <summary>Marca de pista predeterminada declarada por el archivo.</summary>
    public bool IsDefault { get; set; }
    /// <summary>Marca de pista forzada declarada por el archivo.</summary>
    public bool IsForced { get; set; }
    /// <summary>Permite ofrecer la pista como audio o como subtítulos de texto extraíbles.</summary>
    public bool IsSupported { get; set; } = true;

    #endregion
}
