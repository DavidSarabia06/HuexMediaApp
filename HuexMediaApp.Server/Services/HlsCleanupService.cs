namespace HuexMediaApp.Server.Services;

/// <summary>Reintenta cada 30 segundos las detenciones y limpiezas HLS que quedaron pendientes.</summary>
public sealed class HlsCleanupService : BackgroundService
{
    private readonly VideoService _videoService;
    private readonly ILogger<HlsCleanupService> _logger;

    #region Construcción

    /// <summary>Recibe el servicio compartido de sesiones y el registro de la tarea de fondo.</summary>
    public HlsCleanupService(
        VideoService videoService,
        ILogger<HlsCleanupService> logger)
    {
        _videoService = videoService;
        _logger = logger;
    }

    #endregion

    #region Limpieza periódica

    /// <summary>Cada 30 segundos pide al servicio de vídeo que reintente detener sesiones y borrar sus temporales pendientes.</summary>
    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        using PeriodicTimer timer = new PeriodicTimer(
            TimeSpan.FromSeconds(30)
        );

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    // VideoService recuerda qué sesiones quedaron pendientes y coordina sus reintentos.
                    // Este temporizador solo le pide que vuelva a intentarlo en cada intervalo.
                    await _videoService.RetryPendingCleanupAsync(
                        stoppingToken
                    );
                }
                catch (OperationCanceledException)
                    when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Error al recuperar las limpiezas HLS pendientes."
                    );
                }
            }
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
            // Al cerrar el servidor se cancela la espera del temporizador.
            // Esa cancelación termina la tarea de fondo de forma normal.
        }
    }

    #endregion
}
