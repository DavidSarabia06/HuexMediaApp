namespace HuexMediaApp.Server.Models.Libraries;

/// <summary>Datos recibidos para registrar una biblioteca.</summary>
public sealed class CreateLibraryRequest
{
    /// <summary>Nombre visible de la biblioteca.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Tipo de contenido: Series o Movies.</summary>
    public MediaType MediaType { get; set; } = MediaType.Unknown;

    /// <summary>Carpeta raíz que contiene los vídeos.</summary>
    public string LibraryPath { get; set; } = string.Empty;
}