namespace HuexMediaApp.Server.Services;

public sealed class HlsCleanupService : BackgroundService
{
    private readonly VideoService _videoService;
    private readonly ILogger<HlsCleanupService> _logger;

    public HlsCleanupService(
        VideoService videoService,
        ILogger<HlsCleanupService> logger)
    {
        _videoService = videoService;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(
            TimeSpan.FromSeconds(30)
        );

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
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
}
