using HuexMediaApp.Server.Models.Categories;
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace HuexMediaApp.Server.Controllers
{
    /// <summary>Gestiona las categorías de una biblioteca.</summary>
    [ApiController]
    [Route("api/libraries/{libraryId:guid}/categories")]
    public sealed class CategoriesController : ControllerBase
    {
        private readonly CategoryService _categoryService;
        private readonly ILogger<CategoriesController> _logger;

        #region Construcción

        public CategoriesController(CategoryService categoryService, ILogger<CategoriesController> logger)
        {
            _categoryService = categoryService;
            _logger = logger;
        }

        #endregion

        #region Operaciones HTTP

        /// <summary>Crea una categoría principal y devuelve la biblioteca actualizada.</summary>
        [HttpPost("create")]
        public Task<IActionResult> CreateCategory(Guid libraryId, [FromBody] CreateCategoryRequest request, CancellationToken cancellationToken)
        {
            return ExecuteAsync(() =>
            {
                return _categoryService.CreateCategoryAsync(
                    libraryId,
                    request.Name,
                    cancellationToken);
            });
        }

        /// <summary>Crea una subcategoría dentro del grupo indicado y devuelve la biblioteca actualizada.</summary>
        [HttpPost("{parentId:guid}/create-subcategory")]
        public Task<IActionResult> CreateSubcategory(Guid libraryId, Guid parentId, [FromBody] CreateCategoryRequest request, CancellationToken cancellationToken)
        {
            return ExecuteAsync(() =>
            {
                return _categoryService.CreateSubcategoryAsync(
                    libraryId,
                    parentId,
                    request.Name,
                    cancellationToken);
            });
        }

        /// <summary>Mueve un elemento a una categoría o subcategoría, o lo deja sin categoría.</summary>
        [HttpPost("move-item")]
        public Task<IActionResult> MoveItem(Guid libraryId, [FromBody] MoveCategoryItemRequest request, CancellationToken cancellationToken)
        {
            return ExecuteAsync(() =>
            {
                return _categoryService.MoveItemAsync(
                    libraryId,
                    request.ItemPath,
                    request.TargetCategoryId,
                    cancellationToken);
            });
        }

        /// <summary>Elimina un grupo con sus descendientes y devuelve la biblioteca actualizada.</summary>
        [HttpPost("{categoryId:guid}/delete")]
        public Task<IActionResult> DeleteCategory(Guid libraryId, Guid categoryId, CancellationToken cancellationToken)
        {
            return ExecuteAsync(() =>
            {
                return _categoryService.DeleteCategoryAsync(
                    libraryId,
                    categoryId,
                    cancellationToken);
            });
        }

        /// <summary>Cambia el nombre de una categoría o subcategoría.</summary>
        [HttpPost("{categoryId:guid}/rename")]
        public Task<IActionResult> RenameCategory(Guid libraryId, Guid categoryId, [FromBody] RenameCategoryRequest request, CancellationToken cancellationToken)
        {
            return ExecuteAsync(() =>
            {
                return _categoryService.RenameCategoryAsync(
                    libraryId,
                    categoryId,
                    request.Name,
                    cancellationToken);
            });
        }
        /// <summary>Mueve una categoría o subcategoría una posición dentro de su lista.</summary>
        [HttpPost("{categoryId:guid}/reorder")]
        public Task<IActionResult> ReorderCategory(Guid libraryId, Guid categoryId, [FromBody] ReorderCategoryRequest request, CancellationToken cancellationToken)
        {
            return ExecuteAsync(() =>
            {
                return _categoryService.ReorderCategoryAsync(
                    libraryId,
                    categoryId,
                    request.Offset,
                    cancellationToken);
            });
        }
        #endregion


        #region Ejecución y respuestas

        /// <summary>Ejecuta la operación y convierte los errores del servicio en respuestas HTTP.</summary>
        private async Task<IActionResult> ExecuteAsync<T>(Func<Task<T>> operation)
        {
            try
            {
                T result = await operation();
                return Ok(result);
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
                _logger.LogError(exception, "El archivo de la biblioteca no es válido.");

                return StatusCode(500, new { error = exception.Message });
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
                _logger.LogError(exception, "No se han podido leer o guardar las categorías.");

                return StatusCode(500, new
                {
                    error = "No se han podido leer o guardar las categorías. Comprueba los permisos y el espacio disponible."
                });
            }

            // La cancelación se propaga a ASP.NET Core.
        }

        #endregion
    }
}
