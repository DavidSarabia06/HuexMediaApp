// ------------------------------ Respuestas HTTP ------------------------------

/**
 * Lee la respuesta de una petición y convierte los fallos en errores para la página.
 * @param response Respuesta recibida mediante fetch.
 * @returns Promesa con el contenido JSON recibido cuando la respuesta es correcta.
 */
export async function readJson<T = unknown>(response: Response): Promise<T> {

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || body === null) {
        const failure = body as { error?: string; message?: string } | null;
        throw new Error(failure?.error ?? failure?.message ?? 'No se ha podido cargar la biblioteca.');
    }
    return body as T;
}

// --------------------------- Comparación de rutas ----------------------------

/**
 * Prepara una ruta para compararla con otras referencias guardadas o escaneadas.
 * @param path Ruta original de una biblioteca, serie, película o episodio.
 * @returns Ruta con barras invertidas, sin separadores finales y en mayúsculas.
 */
export function normalizePathForComparison(path: string): string {
    return path.replaceAll('/', '\\').replace(/\\+$/, '').toUpperCase();
}

// ---------------------------- Formato de tiempos -----------------------------

/**
 * Presenta segundos como minutos:segundos o como horas:minutos:segundos.
 * @param seconds Tiempo recibido del reproductor o del progreso guardado.
 * @returns Tiempo legible; por ejemplo, 75 produce "1:15" y 3675 produce "1:01:15".
 */
export function formatProgressTime(seconds: number): string {

    const total = Number.isFinite(seconds) ? Math.floor(Math.max(0, seconds)) : 0;
    const hours = Math.floor(total / 3600);

    const minutes = Math.floor(total / 60) % 60;
    const rest = String(total % 60).padStart(2, '0');

    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/** Obtiene el mensaje de una excepción capturada. */
export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
