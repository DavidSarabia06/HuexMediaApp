# HlsCleanupService

[Visión general](README.md) · [Código fuente](../../codigo/HlsCleanupService.md)

Servicio alojado en segundo plano que solicita a `VideoService` los reintentos de limpieza HLS.

## Construcción

Recibe la instancia compartida de `VideoService` y un `ILogger<HlsCleanupService>`. El servicio de vídeo conserva el registro de procesos y la cola de pendientes.

## Limpieza periódica

### ExecuteAsync

1. Crea un `PeriodicTimer` con un intervalo de 30 segundos.
2. Espera cada intervalo con el token de cierre del servidor.
3. Llama a `RetryPendingCleanupAsync` con ese token.
4. Registra los fallos de un ciclo y continúa esperando el siguiente.
5. Termina al cancelarse el servidor y libera el temporizador.

`RetryPendingCleanupAsync` comprueba la cancelación entre sesiones. Cada `StopHlsAsync` iniciado realiza su detención y sus intentos de borrado antes de devolver el control.
