using HuexMediaApp.Server.Models;
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security;

namespace HuexMediaApp.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MoviesController : ControllerBase
    {
        private readonly MoviesService _moviesService;
        private readonly ILogger<MoviesController> _logger;

        #region Construcción

        public MoviesController(MoviesService moviesService, ILogger<MoviesController> logger)
        {
            _moviesService = moviesService;
            _logger = logger;
        }
        #endregion

        #region Operaciones HTTP

        /// <summary>Abre el selector de Windows y devuelve la ruta; no actualiza la configuración.</summary>
        [HttpGet("select-folder")]
        public IActionResult SelectFolder()
        {
            return Execute(() => Ok(_moviesService.SelectFolder()), "No se ha podido seleccionar la carpeta.");
        }

        /// <summary>Devuelve las películas disponibles con sus URLs de imagen.</summary>
        [HttpGet("scan")]
        public IActionResult ScanMovies([FromQuery] string path)
        {
            return Execute(() =>
            {
                List<MoviesMediaItem> movies = _moviesService.ScanMovies(path);
                SetImageUrls(movies);
                return Ok(movies);
            }, "No se han podido escanear las películas.");
        }


        /// <summary>Sirve una imagen existente y permitida de la biblioteca configurada.</summary>
        [HttpGet("image")]
        public IActionResult GetImage([FromQuery] string path)
        {
            return Execute(() =>
            {
                SeriesImageFile? image = _moviesService.GetImage(path);
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
        private void SetImageUrls(List<MoviesMediaItem> items)
        {
            foreach (MoviesMediaItem item in items)
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
            
            return Url.Action(nameof(GetImage), "Movies", new { path = imagePath }) ?? defaultImage;
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
}
