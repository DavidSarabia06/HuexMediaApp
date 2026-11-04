using System.Text.Json.Serialization;

namespace HuexMediaApp.Server.Models.Libraries;

/// <summary>Tipo de contenido que organiza una biblioteca.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<MediaType>))]
public enum MediaType
{
    Unknown = 0,
    Series = 1,
    Movies = 2
}

