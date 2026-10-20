using HuexMediaApp.Server.Models;
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HuexMediaApp.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MoviesCategoryController : ControllerBase
    {
        
        private readonly MoviesCategoryService _service;
        private readonly ILogger<MoviesCategoryController> _logger;

        #region Construcción

        public MoviesCategoryController(
            MoviesCategoryService service,
            ILogger<MoviesCategoryController> logger)
        {
            _service = service;
            _logger = logger;
        }

        #endregion

        #region Operaciones HTTP

        /// <summary>Consulta las categorías de la biblioteca indicada en la URL.</summary>
        [HttpGet]
        public Task<IActionResult> Get([FromQuery] string libraryPath, CancellationToken cancellationToken)
        {
            return ExecuteAsync(() => _service.GetAsync(libraryPath, cancellationToken));
        }

        /// <summary>Crea una categoría a partir de la biblioteca y el nombre recibidos en el cuerpo JSON.</summary>
        [HttpPost]
        public Task<IActionResult> CreateCategory([FromBody] CreateMoviesCategoryRequest request, CancellationToken cancellationToken)
        {
            return ExecuteAsync(() => _service.CreateCategoryAsync(request.LibraryPath, request.CategoryName, cancellationToken));
        }

        /// <summary>Crea una subcategoría dentro de la categoría indicada.</summary>
        [HttpPost("subcategories")]
        public Task<IActionResult> CreateSubcategory([FromBody] CreateMoviesSubcategoryRequest request, CancellationToken cancellationToken)
        {
            return ExecuteAsync(() => _service.CreateSubcategoryAsync(
                request.LibraryPath, request.CategoryId, request.SubcategoryName, cancellationToken));
        }

        /// <summary>Cambia la asignación de una serie; un CategoryId null la deja sin categoría.</summary>
        [HttpPost("move")]
        public Task<IActionResult> Move([FromBody] MoveMoviesCategoryRequest request, CancellationToken cancellationToken)
        {
            return ExecuteAsync(() => _service.MoveMovieAsync(request.LibraryPath, request.MoviePath, request.CategoryId, request.SubcategoryId, cancellationToken));
        }

        /// <summary>Elimina la categoría identificada en la ruta dentro de la biblioteca solicitada.</summary>
        [HttpDelete("{categoryId:guid}")]
        public Task<IActionResult> Delete(Guid categoryId, [FromQuery] string libraryPath, CancellationToken cancellationToken)
        {
            return ExecuteAsync(() => _service.DeleteAsync(libraryPath, categoryId, cancellationToken));
        }

        #endregion

        #region Ejecución y respuestas

        /// <summary>Centraliza las respuestas y los errores esperados de las cuatro operaciones.</summary>
        private async Task<IActionResult> ExecuteAsync(Func<Task<List<MoviesCategory>>> operation)
        {
            try
            {
                // El delegado retrasa la llamada al servicio hasta estar dentro del try.
                // Todas las operaciones devuelven la lista completa de categorías.
                List<MoviesCategory> categories = await operation();
                return Ok(categories);
            }
            catch (ArgumentException ex)
            {
                // La solicitud contiene un nombre, una ruta o un identificador no válido.
                return BadRequest(new { error = ex.Message });
            }
            catch (InvalidDataException ex)
            {
                // Un JSON almacenado inválido es un problema del servidor, no de la solicitud.
                _logger.LogError(ex, "No se han podido leer las categorías de pelis.");
                return StatusCode(500, new { error = ex.Message });
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                // Se registra el detalle técnico y se devuelve un mensaje general al cliente.
                _logger.LogError(ex, "No se han podido guardar o cargar las categorías de pelis.");
                return StatusCode(500, new
                {
                    error = "No se han podido guardar o cargar las categorías. Comprueba los permisos y el espacio disponible."
                });
            }
            // La cancelación no se convierte en un fallo de guardado: se propaga a ASP.NET Core.
        }

        #endregion
    }

}

