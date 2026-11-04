// -------------------------- Propiedades del selector -------------------------

export interface LibraryCardSizeSelectorProps {
    /** Tamaño actual: 100 para Compacto, 50 para Medio y 0 para Amplio. */
    value: number;
    /** Comunica el nuevo tamaño al estado compartido de App. */
    onChange: (value: number) => void;
}

// ---------------------------- Selector de tamaño -----------------------------

/**
 * Muestra un slider con tres posiciones para el tamaño de las carátulas.
 * @param props Tamaño seleccionado y función para comunicar cambios.
 * @returns Iconos de tamaño y slider con tres posiciones.
 */
export default function LibraryCardSizeSelector({ value, onChange }: LibraryCardSizeSelectorProps): import('react').JSX.Element {
    // ------------------------------ Cambio de tamaño -----------------------------

    /**
     * Comunica el tamaño seleccionado manteniendo fijos los contenedores y sus espacios.
     * @param event Cambio de posición del input de rango.
     * @returns Comunica a onChange el valor 100, 50 o 0 correspondiente al slider.
     */
    function handleChange(event: import('react').ChangeEvent<HTMLInputElement>): void {
        // Las posiciones 0, 1 y 2 del slider corresponden a los valores 100, 50 y 0 del hook.
        onChange(100 - Number(event.target.value) * 50);
    }

    // --------------------------- Iconos de las opciones --------------------------

    /**
     * Dibuja una cuadrícula cuya cantidad de celdas representa el tamaño de las carátulas.
     * @param size Valor que se selecciona al pulsar el botón: 100, 50 o 0.
     * @param name Nombre visible para accesibilidad y tooltip: Compacto, Medio o Amplio.
     * @param columns Número de columnas de la cuadrícula que representa la opción.
     * @returns Botón con su cuadrícula SVG y el estado de selección.
     */
    function renderSizeIcon(size: number, name: string, columns: number): import('react').JSX.Element {
        // Reparte el ancho de la cuadrícula entre sus columnas dejando una separación fija.
        const gap = 2;
        const width = (22 - gap * (columns - 1)) / columns;
        return (
            <button type="button" className={`library-card-size-option${value === size ? ' is-selected' : ''}`}
                title={name} aria-label={`Carátulas: ${name}`} aria-pressed={value === size}
                onClick={() => onChange(size)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    {Array.from({ length: columns * 2 }, (_, index) => (
                        <rect key={index} x={1 + (index % columns) * (width + gap)}
                            y={3 + Math.floor(index / columns) * 10} width={width} height="8" rx="1" />
                    ))}
                </svg>
            </button>
        );
    }

    // -------------------------- Renderizado del selector -------------------------

    // El valor del slider se obtiene del tamaño recibido; el padre conserva el estado seleccionado.
    return (
        <div className="library-card-size-control" role="group" aria-label="Tamaño de las carátulas">
            <div className="library-card-size-icons">
                {renderSizeIcon(100, 'Compacto', 4)}
                {renderSizeIcon(50, 'Medio', 3)}
                {renderSizeIcon(0, 'Amplio', 2)}
            </div>
            <input type="range" min="0" max="2" step="1" value={(100 - value) / 50}
                onChange={handleChange} aria-label="Tamaño de las carátulas"
                aria-valuetext={value === 100 ? 'Compacto' : value === 50 ? 'Medio' : 'Amplio'} />
        </div>
    );
}
