namespace HuexMediaApp.Server.Models.Categories;

/// <summary>Opciones enlazadas a la sección MoviesCategories de appsettings.json.</summary>
public sealed class MoviesCategoryOptions
{
    /// <summary>Profundidad máxima, contando la categoría principal como nivel 1.</summary>
    public int MaxDepth { get; set; } = 3;
}
