using System.Security;
using HuexMediaApp.Server.Models;
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace HuexMediaApp.Server.Controllers;

/// <summary>Expone la selección y exploración de series y sirve sus imágenes locales.</summary>
[ApiController]
[Route("api/[controller]")]
public class SeriesController : ControllerBase
{
    private readonly SeriesService _seriesService;
    private readonly WindowsFolderSelectionService _windowsFolderSelectionService;
    private readonly ILogger<SeriesController> _logger;

    #region Construcción

    public SeriesController(SeriesService seriesService, WindowsFolderSelectionService windowsFolderSelectionService, ILogger<SeriesController> logger)
    {
        _seriesService = seriesService;
        _windowsFolderSelectionService = windowsFolderSelectionService;
        _logger = logger;
    }

    #endregion

    #region Operaciones HTTP

    /// <summary>Abre el selector de Windows y devuelve la ruta; no actualiza la configuración.</summary>
    [HttpGet("select-folder")]
    public Task<IActionResult> SelectFolder()
    {
        return ExecuteAsync(() =>
        {
            return Task.FromResult<IActionResult>(Ok(
                _windowsFolderSelectionService.SelectFolder("Selecciona la carpeta raíz de las series")));
        }, "No se ha podido seleccionar la carpeta.");
    }

    /// <summary>Devuelve las series disponibles con sus URLs de imagen.</summary>
    [HttpGet("scan")]
    public Task<IActionResult> ScanSeries([FromQuery] Guid libraryId, CancellationToken cancellationToken)
    {
        return ExecuteAsync(async () =>
        {
            List<MediaItem> series = await _seriesService.ScanSeriesAsync(libraryId, cancellationToken);
            SetImageUrls(series, libraryId);
            return Ok(series);
        }, "No se han podido escanear las series.");
    }

    /// <summary>Devuelve los episodios agrupados en temporadas con sus URLs de miniatura.</summary>
    [HttpGet("scan-episodes")]
    public Task<IActionResult> ScanEpisodes([FromQuery] Guid libraryId, [FromQuery] string path, CancellationToken cancellationToken)
    {
        return ExecuteAsync(async () =>
        {
            SeriesEpisodesResponse response = await _seriesService.ScanEpisodesAsync(libraryId, path, cancellationToken);
            foreach (SeriesSeason season in response.Temporadas)
            {
                SetImageUrls(season.Episodios, libraryId);
            }

            return Ok(response);
        }, "No se han podido escanear los episodios.");
    }

    /// <summary>Sirve una imagen existente y permitida de la biblioteca seleccionada.</summary>
    [HttpGet("image")]
    public Task<IActionResult> GetImage([FromQuery] Guid libraryId, [FromQuery] string path, CancellationToken cancellationToken)
    {
        return ExecuteAsync(async () =>
        {
            ImageFile? image = await _seriesService.GetImageAsync(libraryId, path, cancellationToken);
            if (image is null)
            {
                return NotFound();
            }

            return PhysicalFile(image.FullPath, image.ContentType);
        }, "No se ha podido obtener la imagen.");
    }

    #endregion

    #region URLs de imágenes

    /// <summary>Convierte rutas internas a URLs usando el enrutamiento de ASP.NET Core.</summary>
    private void SetImageUrls(List<MediaItem> items, Guid libraryId)
    {
        foreach (MediaItem item in items)
        {
            item.UrlImagen = GetImageUrl(item.ImagePath, item.UrlImagen, libraryId);
        }
    }

    /// <summary>Usa la imagen predeterminada si no existe una local o no se puede generar su URL.</summary>
    private string GetImageUrl(string? imagePath, string defaultImage, Guid libraryId)
    {
        if (imagePath is null)
        {
            return defaultImage;
        }

        return Url.Action(nameof(GetImage), "Series", new { libraryId, path = imagePath }) ?? defaultImage;
    }

    #endregion

    #region Ejecución y respuestas

    /// <summary>Centraliza los errores esperados y conserva el mensaje general de cada operación.</summary>
    private async Task<IActionResult> ExecuteAsync(Func<Task<IActionResult>> operation, string errorMessage)
    {
        try
        {
            return await operation();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (SecurityException)
        {
            // La validación del servicio distingue una ruta externa de un fallo de permisos de disco.
            return StatusCode(StatusCodes.Status403Forbidden);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{ErrorMessage}", errorMessage);
            return StatusCode(500, new { error = errorMessage });
        }
    }

    #endregion
}
