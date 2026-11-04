import { readJson } from '../utils/generalUtils';
import type { MediaLibrary } from '../utils/categoryUtils';

// ------------ Peticiones de creación de categorías y subcategorías -----------

/**
 * Crea una categoría y devuelve la biblioteca actualizada.
 * @param libraryId Identificador de la biblioteca que contiene los grupos.
 * @param name Nombre de la nueva categoría principal.
 * @param [signal] Señal que permite cancelar la petición.
 * @returns Documento completo de la biblioteca actualizada.
 */
export async function createCategoryRequest(libraryId: string, name: string, signal?: AbortSignal): Promise<MediaLibrary> {
    const library = await fetch(
        `/api/libraries/${encodeURIComponent(libraryId)}/categories/create`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            signal,
            body: JSON.stringify({ name })
        }
    ).then(readJson<MediaLibrary>);

    if (library.id !== libraryId || !Array.isArray(library.categories)) {
        throw new Error('La biblioteca recibida no es válida.');
    }

    return library;
}

/**
 * Crea una subcategoría y devuelve la biblioteca actualizada.
 * @param libraryId Identificador de la biblioteca que contiene los grupos.
 * @param parentId Identificador del grupo que recibirá la subcategoría.
 * @param name Nombre de la nueva subcategoría.
 * @param [signal] Señal que permite cancelar la petición.
 * @returns Documento completo de la biblioteca actualizada.
 */
export async function createSubcategoryRequest(libraryId: string, parentId: string, name: string, signal?: AbortSignal): Promise<MediaLibrary> {
    const library = await fetch(
        `/api/libraries/${encodeURIComponent(libraryId)}/categories/${encodeURIComponent(parentId)}/create-subcategory`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            signal,
            body: JSON.stringify({ name })
        }
    ).then(readJson<MediaLibrary>);

    if (library.id !== libraryId || !Array.isArray(library.categories)) {
        throw new Error('La biblioteca recibida no es válida.');
    }

    return library;
}

// ----------------- Peticiones de movimiento entre categorías -----------------

/**
 * Cambia la categoría de un elemento y devuelve la biblioteca actualizada.
 * @param libraryId Identificador de la biblioteca que contiene los grupos.
 * @param itemPath Ruta de la carpeta de serie o del archivo de película.
 * @param targetCategoryId Grupo de destino; null deja el elemento sin categoría.
 * @param [signal] Señal que permite cancelar la petición.
 * @returns Documento completo de la biblioteca actualizada.
 */
export async function moveCategoryItemRequest(libraryId: string, itemPath: string, targetCategoryId: string|null, signal?: AbortSignal): Promise<MediaLibrary> {
    const library = await fetch(
        `/api/libraries/${encodeURIComponent(libraryId)}/categories/move-item`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            signal,
            body: JSON.stringify({
                itemPath,
                targetCategoryId
            })
        }
    ).then(readJson<MediaLibrary>);

    if (library.id !== libraryId || !Array.isArray(library.categories)) {
        throw new Error('La biblioteca recibida no es válida.');
    }

    return library;
}

// ------------------ Peticiones de eliminación de categorías ------------------

/**
 * Elimina un grupo y sus descendientes y devuelve la biblioteca actualizada.
 * @param libraryId Identificador de la biblioteca que contiene los grupos.
 * @param categoryId Identificador de la categoría o subcategoría.
 * @param [signal] Señal que permite cancelar la petición.
 * @returns Documento completo de la biblioteca actualizada.
 */
export async function deleteCategoryRequest(libraryId: string, categoryId: string, signal?: AbortSignal): Promise<MediaLibrary> {
    const library = await fetch(
        `/api/libraries/${encodeURIComponent(libraryId)}/categories/${encodeURIComponent(categoryId)}/delete`,
        {
            method: 'POST',
            signal
        }
    ).then(readJson<MediaLibrary>);

    if (library.id !== libraryId || !Array.isArray(library.categories)) {
        throw new Error('La biblioteca recibida no es válida.');
    }

    return library;
}

// ------------------- Peticiones de renombrado de categorías ------------------

/**
 * Cambia el nombre de un grupo y devuelve la biblioteca actualizada.
 * @param libraryId Identificador de la biblioteca que contiene los grupos.
 * @param categoryId Identificador de la categoría o subcategoría.
 * @param name Nuevo nombre visible del grupo.
 * @param [signal] Señal que permite cancelar la petición.
 * @returns Documento completo de la biblioteca actualizada.
 */
export async function renameCategoryRequest(libraryId: string, categoryId: string, name: string, signal?: AbortSignal): Promise<MediaLibrary> {
    const library = await fetch(
        `/api/libraries/${encodeURIComponent(libraryId)}/categories/${encodeURIComponent(categoryId)}/rename`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            signal,
            body: JSON.stringify({ name })
        }
    ).then(readJson<MediaLibrary>);

    if (library.id !== libraryId || !Array.isArray(library.categories)) {
        throw new Error('La biblioteca recibida no es válida.');
    }

    return library;
}

// ------------------- Peticiones de ordenación de categorías ------------------

/**
 * Mueve un grupo una posición y devuelve la biblioteca actualizada.
 * @param libraryId Identificador de la biblioteca que contiene los grupos.
 * @param categoryId Identificador de la categoría o subcategoría.
 * @param offset Desplazamiento entre hermanos: -1 para subir o 1 para bajar.
 * @param [signal] Señal que permite cancelar la petición.
 * @returns Documento completo de la biblioteca actualizada.
 */
export async function reorderCategoryRequest(libraryId: string, categoryId: string, offset: -1|1, signal?: AbortSignal): Promise<MediaLibrary> {
    const library = await fetch(
        `/api/libraries/${encodeURIComponent(libraryId)}/categories/${encodeURIComponent(categoryId)}/reorder`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            signal,
            body: JSON.stringify({ offset })
        }
    ).then(readJson<MediaLibrary>);

    if (library.id !== libraryId || !Array.isArray(library.categories)) {
        throw new Error('La biblioteca recibida no es válida.');
    }

    return library;
}
