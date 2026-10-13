


using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace HuexMediaApp.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VideoController : ControllerBase
{
    // VideoController: iniciar reproducción, obtener listas HLS,
    // servir segmentos y detener sesiones.

    private readonly VideoService _videoService;
    private readonly ILogger<VideoController> _logger;

    public VideoController(
        VideoService videoService,
        ILogger<VideoController> logger)
    {
        _videoService = videoService;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene la información técnica de un vídeo.
    /// </summary>
    [HttpGet("info")]
    public async Task<IActionResult> GetVideoInfo([FromQuery] string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return BadRequest(new
            {
                error = "La ruta del vídeo no es válida."
            });
        }

        try
        {
            var videoInfo = await _videoService.GetVideoInfoAsync(path);

            return Ok(videoInfo);
        }
        catch (FileNotFoundException)
        {
            return NotFound(new
            {
                error = "No se ha encontrado el vídeo."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al analizar el vídeo '{Path}'.", path);

            return StatusCode(500, new
            {
                error = "No se ha podido analizar el vídeo."
            });
        }
    }


    [HttpPost("start")]
    public async Task<IActionResult> Start(
        [FromQuery] string path,
        [FromQuery] double startSeconds = 0)
    {
        // Comprueba que se haya indicado un archivo.
        if (string.IsNullOrWhiteSpace(path))
        {
            return BadRequest(new
            {
                message = "No se ha indicado la ruta del vídeo."
            });
        }

        // Comprueba que la posición solicitada sea válida.
        if (!double.IsFinite(startSeconds) || startSeconds < 0)
        {
            return BadRequest(new
            {
                message = "La posición inicial no es válida."
            });
        }

        // Inicia FFmpeg desde la posición solicitada.
        string sessionId = await _videoService.StartHlsAsync(
            path,
            startSeconds,
            HttpContext.RequestAborted
        );

        return Ok(new
        {
            sessionId,
            playlistUrl = $"/api/video/hls/{sessionId}/index.m3u8",
            startSeconds
        });
    }



    // Detiene una sesión HLS y elimina sus archivos temporales.
    [HttpPost("stop/{sessionId}")]
    public async Task<IActionResult> Stop(string sessionId)
    {
        // Comprueba que el identificador recibido es válido.
        if (!Guid.TryParseExact(sessionId, "N", out _))
        {
            return BadRequest(new
            {
                message = "El identificador de la sesión no es válido."
            });
        }

        // Solicita al servicio que detenga FFmpeg.
        await _videoService.StopHlsAsync(sessionId);

        return Ok(new
        {
            message = "Sesión de reproducción finalizada."
        });
    }


    [HttpGet("hls/{sessionId}/{fileName}")]
    public IActionResult GetHlsFile(
        string sessionId,
        string fileName)
    {
        string filePath;

        try
        {
            filePath = _videoService.GetHlsFilePath(
                sessionId,
                fileName
            );
        }
        catch (ArgumentException)
        {
            return BadRequest(new
            {
                error = "La solicitud HLS no es válida."
            });
        }

        if (!System.IO.File.Exists(filePath))
        {
            return NotFound(new
            {
                error = "El archivo HLS todavía no está disponible."
            });
        }

        string contentType = fileName.EndsWith(".m3u8")
            ? "application/vnd.apple.mpegurl"
            : "video/mp2t";

        return PhysicalFile(filePath, contentType);
    }

}

