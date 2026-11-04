using System.Security;
using HuexMediaApp.Server.Models.Libraries;

namespace HuexMediaApp.Server.Services;

/// <summary>Reúne en memoria las rutas disponibles para que los servicios limpien sus referencias guardadas.</summary>
internal sealed class LibraryContentSnapshot
{
    #region Datos del recorrido

    // Son los mismos formatos de vídeo que reconocen los exploradores de Series y Películas.
    private static readonly string[] VideoExtensions = [".mp4", ".mkv", ".avi"];

    // Elementos que pueden asignarse a categorías: carpetas de series o archivos de películas.
    // HashSet evita duplicados y permite comprobar rápidamente si una ruta está incluida.
    // OrdinalIgnoreCase compara sin distinguir mayúsculas, como las rutas habituales de Windows.
    private readonly HashSet<string> _items = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    // Vídeos que pueden tener progreso: episodios de series o archivos de películas.
    private readonly HashSet<string> _videos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    #endregion

    #region Lectura del contenido

    /// <summary>Completa el recorrido solicitado y devuelve sus rutas; devuelve null si falla el acceso.</summary>
    /// <param name="library">Biblioteca que aporta el tipo de contenido y la carpeta raíz.</param>
    /// <param name="cancellationToken">Permite interrumpir la operación al cancelar la carga.</param>
    /// <param name="includeEpisodes">En Series, activa la búsqueda recursiva de episodios además de sus carpetas.</param>
    public static LibraryContentSnapshot? TryRead(MediaLibrary library, CancellationToken cancellationToken,
        bool includeEpisodes = true)
    {
        // Cada llamada construye sus propios conjuntos y los va rellenando durante el recorrido.
        LibraryContentSnapshot snapshot = new LibraryContentSnapshot();
        try
        {
            // La cancelación se propaga al servicio que ha solicitado el barrido.
            cancellationToken.ThrowIfCancellationRequested();
            if (library.MediaType == MediaType.Series)
            {
                // Cada carpeta hija directa representa una serie. Sus temporadas quedan dentro de ella.
                foreach (string directory in Directory.EnumerateDirectories(library.LibraryPath))
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    snapshot._items.Add(NormalizePath(directory));
                }
            }

            // Películas siempre necesita sus archivos. Series busca episodios cuando va a limpiar progreso;
            // para limpiar únicamente asignaciones de categorías, le basta con las carpetas anteriores.
            if (library.MediaType == MediaType.Movies || includeEpisodes)
            {
                // AllDirectories entra en todos los niveles: temporadas de series o subcarpetas de películas.
                foreach (string file in Directory.EnumerateFiles(library.LibraryPath, "*", SearchOption.AllDirectories))
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    // Conserva únicamente las extensiones de vídeo admitidas, sin distinguir mayúsculas.
                    if (VideoExtensions.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase))
                    {
                        string path = NormalizePath(file);
                        snapshot._videos.Add(path);
                        if (library.MediaType == MediaType.Movies)
                        {
                            // Una película es a la vez un vídeo con progreso y un elemento de categoría.
                            snapshot._items.Add(path);
                        }
                    }
                }
            }

            // El resultado se entrega después de completar el recorrido, para poder comparar con él los JSON.
            return snapshot;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or SecurityException)
        {
            // Una raíz desconectada o un recorrido sin permisos no demuestran que sus archivos se hayan borrado.
            // null indica al servicio que debe conservar las referencias; se descarta cualquier resultado parcial.
            return null;
        }
    }

    #endregion

    #region Consultas de referencias

    /// <summary>Comprueba una carpeta de serie o un archivo de película en el resultado completo.</summary>
    public bool ContainsItem(string path)
    {
        // LibraryService lo utiliza para revisar las rutas asignadas a categorías y subcategorías.
        return _items.Contains(NormalizePath(path));
    }

    /// <summary>Comprueba una película o episodio en el conjunto de vídeos encontrados.</summary>
    public bool ContainsVideo(string path)
    {
        // PlaybackProgressService lo utiliza para revisar vídeos vistos y posiciones guardadas.
        return _videos.Contains(NormalizePath(path));
    }

    #endregion

    #region Normalización de rutas

    /// <summary>Comprueba que la ruta sea absoluta y la prepara con el mismo formato usado en los conjuntos.</summary>
    private static string NormalizePath(string path)
    {
        // Una referencia vacía o relativa es un error de formato del documento guardado.
        if (string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path))
        {
            throw new InvalidDataException("Una referencia guardada no contiene una ruta absoluta válida.");
        }

        // Resuelve la ruta completa y quita el separador final redundante antes de guardarla o consultarla.
        return Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
    }

    #endregion
}
