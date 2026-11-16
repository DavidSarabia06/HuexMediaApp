using HuexMediaApp.Server.Models.Categories;

using HuexMediaApp.Server.Services;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);
const string PublishedUrl = "http://localhost:8081";

AppStoragePaths storagePaths = new AppStoragePaths(builder.Environment);
builder.Services.AddSingleton(storagePaths);
if (!builder.Environment.IsDevelopment())
{
    builder.Configuration.AddJsonFile(storagePaths.SettingsPath, optional: false, reloadOnChange: true);
}

// Registra los servicios de la aplicación.
builder.Services.AddSingleton<ConfigurationService>();
builder.Services.AddSingleton<WindowsFolderSelectionService>();
builder.Services.AddSingleton<SeriesService>();
builder.Services.AddSingleton<MoviesService>();
builder.Services.AddSingleton<JsonFileStoreService>();
builder.Services.AddSingleton<LibraryService>();
builder.Services.AddSingleton<CategoryService>();

builder.Services.AddOptions<HuexMediaApp.Server.Models.Categories.MoviesCategoryOptions>()
    .Bind(builder.Configuration.GetSection("MoviesCategories"))
    .Validate(settings => settings.MaxDepth >= 1,
        "MoviesCategories:MaxDepth debe ser un entero mayor o igual a 1.")
    .ValidateOnStart();
builder.Services.AddOptions<HuexMediaApp.Server.Models.PlaybackProgress.PlaybackProgressOptions>()
    .Bind(builder.Configuration.GetSection("PlaybackProgress"))
    .Validate(settings => double.IsFinite(settings.WatchedThresholdPercent) &&
        settings.WatchedThresholdPercent > 0 && settings.WatchedThresholdPercent <= 100,
        "PlaybackProgress:WatchedThresholdPercent debe ser mayor que 0 y menor o igual a 100.")
    .Validate(settings => double.IsFinite(settings.RemainingSecondsToMarkWatched) &&
        settings.RemainingSecondsToMarkWatched >= 0,
        "PlaybackProgress:RemainingSecondsToMarkWatched debe ser mayor o igual a 0.")
    .ValidateOnStart();
builder.Services.AddSingleton<PlaybackProgressService>();
builder.Services.AddSingleton<VideoService>();
builder.Services.AddHostedService<HlsCleanupService>();
builder.Services.AddControllers();

// Configura la documentación de la API.
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();


if (!builder.Environment.IsDevelopment())
{
    builder.WebHost.UseUrls(PublishedUrl);
}

var app = builder.Build();


// Sirve el cliente React incluido en la carpeta de publicación.
if (!app.Environment.IsDevelopment())
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}
// Habilita Swagger únicamente durante el desarrollo.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseAuthorization();

app.MapControllers();
if (!app.Environment.IsDevelopment())
{
    app.MapFallbackToFile("/index.html");
}


if (!app.Environment.IsDevelopment())
{
    app.Lifetime.ApplicationStarted.Register(() =>
    {
        try
        {
            // Abre el navegador predeterminado en la URL del servidor.
            Process.Start(new ProcessStartInfo
            {
                FileName = PublishedUrl,
                UseShellExecute = true
            });
        }
        catch (Exception exception)
        {
            app.Logger.LogWarning(
                exception,
                "No se pudo abrir el navegador. Abre {Url}.", PublishedUrl);
        }
    });
}

app.Run();
