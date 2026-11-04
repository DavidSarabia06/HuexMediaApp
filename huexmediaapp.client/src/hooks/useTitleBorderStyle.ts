import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

// ----------------------------- Tipos de preferencia ---------------------------

export type TitleBorderStyle = 'smooth' | 'animated';

const STORAGE_KEY = 'huex:title-border-style';
const DURATION_KEY = 'huex:title-border-duration';
const LINE_COUNT_KEY = 'huex:title-border-line-count';
const LINE_LENGTH_KEY = 'huex:title-border-line-length';

/** Recupera el estilo elegido; conserva la versión animada como valor inicial. */
function readBorderStyle(): TitleBorderStyle {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'smooth' ? 'smooth' : 'animated';
    } catch {
        return 'animated';
    }
}

/** Lee un entero dentro del intervalo permitido o utiliza el valor predeterminado. */
function readNumber(key: string, defaultValue: number, minimum: number, maximum: number): number {
    try {
        const stored = window.localStorage.getItem(key);
        const value = stored === null ? defaultValue : Number(stored);
        return Number.isInteger(value) && value >= minimum && value <= maximum ? value : defaultValue;
    } catch {
        return defaultValue;
    }
}

// --------------------------- Preferencia de los bordes ------------------------

/**
 * Conserva el estilo compartido por Configuración y los títulos de la aplicación.
 * @returns Estilo, duración, número y longitud de líneas, funciones de cambio y variables CSS.
 */
export default function useTitleBorderStyle() {
    const [borderStyle, setBorderStyle] = useState<TitleBorderStyle>(readBorderStyle);
    // Menos segundos por vuelta significa mayor velocidad.
    const [durationSeconds, updateDuration] = useState(() => readNumber(DURATION_KEY, 8, 2, 20));
    const [lineCount, updateLineCount] = useState(() => readNumber(LINE_COUNT_KEY, 2, 1, 6));
    // Porcentaje de cada tramo reservado al trazo; el resto queda como separación.
    const [lineLengthPercent, updateLineLength] = useState(() => readNumber(LINE_LENGTH_KEY, 36, 10, 90));

    // Guarda la elección; si localStorage está bloqueado, se mantiene en memoria.
    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, borderStyle);
            window.localStorage.setItem(DURATION_KEY, String(durationSeconds));
            window.localStorage.setItem(LINE_COUNT_KEY, String(lineCount));
            window.localStorage.setItem(LINE_LENGTH_KEY, String(lineLengthPercent));
        } catch {
            // App conserva la preferencia durante esta sesión.
        }
    }, [borderStyle, durationSeconds, lineCount, lineLengthPercent]);

    /** Ajusta la duración a segundos enteros entre 2 y 20. */
    function setDurationSeconds(value: number): void {
        if (Number.isFinite(value)) {
            updateDuration(Math.min(20, Math.max(2, Math.round(value))));
        }
    }

    /** Ajusta el número de trazos al intervalo de 1 a 6. */
    function setLineCount(value: number): void {
        if (Number.isFinite(value)) {
            updateLineCount(Math.min(6, Math.max(1, Math.round(value))));
        }
    }

    /** Conserva entre un 10% y un 90% de cada tramo para que siempre quede separación. */
    function setLineLengthPercent(value: number): void {
        if (Number.isFinite(value)) {
            updateLineLength(Math.min(90, Math.max(10, Math.round(value))));
        }
    }

    // Cada pareja trazo/hueco ocupa 100 / lineCount unidades del perímetro.
    const titleBorderStyle: CSSProperties & {
        '--huex-title-border-duration': string;
        '--huex-title-border-dasharray': string;
    } = {
        '--huex-title-border-duration': `${durationSeconds}s`,
        '--huex-title-border-dasharray': `${lineLengthPercent / lineCount} ${(100 - lineLengthPercent) / lineCount}`
    };

    return {
        borderStyle, setBorderStyle,
        durationSeconds, setDurationSeconds,
        lineCount, setLineCount,
        lineLengthPercent, setLineLengthPercent,
        titleBorderStyle
    };
}
