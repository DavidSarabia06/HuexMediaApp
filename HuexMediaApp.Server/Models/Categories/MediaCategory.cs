namespace HuexMediaApp.Server.Models.Categories;

/// <summary>Categoría de una biblioteca con sus elementos directos y sus subcategorías.</summary>
public sealed class MediaCategory
{
    /// <summary>Identificador estable de la categoría.</summary>
    public Guid Id { get; set; }

    /// <summary>Nombre visible de la categoría.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Rutas asignadas directamente a este grupo:
    /// carpetas de series o archivos de películas.
    /// </summary>
    public List<string> ItemPaths { get; set; } = [];

    /// <summary>Grupos hijos; cada uno puede contener elementos y otras subcategorías.</summary>
    public List<MediaCategory> Subcategories { get; set; } = [];
}