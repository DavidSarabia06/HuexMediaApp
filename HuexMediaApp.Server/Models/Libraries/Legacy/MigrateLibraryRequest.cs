using HuexMediaApp.Server.Models.Libraries;
namespace HuexMediaApp.Server.Models.Libraries.Legacy;

/// <summary>Nombre y tipo de la biblioteca antigua que se quiere actualizar.</summary>
public sealed class MigrateLibraryRequest
{
    public string Name { get; set; } = string.Empty;

    public MediaType MediaType { get; set; } = MediaType.Unknown;
}