namespace HuexMediaApp.Server.Models.PlaybackProgress;

/// <summary>Documento de progreso de una biblioteca de series o películas.</summary>
public sealed class LibraryPlaybackProgress
{
    /// <summary>Versión del formato común de progreso.</summary>
    public int Version { get; set; } = 2;

    /// <summary>Identificador de la biblioteca a la que pertenece el progreso.</summary>
    public Guid LibraryId { get; set; }

    /// <summary>Historial y episodio en curso de cada serie registrada.</summary>
    public List<SeriesPlaybackProgress> Series { get; set; } = [];

    /// <summary>Estado de reproducción independiente de cada película registrada.</summary>
    public List<MoviePlaybackProgress> Movies { get; set; } = [];
}