namespace HuexMediaApp.Server.Models.Categories;

/// <summary>Datos recibidos para crear una categoría en una biblioteca.</summary>
public sealed class CreateCategoryRequest
{
    /// <summary>Nombre visible de la categoría.</summary>
    public string Name { get; set; } = string.Empty;
}