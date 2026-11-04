namespace HuexMediaApp.Server.Models.Libraries;

/// <summary>Datos recibidos para cambiar el nombre de una biblioteca.</summary>
public sealed class RenameLibraryRequest
{
    public string Name { get; set; } = string.Empty;
}