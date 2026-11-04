// ---------------------------- Tipos de subtítulos ----------------------------

export interface SubtitleCue {
    /** Inicio de la intervención en segundos. */
    start: number;
    /** Fin de la intervención en segundos. */
    end: number;
    /** Texto plano que se presenta en pantalla. */
    text: string;
}

export interface MediaTrack {
    /** Índice de la pista dentro del archivo de vídeo. */
    index: number;
    /** Código de idioma; und representa un idioma sin determinar. */
    language: string;
    /** Título declarado en la pista; puede ser una cadena vacía. */
    title: string;
    /** Códec de audio o subtítulos. */
    codec: string;
    /** Indica si es la pista predeterminada. */
    isDefault: boolean;
    /** Indica si la pista está marcada como forzada. */
    isForced: boolean;
    /** Indica si la pista es compatible con la reproducción o extracción. */
    isSupported: boolean;
}

// --------------------------- Conversión de tiempos ---------------------------

/**
 * Convierte una marca minutos:segundos u horas:minutos:segundos a segundos numéricos.
 * @param value Marca temporal minutos:segundos u horas:minutos:segundos.
 * @returns Tiempo en segundos, o NaN si las partes no forman una marca admitida.
 */
function timestamp(value: string): number {
    const parts = value.split(':').map(Number);
    if (parts.length < 2 || parts.length > 3 || parts.some(part => !Number.isFinite(part))) {
        return NaN;
    }
    // Cada nueva parte desplaza la anterior una unidad de base 60: horas, minutos y segundos.
    return parts.reduce((seconds, part) => seconds * 60 + part, 0);
}

// --------------------------- Lectura de subtítulos ---------------------------

/**
 * Convierte el WebVTT de FFmpeg en intervenciones con inicio, fin y texto plano.
 * @param vtt Contenido completo del archivo WebVTT recibido del servidor.
 * @returns Intervenciones válidas con inicio, fin y texto plano.
 */
export function parseSubtitles(vtt: string): SubtitleCue[] {
    /**
     * Lee un bloque de intervención y descarta cabeceras o intervalos no válidos.
     * @param block Bloque de texto separado por líneas vacías dentro del WebVTT.
     * @returns Array con una intervención válida o vacío si el bloque se descarta.
     */
    function parseBlock(block: string): SubtitleCue[] {
        const lines = block.trim().split('\n');
        if (/^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/.test(lines[0])) {
            return [];
        }
        // Busca el intervalo aunque el bloque incluya antes un identificador de intervención.
        const timingIndex = lines.findIndex(line => line.includes(' --> '));
        if (timingIndex < 0) {
            return [];
        }
        const match = lines[timingIndex].match(/^(\S+)\s+-->\s+(\S+)/);
        if (!match) {
            return [];
        }
        const start = timestamp(match[1]);
        const end = timestamp(match[2]);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
            return [];
        }
        // Reúne las líneas del texto, retira las etiquetas y convierte las entidades reconocidas.
        const text = lines.slice(timingIndex + 1).join('\n').replace(/<[^>]*>/g, '')
            .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, entity: string) => ({
                amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
            } as Record<string, string>)[entity]);
        return [{ start, end, text }];
    }

    // Normaliza el archivo, separa sus bloques y reúne los arrays válidos con flatMap.
    return vtt.replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n\s*\n/).flatMap(parseBlock);
}

// ------------------------- Texto activo en pantalla --------------------------

/**
 * Reúne las intervenciones cuyo intervalo contiene el tiempo recibido, incluido el inicio y excluido el fin.
 * @param cues Intervenciones obtenidas mediante parseSubtitles.
 * @param time Tiempo del vídeo en segundos utilizado para seleccionar el texto.
 * @returns Textos activos unidos por saltos de línea; cadena vacía si no hay coincidencias.
 */
export function subtitleAt(cues: SubtitleCue[], time: number): string {
    return cues.filter(cue => time >= cue.start && time < cue.end).map(cue => cue.text).join('\n');
}

// ---------------------------- Etiquetas de pistas ----------------------------

/**
 * Construye la etiqueta de una pista con su número, idioma, título y marca de forzados.
 * @param track Datos de la pista de audio o subtítulos recibidos del servidor.
 * @param position Posición de la pista en el selector, empezando en cero.
 * @returns Etiqueta con número visible, idioma, título opcional y marca de forzados.
 */
export function trackLabel(track: MediaTrack, position: number): string {
    const languages: Record<string, string> = {
        spa: 'Español', es: 'Español',
        eng: 'Inglés', en: 'Inglés',
        fra: 'Francés', fre: 'Francés', fr: 'Francés',
        deu: 'Alemán', ger: 'Alemán', de: 'Alemán',
        ita: 'Italiano', it: 'Italiano',
        por: 'Portugués', pt: 'Portugués',
        jpn: 'Japonés', ja: 'Japonés',
        cat: 'Catalán', ca: 'Catalán',
        eus: 'Euskera', baq: 'Euskera',
        glg: 'Gallego'
    };
    // Presenta el nombre del idioma conocido, conserva otros códigos y traduce und a Sin idioma.
    const language = languages[track.language] || (track.language !== 'und' ? track.language : 'Sin idioma');
    return `${position + 1}. ${language}${track.title ? ` · ${track.title}` : ''}${track.isForced ? ' · Forzados' : ''}`;
}
