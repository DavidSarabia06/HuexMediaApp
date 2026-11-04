import { useEffect, useState } from 'react';

// ----------------------------- Tipos de densidad -----------------------------

export type LibraryDensityStyle = import('react').CSSProperties & {'--library-columns': number};

export interface LibraryDensityState {
    /** Valor del tamaño: 0 para Amplio, 50 para Medio y 100 para Compacto. */
    density: number;
    /** Actualiza el tamaño compartido con el selector. */
    setDensity: import('react').Dispatch<import('react').SetStateAction<number>>;
    /** Estilos que comunican las columnas a la página mediante --library-columns. */
    densityStyle: LibraryDensityStyle;
}

// -------------------------- Lectura de preferencias --------------------------

/**
 * Recupera la preferencia y la ajusta a Compacto, Medio o Amplio, incluidos los valores del antiguo slider.
 * @param storageKey Clave de localStorage correspondiente a la sección.
 * @returns Preferencia ajustada a 0, 50 o 100; utiliza 100 como valor predeterminado.
 */
function readDensity(storageKey: string): number {
    try {
        const saved = window.localStorage.getItem(storageKey);
        const value = saved === null ? 100 : Number(saved);
        return Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value)) / 50) * 50 : 100;
    } catch {
        return 100;
    }
}

// --------------------------- Densidad de biblioteca --------------------------

/**
 * Calcula las columnas del tamaño de carátula elegido y conserva la preferencia por biblioteca.
 * @param storageKey Clave con la que se recupera y guarda el tamaño elegido.
 * @returns Tamaño actual, función para cambiarlo y estilos de columnas.
 */
export default function useLibraryDensity(storageKey: string): LibraryDensityState {
    // ---------------------------------- Estados ----------------------------------

    // El tamaño se recupera una vez al inicializar el estado de esta instancia del hook.
    const [density, setDensity] = useState(() => readDensity(storageKey));
    // El ancho de ventana determina el intervalo de columnas utilizado en cada resolución.
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

    // ---------------------------- Cambio de resolución ---------------------------

    // Actualiza las columnas al cambiar de resolución 
    useEffect(() => {
        /**
         * Vuelve a calcular el intervalo de pantalla utilizado por los carruseles.
         * @returns Actualiza el estado con el ancho actual de la ventana.
         */
        function updateViewportWidth(): void {
            setViewportWidth(window.innerWidth);
        }
        window.addEventListener('resize', updateViewportWidth);
        return () => {
            window.removeEventListener('resize', updateViewportWidth); //retira el listener al salir de la página.
        };
    }, []);

    // -------------------------- Guardado de preferencias -------------------------

    // Guarda el tamaño elegido; si el almacenamiento está bloqueado, la elección sigue funcionando en memoria.
    useEffect(() => {
        try {
            window.localStorage.setItem(storageKey, String(density));
        } catch {
            // La preferencia permanece en memoria durante esta visita.
        }
    }, [density, storageKey]);

    // ---------------------------- Cálculo de columnas ----------------------------

    // Amplio utiliza las columnas normales; Compacto toma como referencia las columnas objetivo.
    const normalColumns = viewportWidth <= 600 ? 1 : viewportWidth <= 900 ? 2 : viewportWidth <= 1023 ? 3 : viewportWidth <= 1440 ? 4 : 6;
    const targetColumns = viewportWidth <= 600 ? 3 : viewportWidth <= 900 ? 4 : viewportWidth <= 1023 ? 5 : viewportWidth <= 1440 ? 6 : viewportWidth <= 1920 ? 8 : 10;
    const compactColumns = Math.max(normalColumns, targetColumns);
    // El factor es 0, 0.5 o 1 para interpolar entre Amplio, Medio y Compacto.
    const factor = density / 100;
    const columns = Math.round(normalColumns + (compactColumns - normalColumns) * factor);

    // ----------------------------- Resultado del hook ----------------------------

    // App comparte este estado con Header y aplica densityStyle al contenedor de la página.
    return {
        density,
        setDensity,
        densityStyle: { '--library-columns': columns }
    };
}
