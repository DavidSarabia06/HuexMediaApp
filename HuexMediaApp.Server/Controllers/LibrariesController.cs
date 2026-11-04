using HuexMediaApp.Server.Models.Libraries.Legacy;
using HuexMediaApp.Server.Models.Libraries;
using HuexMediaApp.Server.Models;
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace HuexMediaApp.Server.Controllers;

/// <summary>Permite consultar y crear bibliotecas de series y películas.</summary>
[ApiController]
[Route("api/libraries")]
public sealed class LibrariesController : ControllerBase
{
    private readonly LibraryService _libraryService;
    private readonly ILogger<LibrariesController> _logger;

    #region Construcción

    public LibrariesController(
        LibraryService libraryService,
        ILogger<LibrariesController> logger)
    {
        _libraryService = libraryService;
        _logger = logger;
    }

    #endregion

    #region Operaciones HTTP

    /// <summary>Lista las bibliotecas guardadas del tipo solicitado.</summary>
    [HttpGet]
    public Task<IActionResult> GetLibraries(
        [FromQuery] MediaType mediaType,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(() => _libraryService.GetLibrariesAsync(
            mediaType,
            cancellationToken,
            cleanupMissingReferences: true));
    }

    /// <summary>Obtiene una biblioteca completa con sus categorías.</summary>
    [HttpGet("{libraryId:guid}")]
    public Task<IActionResult> Get(
        Guid libraryId,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(() => _libraryService.GetAsync(
            libraryId,
            cancellationToken,
            cleanupMissingReferences: true));
    }

    /// <summary>Registra una biblioteca y guarda su JSON inicial.</summary>
    [HttpPost]
    public Task<IActionResult> Create(
        [FromBody] CreateLibraryRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(() => _libraryService.CreateAsync(
            request.Name,
            request.MediaType,
            request.LibraryPath,
            cancellationToken));
    }

    /// <summary>Elimina el documento de una biblioteca.</summary>
    [HttpPost("{libraryId:guid}/delete")]
    public Task<IActionResult> Delete(Guid libraryId, CancellationToken cancellationToken)
    {
        return ExecuteAsync(async () =>
        {
            await _libraryService.DeleteAsync(
                libraryId,
                cancellationToken);

            return new
            {
                success = true,
                libraryId
            };
        });
    }

    /// <summary>Cambia el nombre visible de una biblioteca.</summary>
    [HttpPost("{libraryId:guid}/rename")]
    public Task<IActionResult> Rename(Guid libraryId, [FromBody] RenameLibraryRequest request, CancellationToken cancellationToken)
    {
        return ExecuteAsync(() =>
        {
            return _libraryService.RenameAsync(
                libraryId,
                request.Name,
                cancellationToken);
        });
    }
    /// <summary>Consulta las bibliotecas antiguas disponibles del tipo solicitado.</summary>
    [HttpGet("legacy")]
    public Task<IActionResult> GetLegacyLibraries(
        [FromQuery] MediaType mediaType,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(() => _libraryService.GetLegacyLibrariesAsync(
            mediaType,
            cancellationToken));
    }

    /// <summary>Actualiza una biblioteca antigua creando un nuevo documento de versión 2.</summary>
    [HttpPost("legacy/migrate")]
    public Task<IActionResult> MigrateLegacy(
        [FromBody] MigrateLibraryRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(() => _libraryService.MigrateLegacyAsync(
            request.Name,
            request.MediaType,
            cancellationToken));
    }
    #endregion

    #region Ejecución y respuestas

    /// <summary>Ejecuta la operación y traduce los errores del servicio a respuestas HTTP.</summary>
    private async Task<IActionResult> ExecuteAsync<T>(
        Func<Task<T>> operation)
    {
        try
        {
            T result = await operation();
            return Ok(result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new
            {
                error = exception.Message
            });
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new
            {
                error = exception.Message
            });
        }
        catch (InvalidDataException exception)
        {
            _logger.LogError(
                exception,
                "Se ha encontrado un archivo de biblioteca no válido.");

            return StatusCode(500, new
            {
                error = exception.Message
            });
        }
        catch (Exception exception) when (
            exception is IOException or UnauthorizedAccessException)
        {
            _logger.LogError(
                exception,
                "No se han podido leer o guardar las bibliotecas.");

            return StatusCode(500, new
            {
                error = "No se han podido leer o guardar las bibliotecas. Comprueba los permisos y el espacio disponible."
            });
        }

        // La cancelación se propaga a ASP.NET Core.
    }

    #endregion
}