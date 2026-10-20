using System.Text.Json;
using System.Text.Json.Nodes;

namespace HuexMediaApp.Server.Services;

/// <summary>
/// Lee y modifica los valores de HuexMediaAppSettings en appsettings.json.
/// Centraliza las claves permitidas y sus reglas.
/// </summary>
public class ConfigurationService
{
    private const string SectionName = "HuexMediaAppSettings";
    // Se aplica a todos los consumidores, no solo a las solicitudes HTTP.
    // Los nombres deben coincidir exactamente, incluidas sus mayúsculas.
    private static readonly HashSet<string> AllowedKeys =
    [
        "SeriesLibraryPath",
        "MoviesLibraryPath",
        "DownloadSeriesPosters",
        "DownloadMoviePosters",
        "DownloadEpisodeThumbnails"
    ];
    private readonly AppStoragePaths _storagePaths;

    #region Construcción

    public ConfigurationService(AppStoragePaths storagePaths)
    {
        _storagePaths = storagePaths;
    }

    #endregion

    #region Operaciones públicas

    /// <summary>Obtiene una clave conservando el JSON o convirtiéndolo al tipo solicitado.</summary>
    public T Get<T>(string key)
    {
        ValidateKey(key);
        JsonNode value = GetNode(key);
        if (typeof(T) == typeof(JsonNode))
        {
            return (T)(object)value;
        }

        return value.GetValue<T>();
    }

    /// <summary>Actualiza una clave existente sin cambiar su tipo JSON ni las otras secciones.</summary>
    public void Update(string key, JsonNode? value)
    {
        ValidateKey(key);
        // También protege a consumidores internos que no pasan por el controlador.
        if (value is null)
        {
            throw new ArgumentException("La clave o el valor de configuración no es válido.");
        }

        string settingsPath = GetSettingsPath();
        JsonObject root = ReadSettingsRoot(settingsPath);
        JsonObject settings = root[SectionName]!.AsObject();
        JsonNode? currentValue = settings[key];

        ValidateUpdate(key, currentValue, value);

        // Un JsonNode solo puede pertenecer a un padre: se inserta una copia
        // para no modificar ni reutilizar el nodo recibido por el controlador.
        settings[key] = value.DeepClone();
        SaveSettingsRoot(settingsPath, root);
    }

    #endregion

    #region Lectura y escritura

    /// <summary>Devuelve una copia de la clave; una clave ausente o con valor null se rechaza.</summary>
    private JsonNode GetNode(string key)
    {
        JsonObject settings = LoadSettings();
        return settings[key]?.DeepClone()
            ?? throw new KeyNotFoundException($"No se ha encontrado la configuración '{key}'.");
    }

    /// <summary>Lee el archivo y selecciona el objeto HuexMediaAppSettings.</summary>
    private JsonObject LoadSettings()
    {
        string settingsPath = GetSettingsPath();
        JsonObject root = ReadSettingsRoot(settingsPath);
        return root[SectionName]!.AsObject();
    }

    /// <summary>Lee y convierte el documento completo a un objeto JSON.</summary>
    private static JsonObject ReadSettingsRoot(string settingsPath)
    {
        // Un archivo ausente, dañado o con estructura distinta provoca un error.
        // No se crea ni se sustituye por una configuración vacía.
        return JsonNode.Parse(File.ReadAllText(settingsPath))!.AsObject();
    }

    /// <summary>Escribe el documento completo con sangría, conservando sus otras secciones.</summary>
    private static void SaveSettingsRoot(string settingsPath, JsonObject root)
    {
        // Conserva la escritura directa que utiliza este sistema: no usa un temporal
        // ni un bloqueo para coordinar actualizaciones simultáneas.
        File.WriteAllText(settingsPath, root.ToJsonString(new JsonSerializerOptions
        {
            WriteIndented = true
        }));
    }

    /// <summary>Obtiene la ruta de la configuración activa.</summary>
    private string GetSettingsPath()
    {
        return _storagePaths.SettingsPath;
    }

    #endregion

    #region Validación

    /// <summary>Rechaza claves vacías o no permitidas antes de acceder al archivo.</summary>
    private static void ValidateKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || !AllowedKeys.Contains(key))
        {
            throw new ArgumentException("La clave de configuración no es válida.");
        }
    }

    /// <summary>Exige una clave existente, un tipo compatible y, para series, una carpeta existente.</summary>
    private static void ValidateUpdate(string key, JsonNode? currentValue, JsonNode newValue)
    {
        // No permite añadir claves ni sustituir una clave cuyo valor almacenado sea null.
        if (currentValue is null)
        {
            throw new KeyNotFoundException($"No se ha encontrado la configuración '{key}'.");
        }

        // Compara tipos JSON: por ejemplo, true no puede sustituirse por el texto "true".
        if (!IsValidValue(currentValue, newValue))
        {
            throw new ArgumentException("El tipo de dato no es válido.");
        }

        // Esta regla adicional solo corresponde a la ubicación de la biblioteca de series.
        if (key == "SeriesLibraryPath" && !Directory.Exists(newValue.GetValue<string>()))
        {
            throw new ArgumentException("La carpeta de series no existe.");
        }
    }

    /// <summary>Admite texto, booleanos o números si el nuevo valor conserva la misma familia JSON.</summary>
    private static bool IsValidValue(JsonNode currentValue, JsonNode newValue)
    {
        JsonValueKind currentKind = currentValue.GetValueKind();
        JsonValueKind newKind = newValue.GetValueKind();

        switch (currentKind)
        {
            case JsonValueKind.String:
                return newKind == JsonValueKind.String;
            case JsonValueKind.True:
            case JsonValueKind.False:
                return newKind == JsonValueKind.True || newKind == JsonValueKind.False;
            case JsonValueKind.Number:
                return newKind == JsonValueKind.Number;
            default:
                return false;
        }
    }

    #endregion
}
