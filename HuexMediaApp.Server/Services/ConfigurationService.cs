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
    // Estas son las claves que el servicio permite consultar y actualizar.
    // La comprobación se aplica también a llamadas internas y distingue mayúsculas de minúsculas.
    private static readonly HashSet<string> AllowedKeys =
    [
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

    /// <summary>Lee una clave permitida y devuelve su valor como JsonNode o como el tipo solicitado por quien llama.</summary>
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

    /// <summary>Comprueba la clave y el tipo del nuevo valor, lo sustituye en los ajustes y guarda el documento.</summary>
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

        ValidateUpdate(currentValue, value);

        // Un nodo JSON no puede estar dentro de dos objetos a la vez.
        // Copiamos el valor recibido antes de añadirlo al documento de configuración.
        settings[key] = value.DeepClone();
        SaveSettingsRoot(settingsPath, root);
    }

    #endregion

    #region Lectura y escritura

    /// <summary>Busca la clave en los ajustes y devuelve una copia de su nodo; si falta o vale null, comunica el error.</summary>
    private JsonNode GetNode(string key)
    {
        JsonObject settings = LoadSettings();
        return settings[key]?.DeepClone()
            ?? throw new KeyNotFoundException("No se ha encontrado la configuración solicitada.");
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
        // Se espera un documento JSON con la estructura de appsettings.
        // Si falta o no se puede interpretar, la lectura falla antes de modificar los ajustes.
        return JsonNode.Parse(File.ReadAllText(settingsPath))!.AsObject();
    }

    /// <summary>Escribe el documento completo con sangría, conservando sus otras secciones.</summary>
    private static void SaveSettingsRoot(string settingsPath, JsonObject root)
    {
        // Guardamos el documento completo, incluida cualquier otra sección que contenga.
        // La sangría facilita leer y editar el archivo después.
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

    /// <summary>Exige una clave existente y un tipo compatible.</summary>
    private static void ValidateUpdate(JsonNode? currentValue, JsonNode newValue)
    {
        // La actualización necesita un valor previo para comprobar que el nuevo tiene el mismo tipo.
        if (currentValue is null)
        {
            throw new KeyNotFoundException("No se ha encontrado la configuración solicitada.");
        }

        // Comprobamos la familia de tipos JSON: un booleano true no puede sustituirse
        // por la cadena de texto "true", aunque visualmente se parezcan.
        if (!IsValidValue(currentValue, newValue))
        {
            throw new ArgumentException("El tipo de dato no es válido.");
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
