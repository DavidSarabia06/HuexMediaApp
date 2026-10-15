
using HuexMediaApp.Server.Services;

var builder = WebApplication.CreateBuilder(args);

// Registra los servicios de la aplicación.
builder.Services.AddSingleton<ConfigurationService>();
builder.Services.AddSingleton<SeriesCategoryService>();
builder.Services.AddOptions<HuexMediaApp.Server.Models.PlaybackProgressOptions>()
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

var app = builder.Build();

// En desarrollo React se sirve desde Vite; al publicar, desde wwwroot.
if (!app.Environment.IsDevelopment())
{
    app.UseDefaultFiles();
    app.MapStaticAssets();
}

// Habilita Swagger únicamente durante el desarrollo.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();

app.MapControllers();
if (!app.Environment.IsDevelopment())
{
    app.MapFallbackToFile("/index.html");
}

app.Run();
