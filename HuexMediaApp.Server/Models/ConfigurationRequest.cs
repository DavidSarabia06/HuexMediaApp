using System.Text.Json.Nodes;

namespace HuexMediaApp.Server.Models;

/// <summary>
/// Cuerpo JSON para actualizar una clave existente de HuexMediaAppSettings.
/// El servicio valida la presencia de la clave, su permiso y el valor recibido.
/// </summary>
public sealed class ConfigurationRequest
{
    /// <summary>Nombre exacto de una de las claves permitidas por el servicio.</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>
    /// Valor JSON con su tipo original, por ejemplo un booleano o una cadena.
    /// Si se omite o es null, el servicio rechaza la actualización.
    /// </summary>
    public JsonNode? Value { get; set; }
}
