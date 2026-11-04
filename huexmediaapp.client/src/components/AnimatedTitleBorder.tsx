// -------------------------- Líneas del borde animado --------------------------

/** Los trazos configurados recorren el mismo rectángulo con velocidad constante. */
export default function AnimatedTitleBorder() {
    const gradientId = `title-border-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

    return (
        <svg className="huex-title-orbit-border" aria-hidden="true" focusable="false">
            <defs>
                {/* Cada título conserva su color, con una zona más clara y extremos suaves. */}
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
                    <stop offset="30%" stopColor="currentColor" stopOpacity="0.8" />
                    <stop offset="50%" className="huex-title-gradient-highlight" />
                    <stop offset="70%" stopColor="currentColor" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
                </linearGradient>
            </defs>
            {/* pathLength permite repartir los trazos sin medir la tarjeta con JavaScript. */}
            <rect
                className="huex-title-orbit-lines"
                x="1.5"
                y="1.5"
                rx="8"
                pathLength="100"
                stroke={`url(#${gradientId})`}
            />
        </svg>
    );
}
import { useId } from 'react';

