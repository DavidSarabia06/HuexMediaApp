
using HuexMediaApp.Server.Models;
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json.Nodes;

namespace HuexMediaApp.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ConfigurationController : ControllerBase
    {
        private static readonly HashSet<string> AllowedKeys =
        [
            "SeriesLibraryPath",
            "DownloadSeriesPosters",
            "DownloadEpisodeThumbnails"
        ];

        private readonly ConfigurationService _configurationService;
        private readonly ILogger<ConfigurationController> _logger;

        public ConfigurationController(
            ConfigurationService configurationService,
            ILogger<ConfigurationController> logger)
        {
            _configurationService = configurationService;
            _logger = logger;
        }

        /// <summary>
        /// Obtiene el valor de una configuración.
        /// </summary>
        [HttpGet("get")]
        public IActionResult GetConfiguration([FromQuery] string key)
        {
            // Comprueba que la clave esté permitida.
            if (string.IsNullOrWhiteSpace(key) || !AllowedKeys.Contains(key))
            {
                _logger.LogWarning(
                    "Se ha intentado consultar una clave de configuración no permitida."
                );

                return BadRequest(new
                {
                    error = "La clave de configuración no es válida."
                });
            }

            try
            {
                // Obtiene la configuración desde el servicio.
                var value = _configurationService.Get<JsonNode>(key);

                return Ok(new
                {
                    key,
                    value
                });
            }
            catch (KeyNotFoundException)
            {
                _logger.LogWarning(
                    "No se ha encontrado la configuración '{Key}'.",
                    key
                );

                return NotFound(new
                {
                    error = "No se ha encontrado la configuración solicitada."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Se ha producido un error al obtener la configuración '{Key}'.",
                    key
                );

                return StatusCode(500, new
                {
                    error = "No se ha podido obtener la configuración."
                });
            }
        }

        /// <summary>
        /// Actualiza el valor de una configuración.
        /// </summary>
        [HttpPost("update")]
        public IActionResult UpdateConfiguration(
            [FromBody] ConfigurationRequest request)
        {
            // Comprueba que la clave y el valor sean válidos.
            if (request is null ||
                string.IsNullOrWhiteSpace(request.Key) ||
                !AllowedKeys.Contains(request.Key) ||
                request.Value is null)
            {
                return BadRequest(new
                {
                    error = "La clave o el valor de configuración no es válido."
                });
            }

            try
            {
                // Actualiza la configuración desde el servicio.
                _configurationService.Update(request.Key, request.Value);

                _logger.LogInformation(
                    "Se ha actualizado correctamente la configuración '{Key}'.",
                    request.Key
                );

                return Ok(new
                {
                    success = true,
                    key = request.Key,
                    value = request.Value
                });
            }
            catch (KeyNotFoundException)
            {
                _logger.LogWarning(
                    "No se ha encontrado la configuración '{Key}'.",
                    request.Key
                );

                return NotFound(new
                {
                    error = "La configuración solicitada no existe."
                });
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(
                    "El valor recibido para la configuración '{Key}' no es válido.",
                    request.Key
                );

                return BadRequest(new
                {
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error al actualizar la configuración '{Key}'.",
                    request.Key
                );

                return StatusCode(500, new
                {
                    error = "No se ha podido actualizar la configuración."
                });
            }
        }
    }
}
