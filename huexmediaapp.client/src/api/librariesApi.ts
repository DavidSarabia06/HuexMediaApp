import { readJson } from '../utils/generalUtils';
import type { MediaLibrary, MediaType, MediaItem, LibrarySummary, LibraryLoadResult, DeleteLibraryResult } from '../utils/libraryUtils';

// ------------------- Peticiones de consulta de bibliotecas -------------------

/**
 * Consulta las bibliotecas de Series o Películas y comprueba que la respuesta sea una lista.
 * @param mediaType Tipo solicitado: Series o Movies.
 * @param [signal] Señal que permite cancelar la petición al salir de la página.
 * @returns Promesa con los resúmenes de bibliotecas que utilizará el selector.
 */
export async function getLibrariesRequest(mediaType: MediaType, signal?: AbortSignal): Promise<LibrarySummary[]> {
    const libraries = await fetch(
        `/api/libraries?mediaType=${encodeURIComponent(mediaType)}`,
        { signal }
    ).then(readJson<LibrarySummary[]>);

    if (!Array.isArray(libraries)) {
        throw new Error('La lista de bibliotecas recibida no es válida.');
    }

    return libraries;
}

/**
 * Obtiene el documento de una biblioteca y después escanea su carpeta según el tipo de contenido.
 * @param libraryId Identificador de la biblioteca seleccionada.
 * @param [signal] Señal compartida por la consulta del documento y el escaneo.
 * @returns Promesa con { library, items }: documento de biblioteca y elementos disponibles.
 */
export async function loadLibraryRequest(libraryId: string, signal?: AbortSignal): Promise<LibraryLoadResult> {
    const library = await fetch(
        `/api/libraries/${encodeURIComponent(libraryId)}`,
        { signal }
    ).then(readJson<MediaLibrary>);

    if (!library.libraryPath || !Array.isArray(library.categories)) {
        throw new Error('La biblioteca recibida no es válida.');
    }

    // Ambas bibliotecas comparten la carga del JSON.
    // El escaneo utiliza el servicio específico de cada tipo.
    let scanUrl;

    if (library.mediaType === 'Series') {
        // El servidor resuelve la carpeta desde el identificador guardado.
        scanUrl = `/api/series/scan?libraryId=${encodeURIComponent(library.id)}`;
    } else if (library.mediaType === 'Movies') {
        // El servidor obtiene la ruta de películas mediante la biblioteca guardada.
        scanUrl = `/api/movies/scan?libraryId=${encodeURIComponent(library.id)}`;
    } else {
        throw new Error('El tipo de biblioteca no es válido.');
    }

    const items = await fetch(scanUrl, { signal }).then(readJson<MediaItem[]>);

    if (!Array.isArray(items)) {
        throw new Error('El contenido de la biblioteca no es válido.');
    }

    // library contiene la identidad, ruta y categorías.
    // items contiene las series o películas obtenidas del escaneo.
    return { library, items };
}

// ------------------- Peticiones de creación de bibliotecas -------------------

/**
 * Envía nombre, tipo y carpeta para registrar una biblioteca y comprueba el documento devuelto.
 * @param name Nombre visible elegido por el usuario.
 * @param mediaType Tipo de contenido: Series o Movies.
 * @param libraryPath Carpeta raíz de los vídeos.
 * @param [signal] Señal que permite cancelar la petición.
 * @returns Promesa con la biblioteca creada, incluido su identificador y categorías.
 */
export async function createLibraryRequest(name: string, mediaType: MediaType, libraryPath: string, signal?: AbortSignal): Promise<MediaLibrary> {
    const library = await fetch('/api/libraries', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        signal,
        body: JSON.stringify({
            name,
            mediaType,
            libraryPath
        })
    }).then(readJson<MediaLibrary>);

    if (!library?.id || library.mediaType !== mediaType ||
        !Array.isArray(library.categories)) {
        throw new Error('La biblioteca creada no es válida.');
    }

    return library;
}

// ------------------ Peticiones de eliminación de bibliotecas -----------------

/**
 * Solicita eliminar el documento de biblioteca y verifica la confirmación y su identificador.
 * @param libraryId Identificador de la biblioteca que se elimina.
 * @param [signal] Señal que permite cancelar la petición.
 * @returns Promesa con la confirmación del servidor: success y libraryId.
 */
export async function deleteLibraryRequest(libraryId: string, signal?: AbortSignal): Promise<DeleteLibraryResult> {
    const result = await fetch(
        `/api/libraries/${encodeURIComponent(libraryId)}/delete`,
        {
            method: 'POST',
            signal
        }
    ).then(readJson<DeleteLibraryResult>);

    if (!result?.success || result.libraryId !== libraryId) {
        throw new Error('La respuesta de eliminación no es válida.');
    }

    return result;
}

// ------------------ Peticiones de renombrado de bibliotecas ------------------

/**
 * Envía el nuevo nombre y comprueba que la respuesta corresponda a la biblioteca editada.
 * @param libraryId Identificador de la biblioteca que se renombra.
 * @param name Nuevo nombre visible.
 * @param [signal] Señal que permite cancelar la petición.
 * @returns Promesa con el documento actualizado, conservando su identificador.
 */
export async function renameLibraryRequest(libraryId: string, name: string, signal?: AbortSignal): Promise<MediaLibrary> {
    const library = await fetch(
        `/api/libraries/${encodeURIComponent(libraryId)}/rename`,
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

// --------------------- Peticiones de selección de carpeta --------------------

/**
 * Abre el selector de Windows mediante el endpoint del tipo de biblioteca.
 * @param mediaType Tipo de contenido que solicita una carpeta.
 * @param signal Señal que permite cancelar la espera de la respuesta HTTP.
 * @returns Ruta seleccionada; una cadena vacía indica que se canceló el diálogo.
 */
export async function selectLibraryFolderRequest(
    mediaType: MediaType,
    signal?: AbortSignal
): Promise<{ ruta: string }> {
    return fetch(`/api/${mediaType.toLowerCase()}/select-folder`, { signal })
        .then(readJson<{ ruta: string }>);
}
