namespace HuexMediaApp.Server.Models.Categories;

/// <summary>Desplazamiento de un grupo respecto a los que comparten su padre.</summary>
public sealed class ReorderCategoryRequest
{
    /// <summary>-1 para subir una posición; 1 para bajar una posición.</summary>
    public int Offset { get; set; }
}