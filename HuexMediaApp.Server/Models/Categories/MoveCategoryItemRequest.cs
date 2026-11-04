namespace HuexMediaApp.Server.Models.Categories;

/// <summary>Datos para cambiar la categoría de un elemento de la biblioteca.</summary>
public sealed class MoveCategoryItemRequest
{
    /// <summary>Ruta del elemento que se va a mover.</summary>
    public string ItemPath { get; set; } = string.Empty;

    /// <summary>Grupo de destino; null para dejar el elemento sin categoría.</summary>
    public Guid? TargetCategoryId { get; set; }
}