using System.Text.Json.Serialization;

namespace HuexMediaApp.Server.Models;

#region Exploración de la biblioteca

/// <summary>Datos de una serie o episodio que consume la interfaz.</summary>
public sealed class SeriesMediaItem
{
    /// <summary>Nombre de la carpeta de serie o del archivo de vídeo sin extensión.</summary>
    public string Nombre { get; set; } = "";

    /// <summary>Ruta de la carpeta o del vídeo que representa la tarjeta.</summary>
    public string RutaCompleta { get; set; } = "";

    /// <summary>URL de la imagen local o de la imagen predeterminada.</summary>
    public string UrlImagen { get; set; } = "";

    /// <summary>Ruta interna que el controlador convierte en URL; nunca se envía como propiedad JSON.</summary>
    [JsonIgnore]
    public string? ImagePath { get; set; }
}

/// <summary>Episodios agrupados por el nombre de su carpeta contenedora.</summary>
public sealed class SeriesSeason
{
    /// <summary>Nombre de carpeta, o «Otros» para el grupo con el mismo nombre que la serie.</summary>
    public string NombreTemporada { get; set; } = "";

    /// <summary>Episodios del grupo ordenados por nombre.</summary>
    public List<SeriesMediaItem> Episodios { get; set; } = [];
}

/// <summary>Respuesta de la exploración de episodios.</summary>
public sealed class SeriesEpisodesResponse
{
    /// <summary>Temporadas ordenadas por su nombre.</summary>
    public List<SeriesSeason> Temporadas { get; set; } = [];
}

#endregion

#region Selección de carpeta

/// <summary>Resultado de seleccionar una carpeta en Windows.</summary>
public sealed class SeriesFolderSelection
{
    /// <summary>Ruta seleccionada; queda vacía si el usuario cancela.</summary>
    public string Ruta { get; set; } = "";
}

#endregion

#region Imágenes locales

/// <summary>Archivo de imagen validado que el controlador sirve como respuesta física.</summary>
public sealed class SeriesImageFile
{
    /// <summary>Ruta completa del archivo dentro de la biblioteca configurada.</summary>
    public string FullPath { get; set; } = "";

    /// <summary>Tipo MIME permitido para la imagen.</summary>
    public string ContentType { get; set; } = "";
}

#endregion
