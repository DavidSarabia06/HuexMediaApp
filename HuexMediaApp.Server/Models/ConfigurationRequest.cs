using System.Text.Json.Nodes;

namespace HuexMediaApp.Server.Models;

public sealed class ConfigurationRequest
{
    public string Key { get; set; } = string.Empty;

    public JsonNode? Value { get; set; }
}