using HuexMediaApp.Server.Models.Libraries;
namespace HuexMediaApp.Server.Models.Libraries.Legacy;

/// <summary>Información de una biblioteca antigua detectada para su actualización.</summary>
public sealed class LegacyLibrarySummary
{
    /// <summary>Nombre del archivo original.</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>Tipo de contenido de la biblioteca.</summary>
    public MediaType MediaType { get; set; } = MediaType.Unknown;

    /// <summary>Carpeta de vídeos indicada en el archivo antiguo.</summary>
    public string LibraryPath { get; set; } = string.Empty;

    /// <summary>Número de categorías principales guardadas.</summary>
    public int CategoryCount { get; set; }
}