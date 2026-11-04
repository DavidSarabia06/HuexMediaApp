namespace HuexMediaApp.Server.Models.Categories;

/// <summary>Datos recibidos para cambiar el nombre de un grupo.</summary>
public sealed class RenameCategoryRequest
{
    public string Name { get; set; } = string.Empty;
}