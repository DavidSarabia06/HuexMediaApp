// ---------------------------- Tipos de bibliotecas ---------------------------

export type MediaLibrary = import('./categoryUtils').MediaLibrary;
export type MediaItem = import('./categoryUtils').MediaItem;
export type MediaType = 'Series'|'Movies';
export type LibrarySummary = Pick<MediaLibrary, 'id'|'name'|'mediaType'|'libraryPath'>;

export interface LibraryLoadResult {
    /** Documento completo de la biblioteca seleccionada. */
    library: MediaLibrary;
    /** Series o películas disponibles en el escaneo. */
    items: MediaItem[];
}

export interface DeleteLibraryResult {
    /** Confirma que se ha eliminado el documento de biblioteca. */
    success: boolean;
    /** Identificador de la biblioteca eliminada. */
    libraryId: string;
}

// -------------------------- Biblioteca recordada ---------------------------

/**
 * Lee del navegador la última selección guardada para este tipo de biblioteca.
 * @param mediaType Tipo de contenido cuya selección se recupera: Series o Movies.
 * @returns Identificador recordado o null si falta o falla el acceso a localStorage.
 */
export function getRememberedLibraryId(mediaType: MediaType): string|null {
    try {
        return localStorage.getItem(`huex:last-library:${mediaType}`);
    } catch {
        // Si el navegador bloquea el almacenamiento, continúa sin selección previa.
        return null;
    }
}

/**
 * Guarda la selección de este tipo de biblioteca o retira la preferencia cuando el identificador está vacío.
 * @param mediaType Tipo de contenido: Series o Movies.
 * @param libraryId Identificador seleccionado; null permite borrar la preferencia.
 * @returns Actualiza o elimina la preferencia local de este tipo de biblioteca.
 */
export function rememberLibraryId(mediaType: MediaType, libraryId: string|null): void {
    try {
        const key = `huex:last-library:${mediaType}`;

        if (libraryId) {
            localStorage.setItem(key, libraryId);
        } else {
            localStorage.removeItem(key);
        }
    } catch {
        // Un fallo al recordar la selección no impide utilizar la biblioteca.
    }
}
