
using System.Text.Json;
using System.Text.Json.Nodes;

namespace HuexMediaApp.Server.Services;

public class ConfigurationService
{
    private const string SectionName = "HuexMediaAppSettings";

    private readonly IHostEnvironment _environment;

    public ConfigurationService(IHostEnvironment environment)
    {
        _environment = environment;
    }

    // Obtiene una configuración con el tipo solicitado.
    public T Get<T>(string key)
    {
        JsonNode value = GetNode(key);

        if (typeof(T) == typeof(JsonNode))
        {
            return (T)(object)value;
        }

        return value.GetValue<T>();
    }

    // Obtiene el nodo JSON conservando su tipo original.
    private JsonNode GetNode(string key)
    {
        JsonObject settings = LoadSettings();

        return settings[key]?.DeepClone()
            ?? throw new KeyNotFoundException(
                $"No se ha encontrado la configuración '{key}'."
            );
    }

    // Actualiza una configuración existente.
    public void Update(string key, JsonNode value)
    {
        string settingsPath = GetSettingsPath();

        JsonObject root = JsonNode.Parse(
            File.ReadAllText(settingsPath)
        )!.AsObject();

        JsonObject settings = root[SectionName]!.AsObject();

        JsonNode? currentValue = settings[key];

        if (currentValue is null)
        {
            throw new KeyNotFoundException(
                $"No se ha encontrado la configuración '{key}'."
            );
        }

        // Comprueba que el nuevo valor tenga un tipo compatible.
        if (!IsValidValue(currentValue, value))
        {
            throw new ArgumentException(
                "El tipo de dato no es válido."
            );
        }

        // Comprueba que la carpeta exista cuando se modifica la ruta de series.
        if (key == "SeriesLibraryPath" &&
            !Directory.Exists(value.GetValue<string>()))
        {
            throw new ArgumentException(
                "La carpeta de series no existe."
            );
        }

        // Actualiza la propiedad y guarda el archivo.
        settings[key] = value.DeepClone();

        File.WriteAllText(
            settingsPath,
            root.ToJsonString(new JsonSerializerOptions
            {
                WriteIndented = true
            })
        );
    }

    // Obtiene la sección de configuración.
    private JsonObject LoadSettings()
    {
        JsonObject root = JsonNode.Parse(
            File.ReadAllText(GetSettingsPath())
        )!.AsObject();

        return root[SectionName]!.AsObject();
    }

    // Obtiene la ruta del archivo appsettings.json.
    private string GetSettingsPath()
    {
        return Path.Combine(
            _environment.ContentRootPath,
            "appsettings.json"
        );
    }

    // Comprueba que los tipos de datos sean compatibles.
    private static bool IsValidValue(JsonNode currentValue, JsonNode newValue)
    {
        return currentValue.GetValueKind() switch
        {
            JsonValueKind.String =>
                newValue.GetValueKind() == JsonValueKind.String,

            JsonValueKind.True or JsonValueKind.False =>
                newValue.GetValueKind() is JsonValueKind.True or JsonValueKind.False,

            JsonValueKind.Number =>
                newValue.GetValueKind() == JsonValueKind.Number,

            _ => false
        };
    }
}
