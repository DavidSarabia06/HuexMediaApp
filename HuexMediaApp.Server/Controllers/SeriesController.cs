
using HuexMediaApp.Server.Services;
using Microsoft.AspNetCore.Mvc;
using System.Windows.Forms;

namespace HuexMediaApp.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SeriesController : ControllerBase
{
    private const string DefaultSeriesImage = "/default-episode-vertical.png";
    private const string DefaultEpisodeImage = "/default-episode-horizontal.png";

    private static readonly string[] VideoExtensions = [".mp4", ".mkv", ".avi"];
    private static readonly string[] ImageExtensions = [".jpg", ".png", ".bmp"];

    private readonly ConfigurationService _configurationService;
    private readonly ILogger<SeriesController> _logger;

    public SeriesController(
        ConfigurationService configurationService,
        ILogger<SeriesController> logger)
    {
        _configurationService = configurationService;
        _logger = logger;
    }

    /// <summary>
    /// Permite seleccionar la carpeta raíz de las series.
    /// </summary>
    [HttpGet("select-folder")]
    public IActionResult SelectFolder()
    {
        try
        {
            string selectedPath = string.Empty;

            // El diálogo de Windows necesita ejecutarse en un hilo STA.
            Thread thread = new(() =>
            {
                using FolderBrowserDialog dialog = new()
                {
                    Description = "Selecciona la carpeta raíz de tus series",
                    UseDescriptionForTitle = true,
                    ShowNewFolderButton = false
                };

                if (dialog.ShowDialog() == DialogResult.OK)
                {
                    selectedPath = dialog.SelectedPath;
                }
            });

            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();
            thread.Join();

            return Ok(new { ruta = selectedPath });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al seleccionar la carpeta de series.");

            return StatusCode(500, new
            {
                error = "No se ha podido seleccionar la carpeta."
            });
        }
    }

    /// <summary>
    /// Obtiene las series disponibles en una carpeta.
    /// </summary>
    [HttpGet("scan")]
    public IActionResult ScanSeries([FromQuery] string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
        {
            return BadRequest(new
            {
                error = "La ruta de series no es válida o no existe."
            });
        }

        try
        {
            bool downloadPosters = _configurationService.Get<bool>(
                "DownloadSeriesPosters"
            );

            var series = Directory.GetDirectories(path)
                .Select(directory =>
                {
                    string name = Path.GetFileName(directory);

                    string? imagePath = downloadPosters
                        ? FindImage(directory, "icono", ImageExtensions)
                        : null;

                    return new
                    {
                        nombre = name,
                        rutaCompleta = directory,
                        urlImagen = GetImageUrl(imagePath, DefaultSeriesImage)
                    };
                })
                .ToList();

            _logger.LogInformation(
                "Se han encontrado {Count} series en '{Path}'.",
                series.Count,
                path
            );

            return Ok(series);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al escanear las series de '{Path}'.", path);

            return StatusCode(500, new
            {
                error = "No se han podido escanear las series."
            });
        }
    }

    /// <summary>
    /// Obtiene los episodios agrupados por temporadas.
    /// </summary>
    [HttpGet("scan-episodes")]
    public IActionResult ScanEpisodes([FromQuery] string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
        {
            return BadRequest(new
            {
                error = "La ruta de la serie no es válida o no existe."
            });
        }

        try
        {
            bool downloadThumbnails = _configurationService.Get<bool>(
                "DownloadEpisodeThumbnails"
            );

            string seriesName = Path.GetFileName(
                Path.TrimEndingDirectorySeparator(path)
            );

            var seasons = Directory
                .EnumerateFiles(path, "*", SearchOption.AllDirectories)
                .Where(file => VideoExtensions.Contains(
                    Path.GetExtension(file),
                    StringComparer.OrdinalIgnoreCase
                ))
                .GroupBy(file =>
                    Path.GetFileName(Path.GetDirectoryName(file))
                )
                .Select(group => new
                {
                    nombreTemporada = group.Key == seriesName
                        ? "Otros"
                        : group.Key,

                    episodios = group
                        .Select(file =>
                        {
                            string name = Path.GetFileNameWithoutExtension(file);
                            string directory = Path.GetDirectoryName(file)!;

                            string? imagePath = downloadThumbnails
                                ? FindImage(directory, name, [".jpg", ".png"])
                                : null;

                            return new
                            {
                                nombre = name,
                                rutaCompleta = file,
                                urlImagen = GetImageUrl(
                                    imagePath,
                                    DefaultEpisodeImage
                                )
                            };
                        })
                        .OrderBy(episode => episode.nombre)
                        .ToList()
                })
                .OrderBy(season => season.nombreTemporada)
                .ToList();

            _logger.LogInformation(
                "Se han encontrado {Count} temporadas en '{Path}'.",
                seasons.Count,
                path
            );

            return Ok(new { temporadas = seasons });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al escanear los episodios de '{Path}'.", path);

            return StatusCode(500, new
            {
                error = "No se han podido escanear los episodios."
            });
        }
    }

    /// <summary>
    /// Devuelve una imagen local de la biblioteca de series.
    /// </summary>
    [HttpGet("image")]
    public IActionResult GetImage([FromQuery] string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return BadRequest(new { error = "La ruta de imagen no es válida." });
        }

        try
        {
            string libraryPath = _configurationService.Get<string>(
                "SeriesLibraryPath"
            );

            string fullPath = Path.GetFullPath(path);
            string rootPath = Path.GetFullPath(libraryPath);

            // Impide acceder a archivos fuera de la biblioteca configurada.
            string relativePath = Path.GetRelativePath(rootPath, fullPath);

            if (Path.IsPathRooted(relativePath) ||
                relativePath == ".." ||
                relativePath.StartsWith($"..{Path.DirectorySeparatorChar}") ||
                relativePath.StartsWith($"..{Path.AltDirectorySeparatorChar}"))
            {
                return Forbid();
            }

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound();
            }

            string extension = Path.GetExtension(fullPath).ToLowerInvariant();

            string? contentType = extension switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".bmp" => "image/bmp",
                _ => null
            };

            if (contentType is null)
            {
                return BadRequest(new
                {
                    error = "El formato de imagen no está permitido."
                });
            }

            return PhysicalFile(fullPath, contentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener la imagen '{Path}'.", path);

            return StatusCode(500, new
            {
                error = "No se ha podido obtener la imagen."
            });
        }
    }

    /// <summary>
    /// Busca una imagen por nombre y extensiones permitidas.
    /// </summary>
    private static string? FindImage(
        string directory,
        string name,
        string[] extensions)
    {
        foreach (string extension in extensions)
        {
            string imagePath = Path.Combine(directory, name + extension);

            if (System.IO.File.Exists(imagePath))
            {
                return imagePath;
            }
        }

        return null;
    }

    /// <summary>
    /// Genera la URL de una imagen o devuelve la imagen predeterminada.
    /// </summary>
    private string GetImageUrl(string? imagePath, string defaultImage)
    {
        if (imagePath is null)
        {
            return defaultImage;
        }

        return Url.Action(
            nameof(GetImage),
            "Series",
            new { path = imagePath }
        ) ?? defaultImage;
    }
}
