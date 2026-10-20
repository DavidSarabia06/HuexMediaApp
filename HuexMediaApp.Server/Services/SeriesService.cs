using System.Runtime.ExceptionServices;
using System.Runtime.InteropServices;
using System.Security;
using System.Windows.Forms;
using HuexMediaApp.Server.Models;

namespace HuexMediaApp.Server.Services;

/// <summary>Selecciona y explora carpetas locales y valida las imágenes de la biblioteca.</summary>
public sealed class SeriesService
{
    private const string DefaultSeriesImage = "/default-episode-vertical.png";
    private const string DefaultEpisodeImage = "/default-episode-horizontal.png";
    private static readonly string[] VideoExtensions = [".mp4", ".mkv", ".avi"];
    private static readonly string[] PosterExtensions = [".jpg", ".png", ".bmp"];
    private static readonly string[] ThumbnailExtensions = [".jpg", ".png"];
    private readonly ConfigurationService _configurationService;
    private readonly ILogger<SeriesService> _logger;

    #region Construcción

    public SeriesService(ConfigurationService configurationService, ILogger<SeriesService> logger)
    {
        _configurationService = configurationService;
        _logger = logger;
    }

    #endregion

    #region Selección de carpeta

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(IntPtr windowHandle);

    private sealed class WindowOwner : IWin32Window
    {
        public IntPtr Handle { get; }

        public WindowOwner(IntPtr handle)
        {
            Handle = handle;
        }
    }

    /// <summary>Abre el selector en el equipo del servidor; cancelar devuelve una ruta vacía.</summary>
    public SeriesFolderSelection SelectFolder()
    {
        string selectedPath = string.Empty;
        Exception? dialogError = null;
        IntPtr foregroundWindow = GetForegroundWindow();

        // Se captura la ventana activa antes de iniciar el hilo del selector.
        Thread thread = new Thread(() =>
        {
            try
            {
                using FolderBrowserDialog dialog = new FolderBrowserDialog
                {
                    Description = "Selecciona la carpeta raíz de las series",
                    UseDescriptionForTitle = true,
                    ShowNewFolderButton = false
                };

                DialogResult result;
                if (foregroundWindow != IntPtr.Zero && IsWindow(foregroundWindow))
                {
                    WindowOwner owner = new WindowOwner(foregroundWindow);
                    //_logger.LogInformation("Abriendo selector de carpeta asociado a la ventana activa: {OwnerHandle}.",
                    //owner.Handle);
                    result = dialog.ShowDialog(owner);
                }
                else
                {
                    _logger.LogWarning("No hay una ventana activa válida para asociar el selector de carpeta.");
                    result = dialog.ShowDialog();
                }

                if (result == DialogResult.OK)
                {
                    selectedPath = dialog.SelectedPath;
                }

                //_logger.LogInformation("Selector de carpeta cerrado. Selección confirmada: {Selected}.",
                 //   result == DialogResult.OK);
            }
            catch (Exception ex)
            {
                dialogError = ex;
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (dialogError is not null)
        {
            ExceptionDispatchInfo.Capture(dialogError).Throw();
        }

        return new SeriesFolderSelection { Ruta = selectedPath };
    }

    #endregion

    #region Exploración de la biblioteca

    /// <summary>Obtiene las carpetas hijas como series, sin explorar sus episodios.</summary>
    public List<SeriesMediaItem> ScanSeries(string path)
    {
        ValidateDirectory(path, "La ruta de series no es válida o no existe.");
        bool usePosters = _configurationService.Get<bool>("DownloadSeriesPosters");
        List<SeriesMediaItem> series = new List<SeriesMediaItem>();

        foreach (string directory in Directory.GetDirectories(path))
        {
            string? imagePath = usePosters ? FindImage(directory, "icono", PosterExtensions) : null;
            series.Add(new SeriesMediaItem
            {
                Nombre = Path.GetFileName(directory),
                RutaCompleta = directory,
                UrlImagen = DefaultSeriesImage,
                ImagePath = imagePath
            });
        }

        _logger.LogInformation("Se han encontrado {Count} series en '{Path}'.", series.Count, path);
        return series;
    }

    /// <summary>Explora vídeos recursivamente y los agrupa por el nombre de su carpeta.</summary>
    public SeriesEpisodesResponse ScanEpisodes(string path)
    {
        ValidateDirectory(path, "La ruta de la serie no es válida o no existe.");
        bool useThumbnails = _configurationService.Get<bool>("DownloadEpisodeThumbnails");
        string seriesName = Path.GetFileName(Path.TrimEndingDirectorySeparator(path));

        // Se conserva la agrupación por nombre de carpeta, no por ruta completa.

        IEnumerable<IGrouping<string?, string>> groups = Directory
            .EnumerateFiles(path, "*", SearchOption.AllDirectories)
            .Where(IsVideoFile)
            .GroupBy(file => Path.GetFileName(Path.GetDirectoryName(file)));
        List<SeriesSeason> seasons = new List<SeriesSeason>();

        foreach (IGrouping<string?, string> group in groups)
        {
            List<SeriesMediaItem> episodes = new List<SeriesMediaItem>();
            foreach (string file in group)
            {
                episodes.Add(CreateEpisode(file, useThumbnails));
            }

            seasons.Add(new SeriesSeason
            {
                NombreTemporada = group.Key == seriesName ? "Otros" : group.Key!,
                Episodios = episodes.OrderBy(episode => episode.Nombre).ToList()
            });
        }

        List<SeriesSeason> orderedSeasons = seasons.OrderBy(season => season.NombreTemporada).ToList();
        _logger.LogInformation("Se han encontrado {Count} temporadas en '{Path}'.", orderedSeasons.Count, path);
        return new SeriesEpisodesResponse { Temporadas = orderedSeasons };
    }

    /// <summary>Construye un episodio y localiza su miniatura si la opción está activada.</summary>
    private static SeriesMediaItem CreateEpisode(string file, bool useThumbnails)
    {
        string name = Path.GetFileNameWithoutExtension(file);
        string directory = Path.GetDirectoryName(file)!;
        string? imagePath = useThumbnails ? FindImage(directory, name, ThumbnailExtensions) : null;
        return new SeriesMediaItem
        {
            Nombre = name,
            RutaCompleta = file,
            UrlImagen = DefaultEpisodeImage,
            ImagePath = imagePath
        };
    }

    #endregion

    #region Imágenes locales

    /// <summary>Valida ubicación y formato; devuelve null si el archivo de imagen no existe.</summary>
    public SeriesImageFile? GetImage(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            throw new ArgumentException("La ruta de imagen no es válida.");
        }

        string libraryPath = _configurationService.Get<string>("SeriesLibraryPath");
        string fullPath = Path.GetFullPath(path);
        string rootPath = Path.GetFullPath(libraryPath);
        ValidateImageLocation(rootPath, fullPath);

        if (!File.Exists(fullPath))
        {
            return null;
        }

        return new SeriesImageFile { FullPath = fullPath, ContentType = GetImageContentType(fullPath) };
    }

    /// <summary>Devuelve la primera imagen existente según el orden de extensiones indicado.</summary>
    private static string? FindImage(string directory, string name, string[] extensions)
    {
        foreach (string extension in extensions)
        {
            string imagePath = Path.Combine(directory, name + extension);
            if (File.Exists(imagePath))
            {
                return imagePath;
            }
        }

        return null;
    }

    /// <summary>Resuelve el MIME de los formatos que permite servir la biblioteca.</summary>
    private static string GetImageContentType(string fullPath)
    {
        string extension = Path.GetExtension(fullPath).ToLowerInvariant();
        switch (extension)
        {
            case ".jpg":
            case ".jpeg":
                return "image/jpeg";
            case ".png":
                return "image/png";
            case ".bmp":
                return "image/bmp";
            default:
                throw new ArgumentException("El formato de imagen no está permitido.");
        }
    }

    #endregion

    #region Validación

    /// <summary>Comprueba que la ruta de exploración no esté vacía y sea una carpeta existente.</summary>
    private static void ValidateDirectory(string path, string errorMessage)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
        {
            throw new ArgumentException(errorMessage);
        }
    }

    /// <summary>Comprueba la extensión sin distinguir mayúsculas.</summary>
    private static bool IsVideoFile(string file)
    {
        return VideoExtensions.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>Rechaza rutas fuera de la biblioteca, incluidas otras unidades y recorridos con ..</summary>
    private static void ValidateImageLocation(string rootPath, string fullPath)
    {
        string relativePath = Path.GetRelativePath(rootPath, fullPath);
        if (Path.IsPathRooted(relativePath) || relativePath == ".." ||
            relativePath.StartsWith($"..{Path.DirectorySeparatorChar}") ||
            relativePath.StartsWith($"..{Path.AltDirectorySeparatorChar}"))
        {
            throw new SecurityException("La imagen no pertenece a la biblioteca configurada.");
        }
    }

    #endregion
}
