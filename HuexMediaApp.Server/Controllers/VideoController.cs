using HuexMediaApp.Server.Models;
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Mvc;
using System.Text;

namespace HuexMediaApp.Server.Controllers;

/// <summary>Expone el análisis, las pistas y las sesiones de vídeo y convierte sus resultados en respuestas HTTP.</summary>
[ApiController]
[Route("api/[controller]")]
public class VideoController : ControllerBase
{
    private readonly VideoService _videoService;
    private readonly ILogger<VideoController> _logger;

    #region Construcción

    public VideoController(VideoService videoService, ILogger<VideoController> logger)
    {
        _videoService = videoService;
        _logger = logger;
    }

    #endregion

    #region Operaciones HTTP

    /// <summary>Consulta la duración, resolución, códecs y pistas del archivo indicado.</summary>
    [HttpGet("info")]
    public Task<IActionResult> GetVideoInfo([FromQuery] string path)
    {
        return ExecuteAsync(async () =>
        {
            VideoInfo videoInfo = await _videoService.GetVideoInfoAsync(path, HttpContext.RequestAborted);
            return Ok(videoInfo);
        }, "No se ha podido analizar el vídeo.");
    }

    /// <summary>Prepara HLS desde la posición y pista de audio solicitadas y devuelve su URL y referencias temporales.</summary>
    [HttpPost("start")]
    public Task<IActionResult> Start(
        [FromQuery] string path,
        [FromQuery] double startSeconds = 0,
        [FromQuery] int? audioTrackIndex = null)
    {
        return ExecuteAsync(async () =>
        {
            PlaybackSession session = await _videoService.StartHlsAsync(
                path, startSeconds, HttpContext.RequestAborted, audioTrackIndex);

            return Ok(new
            {
                sessionId = session.SessionId,
                playlistUrl = $"/api/video/hls/{session.SessionId}/index.m3u8",
                startSeconds = session.StartSeconds,
                timelineStartSeconds = session.TimelineStartSeconds,
                transportTimestampOffsetSeconds = session.TransportTimestampOffsetSeconds
            });
        }, "No se ha podido iniciar la reproducción.");
    }

    /// <summary>Devuelve la pista seleccionada como texto WebVTT codificado en UTF-8.</summary>
    [HttpGet("subtitles")]
    public Task<IActionResult> GetSubtitles([FromQuery] string path, [FromQuery] int trackIndex)
    {
        return ExecuteAsync(async () =>
        {
            string subtitles = await _videoService.GetSubtitlesAsync(path, trackIndex, HttpContext.RequestAborted);
            return Content(subtitles, "text/vtt", Encoding.UTF8);
        }, "No se han podido extraer los subtítulos.");
    }

    /// <summary>Solicita la detención y limpieza; el servicio conserva los intentos pendientes para reintentarlos.</summary>
    [HttpPost("stop/{sessionId}")]
    public Task<IActionResult> Stop(string sessionId)
    {
        return ExecuteAsync(async () =>
        {
            await _videoService.StopHlsAsync(sessionId);
            return Ok(new { message = "Sesión de reproducción finalizada." });
        }, "No se ha podido finalizar la reproducción.");
    }

    /// <summary>Sirve el manifiesto o un segmento de la sesión con su tipo de contenido.</summary>
    [HttpGet("hls/{sessionId}/{fileName}")]
    public Task<IActionResult> GetHlsFile(string sessionId, string fileName)
    {
        return ExecuteAsync(() =>
        {
            HlsMediaFile file = _videoService.GetHlsFile(sessionId, fileName);
            return Task.FromResult<IActionResult>(PhysicalFile(file.FullPath, file.ContentType));
        }, "No se ha podido obtener el archivo HLS.", "El archivo HLS todavía no está disponible.");
    }

    #endregion

    #region Ejecución y respuestas

    /// <summary>Centraliza la ejecución, el registro de fallos y las respuestas 400, 404 y 500.</summary>
    private async Task<IActionResult> ExecuteAsync(
        Func<Task<IActionResult>> operation,
        string errorMessage,
        string notFoundMessage = "No se ha encontrado el vídeo.")
    {
        try
        {
            // La llamada al servicio se realiza dentro del try, también para los archivos HLS.
            return await operation();
        }
        catch (OperationCanceledException)
        {
            // ASP.NET Core recibe la cancelación y el servicio ejecuta su limpieza correspondiente.
            throw;
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { error = notFoundMessage });
        }
        catch (Exception ex)
        {
            // El registro conserva el detalle técnico y la respuesta usa el mensaje de la operación.
            _logger.LogError(ex, "{ErrorMessage}", errorMessage);
            return StatusCode(500, new { error = errorMessage });
        }
    }

    #endregion
}
