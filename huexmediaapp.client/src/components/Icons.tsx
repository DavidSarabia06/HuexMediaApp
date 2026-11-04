/** Icono de carpeta para seleccionar una biblioteca. */
export function FolderIcon({ size = 22 }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            width={size}
            height={size}
            aria-hidden="true"
            style={{ display: 'block' }}
        >
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
    );
}

/** Flecha para abrir y cerrar un desplegable. */
export function ChevronDownIcon({ size = 16 }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width={size}
            height={size}
            aria-hidden="true"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

/** Icono para añadir un elemento. */
export function PlusIcon({ size = 22 }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            width={size}
            height={size}
            aria-hidden="true"
        >
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}

/** Papelera para eliminar un elemento. */
export function TrashIcon({ size = 18 }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            width={size}
            height={size}
            aria-hidden="true"
        >
            <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
        </svg>
    );
}

/** Lápiz para editar el nombre de un elemento. */
export function EditIcon({ size = 18 }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            width={size}
            height={size}
            aria-hidden="true"
        >
            <path d="m16 3 5 5M4 20l4-1L21 6a2.1 2.1 0 0 0-3-3L5 16l-1 4z" />
        </svg>
    );
}

/** Flecha vertical para cambiar la posición de un grupo. */
export function VerticalArrowIcon({ direction = 'up', size = 18 }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            width={size}
            height={size}
            aria-hidden="true"
        >
            <path
                d={direction === 'up'
                    ? 'M12 19V5M5 12l7-7 7 7'
                    : 'M12 5v14M5 12l7 7 7-7'}
            />
        </svg>
    );
}