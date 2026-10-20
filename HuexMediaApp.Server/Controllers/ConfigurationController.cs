using System.Text.Json.Nodes;
using HuexMediaApp.Server.Models;
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace HuexMediaApp.Server.Controllers;

/// <summary>Expone las claves permitidas y traduce los resultados de configuración a respuestas HTTP.</summary>
[ApiController]
[Route("api/[controller]")]
public class ConfigurationController : ControllerBase
{
    private readonly ConfigurationService _configurationService;
    private readonly ILogger<ConfigurationController> _logger;

    #region Construcción

    public ConfigurationController(
        ConfigurationService configurationService,
        ILogger<ConfigurationController> logger)
    {
        _configurationService = configurationService;
        _logger = logger;
    }

    #endregion

    #region Operaciones HTTP

    /// <summary>Obtiene el valor de una clave permitida conservando su tipo JSON.</summary>
    [HttpGet("get")]
    public IActionResult GetConfiguration([FromQuery] string key)
    {
        return Execute(() =>
        {
            JsonNode value = _configurationService.Get<JsonNode>(key);
            return Ok(new { key, value });
        }, key, isUpdate: false);
    }

    /// <summary>Actualiza una clave permitida a partir del cuerpo JSON.</summary>
    [HttpPost("update")]
    public IActionResult UpdateConfiguration([FromBody] ConfigurationRequest request)
    {
        return Execute(() =>
        {
            _configurationService.Update(request.Key, request.Value);
            _logger.LogInformation("Se ha actualizado correctamente la configuración '{Key}'.", request.Key);
            return Ok(new { success = true, key = request.Key, value = request.Value });
        }, request.Key, isUpdate: true);
    }

    #endregion

    #region Ejecución y respuestas

    /// <summary>Ejecuta la acción y centraliza sus errores sin cambiar el contrato de cada operación.</summary>
    private IActionResult Execute(Func<IActionResult> operation, string key, bool isUpdate)
    {
        try
        {
            // La función se invoca aquí para capturar también los fallos del servicio.
            return operation();
        }
        catch (KeyNotFoundException)
        {
            _logger.LogWarning("No se ha encontrado la configuración '{Key}'.", key);
            string message = isUpdate
                ? "La configuración solicitada no existe."
                : "No se ha encontrado la configuración solicitada.";
            return NotFound(new { error = message });
        }
        catch (ArgumentException ex)
        {
            // Incluye claves no permitidas tanto al consultar como al actualizar.
            _logger.LogWarning("La clave o el valor recibido para la configuración '{Key}' no es válido.", key);
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            // Las operaciones son síncronas. Los fallos no previstos se registran
            // completos y se comunican con el mismo mensaje general de cada acción.
            string logMessage = isUpdate
                ? "Error al actualizar la configuración '{Key}'."
                : "Se ha producido un error al obtener la configuración '{Key}'.";
            _logger.LogError(ex, logMessage, key);
            string message = isUpdate
                ? "No se ha podido actualizar la configuración."
                : "No se ha podido obtener la configuración.";
            return StatusCode(500, new { error = message });
        }
    }

    #endregion
}
