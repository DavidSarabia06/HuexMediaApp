using System.Text.Json.Serialization;

namespace HuexMediaApp.Server.Models;

/// <summary>Datos de una tarjeta de película, serie o episodio.</summary>
public class MediaItem
{
    /// <summary>Nombre de la carpeta de serie o del vídeo sin extensión.</summary>
    public string Nombre { get; set; } = "";
    public bool isKey { get; set; } = false;

    /// <summary>Ruta absoluta de la carpeta o del vídeo representado por la tarjeta.</summary>
    public string RutaCompleta { get; set; } = "";

    /// <summary>URL de la imagen local o de la imagen predeterminada.</summary>
    public string UrlImagen { get; set; } = "";

    /// <summary>Ruta interna que el controlador convierte en URL; nunca se envía como propiedad JSON.</summary>
    [JsonIgnore]
    public string? ImagePath { get; set; }
}

public sealed class SeriesSeason
{
    /// <summary>Nombre de carpeta, o «Otros» para el grupo con el mismo nombre que la serie.</summary>
    public string NombreTemporada { get; set; } = "";

    /// <summary>Episodios del grupo ordenados por nombre.</summary>
    public List<MediaItem> Episodios { get; set; } = [];
}

/// <summary>Respuesta de la exploración de episodios.</summary>
public sealed class SeriesEpisodesResponse
{
    /// <summary>Temporadas ordenadas por su nombre.</summary>
    public List<SeriesSeason> Temporadas { get; set; } = [];
}

#region Imágenes locales

/// <summary>Archivo de imagen validado que el controlador sirve como respuesta física.</summary>
public sealed class ImageFile
{
    /// <summary>Ruta completa del archivo dentro de la biblioteca seleccionada.</summary>
    public string FullPath { get; set; } = "";

    /// <summary>Tipo MIME permitido para la imagen.</summary>
    public string ContentType { get; set; } = "";
}

#endregion