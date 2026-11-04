using System.Text.Json;
using System.Text.Json.Nodes;

namespace HuexMediaApp.Server.Services;

/// <summary>Decide qué archivos de configuración y datos utiliza la aplicación según el entorno.</summary>
public sealed class AppStoragePaths
{
    /// <summary>Ruta del appsettings.json que se lee y modifica en esta ejecución.</summary>
    public string SettingsPath { get; }
    /// <summary>Carpeta que contiene los JSON de organización y progreso.</summary>
    public string DataDirectory { get; }

    #region Construcción

    /// <summary>Utiliza la carpeta del proyecto en desarrollo y la carpeta del usuario en la aplicación publicada.</summary>
    public AppStoragePaths(IHostEnvironment environment)
    {
        string storageRoot = environment.ContentRootPath;

        // Al publicar, guardamos los datos en LocalApplicationData del usuario.
        // Esa carpeta permite escribir los ajustes aunque la aplicación esté instalada en Archivos de programa.
        if (!environment.IsDevelopment())
        {
            storageRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "HuexMediaApp");
        }

        SettingsPath = Path.Combine(storageRoot, "appsettings.json");
        DataDirectory = Path.Combine(storageRoot, "App_Data");

        if (!environment.IsDevelopment())
        {
            InitializeSettings(environment.ContentRootPath);
        }
    }

    #endregion

    #region Inicialización

    /// <summary>Crea los ajustes del usuario copiando la plantilla publicada cuando todavía no tiene su propio archivo.</summary>
    private void InitializeSettings(string contentRoot)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(SettingsPath)!);
        if (File.Exists(SettingsPath))
        {
            return;
        }

        string templatePath = Path.Combine(contentRoot, "appsettings.json");
        JsonObject settings = JsonNode.Parse(File.ReadAllText(templatePath))!.AsObject();

        string contents = settings.ToJsonString(new JsonSerializerOptions { WriteIndented = true });

        FileStream file;
        try
        {
            file = new FileStream(SettingsPath, FileMode.CreateNew, FileAccess.Write);
        }
        catch (IOException) when (File.Exists(SettingsPath))
        {
            // Otra ejecución puede haber creado el archivo después de nuestra comprobación inicial.
            // Conservamos ese archivo en lugar de sobrescribir sus ajustes.
            return;
        }

        using (file)
        using (StreamWriter writer = new StreamWriter(file))
        {
            writer.Write(contents);
        }
    }

    #endregion
}
