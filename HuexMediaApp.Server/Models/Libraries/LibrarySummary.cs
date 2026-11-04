namespace HuexMediaApp.Server.Models.Libraries;

/// <summary>Datos que necesita el cliente para identificar y elegir una biblioteca.</summary>
public sealed class LibrarySummary
{
    /// <summary>Identificador utilizado al solicitar la biblioteca.</summary>
    public Guid Id { get; set; }

    /// <summary>Nombre que muestra el selector.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Tipo de contenido de la biblioteca.</summary>
    public MediaType MediaType { get; set; } = MediaType.Unknown;

    /// <summary>Carpeta de contenido, para distinguir bibliotecas con nombres parecidos.</summary>
    public string LibraryPath { get; set; } = string.Empty;
}