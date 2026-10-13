
using HuexMediaApp.Server.Services;

var builder = WebApplication.CreateBuilder(args);

// Registra los servicios de la aplicación.
builder.Services.AddSingleton<ConfigurationService>();
builder.Services.AddSingleton<VideoService>();
builder.Services.AddHostedService<HlsCleanupService>();
builder.Services.AddControllers();

// Configura la documentación de la API.
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configura los archivos estáticos de React.
app.UseDefaultFiles();
app.MapStaticAssets();

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
app.MapFallbackToFile("/index.html");

app.Run();
