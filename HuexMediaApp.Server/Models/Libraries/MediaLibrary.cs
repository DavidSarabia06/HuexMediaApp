using HuexMediaApp.Server.Models.Categories;
using System.Text.Json.Serialization;

namespace HuexMediaApp.Server.Models.Libraries;

/// <summary>Biblioteca guardada: identidad, carpeta de contenido y organización de categorías.</summary>
public sealed class MediaLibrary
{
    /// <summary>Versión del formato común de bibliotecas.</summary>
    public int Version { get; set; } = 2;

    /// <summary>Identificador estable que relaciona la biblioteca con sus operaciones y progreso.</summary>
    public Guid Id { get; set; }

    /// <summary>Nombre visible en el selector de bibliotecas.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Indica si contiene series o películas.</summary>
    public MediaType MediaType { get; set; } = MediaType.Unknown;

    /// <summary>Carpeta raíz donde están los vídeos de esta biblioteca.</summary>
    public string LibraryPath { get; set; } = string.Empty;

    /// <summary>Ruta del JSON de la biblioteca; se utiliza únicamente en el servidor.</summary>
    [JsonIgnore]
    public string FilePath { get; set; } = string.Empty;

    /// <summary>Categorías principales; sus hijos se almacenan dentro de Subcategories.</summary>
    public List<MediaCategory> Categories { get; set; } = [];
}


