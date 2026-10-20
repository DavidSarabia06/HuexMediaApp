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
    private readonly ILogger<SeriesController> _logger;

    #region Construcción

    public SeriesController(SeriesService seriesService, ILogger<SeriesController> logger)
    {
        _seriesService = seriesService;
        _logger = logger;
    }

    #endregion

    #region Operaciones HTTP

    /// <summary>Abre el selector de Windows y devuelve la ruta; no actualiza la configuración.</summary>
    [HttpGet("select-folder")]
    public IActionResult SelectFolder()
    {
        return Execute(() => Ok(_seriesService.SelectFolder()), "No se ha podido seleccionar la carpeta.");
    }

    /// <summary>Devuelve las series disponibles con sus URLs de imagen.</summary>
    [HttpGet("scan")]
    public IActionResult ScanSeries([FromQuery] string path)
    {
        return Execute(() =>
        {
            List<SeriesMediaItem> series = _seriesService.ScanSeries(path);
            SetImageUrls(series);
            return Ok(series);
        }, "No se han podido escanear las series.");
    }

    /// <summary>Devuelve los episodios agrupados en temporadas con sus URLs de miniatura.</summary>
    [HttpGet("scan-episodes")]
    public IActionResult ScanEpisodes([FromQuery] string path)
    {
        return Execute(() =>
        {
            SeriesEpisodesResponse response = _seriesService.ScanEpisodes(path);
            foreach (SeriesSeason season in response.Temporadas)
            {
                SetImageUrls(season.Episodios);
            }

            return Ok(response);
        }, "No se han podido escanear los episodios.");
    }

    /// <summary>Sirve una imagen existente y permitida de la biblioteca configurada.</summary>
    [HttpGet("image")]
    public IActionResult GetImage([FromQuery] string path)
    {
        return Execute(() =>
        {
            SeriesImageFile? image = _seriesService.GetImage(path);
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
    private void SetImageUrls(List<SeriesMediaItem> items)
    {
        foreach (SeriesMediaItem item in items)
        {
            item.UrlImagen = GetImageUrl(item.ImagePath, item.UrlImagen);
        }
    }

    /// <summary>Usa la imagen predeterminada si no existe una local o no se puede generar su URL.</summary>
    private string GetImageUrl(string? imagePath, string defaultImage)
    {
        if (imagePath is null)
        {
            return defaultImage;
        }

        return Url.Action(nameof(GetImage), "Series", new { path = imagePath }) ?? defaultImage;
    }

    #endregion

    #region Ejecución y respuestas

    /// <summary>Centraliza los errores esperados y conserva el mensaje general de cada operación.</summary>
    private IActionResult Execute(Func<IActionResult> operation, string errorMessage)
    {
        try
        {
            return operation();
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
