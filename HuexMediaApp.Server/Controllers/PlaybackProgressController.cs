using HuexMediaApp.Server.Models.PlaybackProgress;
using HuexMediaApp.Server.Models.PlaybackProgress.Legacy;
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace HuexMediaApp.Server.Controllers;

/// <summary>Expone el progreso de series y películas por identificador de biblioteca.</summary>
[ApiController]
[Route("api/playbackprogress")]
public sealed class PlaybackProgressController : ControllerBase
{
    private readonly PlaybackProgressService _service;
    private readonly ILogger<PlaybackProgressController> _logger;

    #region Construcción

    public PlaybackProgressController(PlaybackProgressService service, ILogger<PlaybackProgressController> logger)
    {
        _service = service;
        _logger = logger;
    }

    #endregion

    #region Operaciones HTTP

    /// <summary>Consulta el progreso de la biblioteca indicada.</summary>
    [HttpGet]
    public Task<IActionResult> Get([FromQuery] Guid libraryId, CancellationToken cancellationToken)
    {
        return ExecuteAsync(() => _service.GetAsync(libraryId, cancellationToken));
    }

    /// <summary>Guarda la posición de un vídeo y su estado de finalización.</summary>
    [HttpPost]
    public Task<IActionResult> Save([FromQuery] Guid libraryId,
        [FromBody] SavePlaybackProgressRequest request, CancellationToken cancellationToken)
    {
        return ExecuteAsync(() => _service.SaveAsync(libraryId, request, cancellationToken));
    }

    /// <summary>Reinicia los vistos y el episodio en curso de una serie.</summary>
    [HttpPost("reset")]
    public Task<IActionResult> Reset([FromQuery] Guid libraryId,
        [FromBody] ResetSeriesProgressRequest request, CancellationToken cancellationToken)
    {
        return ExecuteAsync(() => _service.ResetAsync(libraryId, request, cancellationToken));
    }

    /// <summary>Cambia el estado visto de una película o un episodio.</summary>
    [HttpPost("watched")]
    public Task<IActionResult> SetWatched([FromQuery] Guid libraryId,
        [FromBody] SetPlaybackWatchedRequest request, CancellationToken cancellationToken)
    {
        return ExecuteAsync(() => _service.SetWatchedAsync(libraryId, request, cancellationToken));
    }

    /// <summary>Oculta una serie de continuar viendo sin reiniciar su progreso.</summary>
    [HttpPost("hide-series")]
    public Task<IActionResult> HideSeries([FromQuery] Guid libraryId,
        [FromBody] ResetSeriesProgressRequest request, CancellationToken cancellationToken)
    {
        return ExecuteAsync(async () =>
        {
            return await _service.HideSeriesAsync(libraryId, request.SeriesPath, cancellationToken);
        });
    }

    /// <summary>Oculta una película de «Continuar viendo» conservando su progreso.</summary>
    [HttpPost("hide")]
    public Task<IActionResult> HideMovie([FromQuery] Guid libraryId, [FromBody] HideContinueWatchingRequest request, CancellationToken cancellationToken)
    {
        return ExecuteAsync(async () =>
        {
            return await _service.HideMovieAsync(
                libraryId,
                request.VideoPath,
                cancellationToken);
        });
    }
    /// <summary>Lista los archivos antiguos disponibles para migración manual.</summary>
    [HttpGet("legacy")]
    public Task<IActionResult> GetLegacyProgress(CancellationToken cancellationToken)
    {
        return ExecuteAsync(() => _service.GetLegacyProgressAsync(cancellationToken));
    }

    /// <summary>Importa el progreso elegido a la biblioteca indicada desde Ajustes.</summary>
    [HttpPost("legacy/migrate")]
    public Task<IActionResult> MigrateLegacyProgress([FromBody] MigratePlaybackProgressRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(() => _service.MigrateLegacyProgressAsync(
            request.FileName, request.LibraryId, cancellationToken));
    }

    #endregion

    #region Ejecución y respuestas

    private async Task<IActionResult> ExecuteAsync<T>(Func<Task<T>> operation)
    {
        try
        {
            return Ok(await operation());
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { error = exception.Message });
        }
        catch (InvalidDataException exception)
        {
            _logger.LogError(exception, "No se ha podido leer el progreso de reproducción.");
            return StatusCode(500, new { error = exception.Message });
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            _logger.LogError(exception, "No se ha podido guardar o cargar el progreso de reproducción.");
            return StatusCode(500, new { error = "No se ha podido guardar o cargar el progreso. Comprueba los permisos y el espacio disponible." });
        }
    }

    #endregion
}
