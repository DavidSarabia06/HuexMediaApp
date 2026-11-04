using HuexMediaApp.Server.Models;
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security;

namespace HuexMediaApp.Server.Controllers
{
    /// <summary>Expone la selección de carpeta, el escaneo de películas y sus carátulas locales.</summary>
    [Route("api/[controller]")]
    [ApiController]
    public class MoviesController : ControllerBase
    {
        private readonly MoviesService _moviesService;
        private readonly WindowsFolderSelectionService _windowsFolderSelectionService;
        private readonly ILogger<MoviesController> _logger;

        #region Construcción

        /// <summary>Recibe el explorador de películas, el selector de carpetas y el registro de errores.</summary>
        public MoviesController(MoviesService moviesService, WindowsFolderSelectionService windowsFolderSelectionService, ILogger<MoviesController> logger)
        {
            _moviesService = moviesService;
            _windowsFolderSelectionService = windowsFolderSelectionService;
            _logger = logger;
        }

        #endregion

        #region Operaciones HTTP

        /// <summary>Abre el selector de carpetas y devuelve la ruta elegida.</summary>
        [HttpGet("select-folder")]
        public Task<IActionResult> SelectFolder()
        {
            return ExecuteAsync(() =>
            {
                return Task.FromResult<IActionResult>(Ok(_windowsFolderSelectionService.SelectFolder()));
            }, "No se ha podido seleccionar la carpeta.");
        }

        /// <summary>Escanea la biblioteca indicada y prepara las URLs de sus carátulas.</summary>
        [HttpGet("scan")]
        public Task<IActionResult> ScanMovies([FromQuery] Guid libraryId, CancellationToken cancellationToken)
        {
            return ExecuteAsync(async () =>
            {
                List<MediaItem> movies = await _moviesService.ScanMoviesAsync(libraryId, cancellationToken);
                SetImageUrls(movies, libraryId);

                return Ok(movies);
            }, "No se han podido escanear las películas.");
        }

        /// <summary>Sirve una imagen perteneciente a la biblioteca indicada.</summary>
        [HttpGet("image")]
        public Task<IActionResult> GetImage([FromQuery] Guid libraryId, [FromQuery] string path, CancellationToken cancellationToken)
        {
            return ExecuteAsync(async () =>
            {
                ImageFile? image = await _moviesService.GetImageAsync(libraryId, path, cancellationToken);

                if (image is null)
                {
                    return NotFound();
                }

                return PhysicalFile(image.FullPath, image.ContentType);
            }, "No se ha podido obtener la imagen.");
        }

        #endregion

        #region URLs de imágenes

        /// <summary>Asigna a cada película una URL de imagen vinculada a su biblioteca.</summary>
        private void SetImageUrls(List<MediaItem> items, Guid libraryId)
        {
            foreach (MediaItem item in items)
            {
                item.UrlImagen = GetImageUrl(item.ImagePath, item.UrlImagen, libraryId);
            }
        }

        /// <summary>Genera la URL de la carátula o devuelve la imagen predeterminada.</summary>
        private string GetImageUrl(string? imagePath, string defaultImage, Guid libraryId)
        {
            if (imagePath is null)
            {
                return defaultImage;
            }

            // La petición de imagen lleva el identificador de biblioteca y la ruta.
            return Url.Action(nameof(GetImage), "Movies", new { libraryId, path = imagePath }) ?? defaultImage;
        }

        #endregion

        #region Ejecución y respuestas

        /// <summary>Ejecuta la operación y centraliza las respuestas de error.</summary>
        private async Task<IActionResult> ExecuteAsync(Func<Task<IActionResult>> operation, string errorMessage)
        {
            try
            {
                return await operation();
            }
            catch (OperationCanceledException)
            {
                // ASP.NET Core recibe la cancelación de la petición.
                throw;
            }
            catch (ArgumentException exception)
            {
                return BadRequest(new { error = exception.Message });
            }
            catch (KeyNotFoundException exception)
            {
                return NotFound(new { error = exception.Message });
            }
            catch (SecurityException)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    error = "La imagen no pertenece a la biblioteca indicada."
                });
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "{ErrorMessage}", errorMessage);
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = errorMessage });
            }
        }

        #endregion
    }
}