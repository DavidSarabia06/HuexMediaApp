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

    /// <summary>Espera cada intervalo y solicita los reintentos hasta el cierre del servidor.</summary>
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
                    // El servicio mantiene las sesiones pendientes y serializa su limpieza.
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
            // Cierre normal del servidor.
        }
    }

    #endregion
}
