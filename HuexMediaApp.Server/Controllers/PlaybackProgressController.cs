using HuexMediaApp.Server.Models;
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace HuexMediaApp.Server.Controllers;

[ApiController]
[Route("api/playbackprogress")]
public sealed class PlaybackProgressController(PlaybackProgressService service, ILogger<PlaybackProgressController> logger) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> Get([FromQuery] string libraryPath, CancellationToken cancellationToken) =>
        ExecuteAsync(async () => await service.GetAsync(libraryPath, cancellationToken));

    [HttpPost]
    public Task<IActionResult> Save([FromBody] SavePlaybackProgressRequest request, CancellationToken cancellationToken) =>
        ExecuteAsync(async () => await service.SaveAsync(request, cancellationToken));

    [HttpPost("reset")]
    public Task<IActionResult> Reset([FromBody] ResetSeriesProgressRequest request, CancellationToken cancellationToken) =>
        ExecuteAsync(async () => await service.ResetAsync(request, cancellationToken));

    [HttpPost("watched")]
    public Task<IActionResult> SetWatched([FromBody] SetEpisodeWatchedRequest request, CancellationToken cancellationToken) =>
        ExecuteAsync(async () => await service.SetWatchedAsync(request, cancellationToken));

    private async Task<IActionResult> ExecuteAsync(Func<Task<object>> operation)
    {
        try { return Ok(await operation()); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        catch (InvalidDataException ex)
        {
            logger.LogError(ex, "No se ha podido leer el progreso de reproducción.");
            return StatusCode(500, new { error = ex.Message });
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogError(ex, "No se ha podido guardar o cargar el progreso de reproducción.");
            return StatusCode(500, new { error = "No se ha podido guardar o cargar el progreso. Comprueba los permisos y el espacio disponible." });
        }
    }
}
