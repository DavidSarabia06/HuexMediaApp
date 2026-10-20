namespace HuexMediaApp.Server.Models;

#region Configuración

/// <summary>Márgenes de finalización vinculados a la sección PlaybackProgress de appsettings.</summary>
public sealed class PlaybackProgressOptions
{
    /// <summary>Porcentaje mínimo para considerar visto el episodio; valor inicial 95.</summary>
    public double WatchedThresholdPercent { get; set; } = 95;
    /// <summary>Segundos finales que permiten considerarlo visto aunque falte alcanzar el porcentaje; valor inicial 120.</summary>
    public double RemainingSecondsToMarkWatched { get; set; } = 120;
}

#endregion

#region Datos almacenados

/// <summary>Documento de progreso de una biblioteca, con sus entradas por serie.</summary>
public sealed class PlaybackProgressLibrary
{
    /// <summary>Versión del formato JSON admitida por el servicio.</summary>
    public int Version { get; set; } = 1;
    /// <summary>Ruta de la biblioteca a la que pertenece el documento.</summary>
    public string LibraryPath { get; set; } = "";
    /// <summary>Progreso de las series registradas en la biblioteca.</summary>
    public List<SeriesPlaybackProgress> Series { get; set; } = [];
}

/// <summary>Historial de vistos y único episodio en curso de una serie.</summary>
public sealed class SeriesPlaybackProgress
{
    /// <summary>Ruta de la carpeta de la serie, hija directa de la biblioteca.</summary>
    public string SeriesPath { get; set; } = "";
    /// <summary>Rutas de los episodios marcados como vistos.</summary>
    public List<string> WatchedEpisodePaths { get; set; } = [];
    /// <summary>Último episodio pendiente reproducido con su posición; null cuando está vacío.</summary>
    public EpisodePlaybackProgress? InProgress { get; set; }
    /// <summary>Último episodio registrado como visto; se utiliza para buscar el siguiente pendiente.</summary>
    public string? LastWatchedEpisodePath { get; set; }
    /// <summary>Fecha que ordena las muestras y protege las acciones manuales frente a guardados anteriores.</summary>
    public DateTimeOffset LastRecordedAtUtc { get; set; }
}

/// <summary>Posición del episodio en curso referida a la línea temporal completa del archivo.</summary>
public sealed class EpisodePlaybackProgress
{
    /// <summary>Ruta completa del episodio.</summary>
    public string EpisodePath { get; set; } = "";
    /// <summary>Última posición registrada en segundos del episodio.</summary>
    public double PositionSeconds { get; set; }
    /// <summary>Duración completa del episodio en segundos.</summary>
    public double DurationSeconds { get; set; }
}

#endregion

#region Solicitudes de API

/// <summary>Muestra de reproducción que el cliente solicita guardar.</summary>
public sealed class SavePlaybackProgressRequest
{
    /// <summary>Ruta de la biblioteca.</summary>
    public string LibraryPath { get; set; } = "";
    /// <summary>Ruta de la serie.</summary>
    public string SeriesPath { get; set; } = "";
    /// <summary>Ruta del episodio reproducido.</summary>
    public string EpisodePath { get; set; } = "";
    /// <summary>Posición global dentro del episodio, en segundos.</summary>
    public double PositionSeconds { get; set; }
    /// <summary>Duración completa del episodio en segundos.</summary>
    public double DurationSeconds { get; set; }
    /// <summary>Instante UTC de la muestra; permite descartar guardados recibidos fuera de orden.</summary>
    public DateTimeOffset RecordedAtUtc { get; set; }
}

/// <summary>Biblioteca y serie cuyo historial se quiere reiniciar.</summary>
public sealed class ResetSeriesProgressRequest
{
    /// <summary>Ruta de la biblioteca.</summary>
    public string LibraryPath { get; set; } = "";
    /// <summary>Ruta de la serie.</summary>
    public string SeriesPath { get; set; } = "";
}

/// <summary>Solicitud manual de marcar o desmarcar un episodio como visto.</summary>
public sealed class SetEpisodeWatchedRequest
{
    /// <summary>Ruta de la biblioteca.</summary>
    public string LibraryPath { get; set; } = "";
    /// <summary>Ruta de la serie.</summary>
    public string SeriesPath { get; set; } = "";
    /// <summary>Ruta del episodio.</summary>
    public string EpisodePath { get; set; } = "";
    /// <summary>true marca como visto; false lo deja pendiente de ver.</summary>
    public bool Watched { get; set; }
}

#endregion
