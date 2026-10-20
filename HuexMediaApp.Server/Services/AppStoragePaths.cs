using System.Text.Json;
using System.Text.Json.Nodes;

namespace HuexMediaApp.Server.Services;

public sealed class AppStoragePaths
{
    public string SettingsPath { get; }
    public string DataDirectory { get; }

    #region Construcción

    public AppStoragePaths(IHostEnvironment environment)
    {
        string storageRoot = environment.ContentRootPath;

        // En producción los datos se guardan fuera de Archivos de programa.
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

    private void InitializeSettings(string contentRoot)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(SettingsPath)!);
        if (File.Exists(SettingsPath))
        {
            return;
        }

        string templatePath = Path.Combine(contentRoot, "appsettings.json");
        JsonObject settings = JsonNode.Parse(File.ReadAllText(templatePath))!.AsObject();

        // La biblioteca se elige en el ordenador donde se instala.
        settings["HuexMediaAppSettings"]!["SeriesLibraryPath"] = "";
        string contents = settings.ToJsonString(new JsonSerializerOptions { WriteIndented = true });

        FileStream file;
        try
        {
            file = new FileStream(SettingsPath, FileMode.CreateNew, FileAccess.Write);
        }
        catch (IOException) when (File.Exists(SettingsPath))
        {
            // Otro arranque ya ha creado el archivo.
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
