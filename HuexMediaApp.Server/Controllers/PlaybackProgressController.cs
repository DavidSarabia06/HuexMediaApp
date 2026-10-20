using HuexMediaApp.Server.Models;
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace HuexMediaApp.Server.Controllers;

/// <summary>Expone la consulta y los cambios de progreso y centraliza sus respuestas HTTP.</summary>
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

    /// <summary>Devuelve el progreso completo de la biblioteca indicada en la URL.</summary>
    [HttpGet]
    public Task<IActionResult> Get([FromQuery] string libraryPath, CancellationToken cancellationToken)
    {
        return ExecuteAsync(async () => await _service.GetAsync(libraryPath, cancellationToken));
    }

    /// <summary>Guarda una muestra de reproducción recibida en el cuerpo JSON.</summary>
    [HttpPost]
    public Task<IActionResult> Save([FromBody] SavePlaybackProgressRequest request, CancellationToken cancellationToken)
    {
        return ExecuteAsync(async () => await _service.SaveAsync(request, cancellationToken));
    }

    /// <summary>Reinicia los episodios vistos y el episodio en curso de una serie.</summary>
    [HttpPost("reset")]
    public Task<IActionResult> Reset([FromBody] ResetSeriesProgressRequest request, CancellationToken cancellationToken)
    {
        return ExecuteAsync(async () => await _service.ResetAsync(request, cancellationToken));
    }

    /// <summary>Marca o desmarca manualmente un episodio como visto.</summary>
    [HttpPost("watched")]
    public Task<IActionResult> SetWatched([FromBody] SetEpisodeWatchedRequest request, CancellationToken cancellationToken)
    {
        return ExecuteAsync(async () => await _service.SetWatchedAsync(request, cancellationToken));
    }

    #endregion

    #region Ejecución y respuestas

    /// <summary>Ejecuta la operación y convierte los fallos esperados de validación y almacenamiento en respuestas.</summary>
    private async Task<IActionResult> ExecuteAsync(Func<Task<object>> operation)
    {
        try
        {
            // El delegado sitúa la llamada al servicio dentro del try; cada acción conserva su modelo de respuesta.
            return Ok(await operation());
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidDataException ex)
        {
            // Un archivo almacenado incoherente se comunica como un fallo del servidor.
            _logger.LogError(ex, "No se ha podido leer el progreso de reproducción.");
            return StatusCode(500, new { error = ex.Message });
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _logger.LogError(ex, "No se ha podido guardar o cargar el progreso de reproducción.");
            return StatusCode(500, new { error = "No se ha podido guardar o cargar el progreso. Comprueba los permisos y el espacio disponible." });
        }
        // La cancelación se propaga a ASP.NET Core para respetar el fin de la petición.
    }

    #endregion
}
