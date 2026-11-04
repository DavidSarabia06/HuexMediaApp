import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage, normalizePathForComparison } from '../utils/generalUtils';
import { createLibraryRequest, deleteLibraryRequest, renameLibraryRequest, selectLibraryFolderRequest, loadLibraryRequest, getLibrariesRequest } from '../api/librariesApi';
import { getRememberedLibraryId, rememberLibraryId } from '../utils/libraryUtils';
import type { MediaLibrary, MediaType, LibrarySummary, LibraryLoadResult } from '../utils/libraryUtils';

import { getLibraryProgress } from '../utils/playbackProgress';
import type { LibraryPlaybackProgress } from '../utils/playbackProgress';

export type { MediaType, LibrarySummary } from '../utils/libraryUtils';

// ---------------------------- Opciones del hook ------------------------------

export interface UseLibrariesOptions {
    /** Sección cuyo listado y selección se gestionan. */
    mediaType: MediaType;
    /** Limpia el contenido específico de la página. Debe ser una función estable. */
    onReset?: () => void;
    /** Aplica en la página el contenido y progreso ya cargados. Debe ser estable. */
    onLibraryLoaded: (
        result: LibraryLoadResult,
        progress: LibraryPlaybackProgress,
        signal: AbortSignal
    ) => void | Promise<void>;
}

/**
 * Gestiona el listado, selección, formularios y operaciones de bibliotecas.
 * @param options Tipo de contenido y callbacks estables de la página.
 * @returns Datos, referencias y acciones para dibujar el selector y los diálogos.
 */
export default function useLibraries({ mediaType, onReset, onLibraryLoaded }: UseLibrariesOptions) {
    // -------------------- Estados de consulta y selección -----------------------

    // Listado guardado y biblioteca cuyo contenido se ha cargado correctamente.
    const [libraries, setLibraries] = useState<LibrarySummary[]>([]);
    const [selectedLibrary, setSelectedLibrary] = useState<MediaLibrary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // --------------------- Control y cancelación de operaciones ------------------

    // Comparte el bloqueo y cancelación con las acciones de categorías de la página.
    const activeControllerRef = useRef<AbortController | null>(null);
    // ----------------------- Estado del selector de bibliotecas ------------------

    const librarySelectorRef = useRef<HTMLDetailsElement>(null);

    // ------------------- Estados de carpeta y creación de bibliotecas -----------

    // Carpeta elegida para la nueva biblioteca.
    const [newLibraryPath, setNewLibraryPath] = useState('');

    // Nombre escrito en el formulario.
    const [newLibraryName, setNewLibraryName] = useState('');

    const [creationError, setCreationError] = useState('');

    // Indica que se está creando y cargando la biblioteca.
    const [isCreating, setIsCreating] = useState(false);

    // Permite abrir y cerrar el formulario.
    const createLibraryDialogRef = useRef<HTMLDialogElement>(null);


    // --------------------- Estados de eliminación de bibliotecas ----------------

    // Biblioteca pendiente de confirmar.
    const [libraryToDelete, setLibraryToDelete] = useState<LibrarySummary | null>(null);

    const [deleteLibraryError, setDeleteLibraryError] = useState('');

    // Bloquea la confirmación mientras se elimina.
    const [isDeletingLibrary, setIsDeletingLibrary] = useState(false);

    const deleteLibraryDialogRef = useRef<HTMLDialogElement>(null);


    // --------------------- Estados de renombrado de bibliotecas ------------------

    // Biblioteca que se está editando, aunque no sea la seleccionada.
    const [libraryToRename, setLibraryToRename] = useState<LibrarySummary | null>(null);

    const [editedLibraryName, setEditedLibraryName] = useState('');
    const [renameLibraryError, setRenameLibraryError] = useState('');

    // Bloquea el formulario durante el guardado.
    const [isRenamingLibrary, setIsRenamingLibrary] = useState(false);

    const renameLibraryDialogRef = useRef<HTMLDialogElement>(null);


    // -------------------------- Aplicación de selección --------------------------

    /**
     * Carga contenido y progreso en paralelo, los entrega a la página y recuerda la selección.
     * @param libraryId Biblioteca que se va a cargar.
     * @param signal Cancelación compartida con la operación que solicita la carga.
     * @returns Finalización de la carga y actualización de la selección.
     */
    const loadAndSelectLibrary = useCallback(async (
        libraryId: string,
        signal: AbortSignal
    ): Promise<void> => {
        // Ambas consultas comparten la cancelación de esta operación.
        const [result, progress] = await Promise.all([
            loadLibraryRequest(libraryId, signal),
            getLibraryProgress(libraryId, signal)
        ]);

        // Una carga cancelada no debe actualizar ni la página ni la selección.
        if (signal.aborted) {
            return;
        }

        if (result.library.mediaType !== mediaType) {
            throw new Error('La biblioteca no corresponde a este tipo de contenido.');
        }

        // Series necesita preparar sus episodios de continuación antes de mostrar la biblioteca.
        await onLibraryLoaded(result, progress, signal);
        if (signal.aborted) {
            return;
        }
        setSelectedLibrary(result.library);
        rememberLibraryId(mediaType, result.library.id);
    }, [mediaType, onLibraryLoaded]);

    // -------------------------- Carga inicial del listado -------------------------

    // Se ejecuta al montar y cuando cambia el tipo; la limpieza cancela la consulta anterior.
    useEffect(() => {
        const controller = new AbortController();
        activeControllerRef.current = controller;

        /*
            Consultar bibliotecas
            → Buscar la recordada
            → Si no hay recordada, comprobar si solo existe una
            → Cargar contenido y progreso y llamar a onLibraryLoaded
            → Recordar la selección cuando termine
        */
        async function loadLibraries(): Promise<void> {
            setIsLoading(true);
            setLoadError('');
            setLibraries([]);
            setSelectedLibrary(null);

            try {
                // La página decide qué contenido necesita limpiar.
                onReset?.();

                const savedLibraries = await getLibrariesRequest(
                    mediaType,
                    controller.signal
                );

                if (controller.signal.aborted) {
                    return;
                }

                setLibraries(savedLibraries);

                // Recupera la selección anterior de esta sección.
                const rememberedId = getRememberedLibraryId(mediaType);

                const rememberedLibrary = savedLibraries.find(library => {
                    return library.id === rememberedId;
                });

                // Retira la preferencia si esa biblioteca ya no está registrada.
                if (rememberedId && !rememberedLibrary) {
                    rememberLibraryId(mediaType, null);
                }

                let initialLibrary = rememberedLibrary;

                // Sin selección recordada, utiliza la única biblioteca disponible.
                if (!initialLibrary && savedLibraries.length === 1) {
                    initialLibrary = savedLibraries[0];
                }

                // Con varias bibliotecas y sin selección previa, espera al usuario.
                if (!initialLibrary) {
                    return;
                }

                await loadAndSelectLibrary(initialLibrary.id, controller.signal);
            } catch (error) {
                if (!controller.signal.aborted) {
                    setLoadError(errorMessage(error));
                }
            } finally {
                // Solo libera el bloqueo si sigue perteneciendo a esta operación.
                if (activeControllerRef.current === controller) {
                    activeControllerRef.current = null;

                    if (!controller.signal.aborted) {
                        setIsLoading(false);
                    }
                }
            }
            
        }

        void loadLibraries();
        return () => {
            controller.abort();

            // Cancela también una acción iniciada posteriormente desde la página.
            activeControllerRef.current?.abort();
            activeControllerRef.current = null;
        };
    }, [mediaType, onReset, loadAndSelectLibrary]);


    /** Cierra el selector y devuelve el foco a su cabecera. */
    function closeLibrarySelector(): void {
        const selector = librarySelectorRef.current;
        if (selector) {
            selector.open = false;
            selector.querySelector<HTMLElement>('summary')?.focus();
        }
    }

    // ------------------------- Selección de biblioteca --------------------------

    /** Carga una biblioteca elegida por su identificador. */
    async function selectLibrary(libraryId: string) {
        if (!libraryId || libraryId === selectedLibrary?.id || isLoading || activeControllerRef.current) {
            return;
        }

        const libraryExists = libraries.some(
            library => library.id === libraryId);

        if (!libraryExists) {
            setLoadError('La biblioteca seleccionada no está disponible en el listado.');
            return;
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;

        setIsLoading(true);
        setLoadError('');

        try {
            await loadAndSelectLibrary(
                libraryId,
                controller.signal
            );
        } catch (error) {
            if (!controller.signal.aborted) {
                setLoadError(errorMessage(error));
            }
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;

                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }
    }
    /** Cierra el desplegable cuando se abandona el selector. */
    useEffect(() => {
        function closeLibrarySelector(event: Event & { key?: string }) {
            const selector = librarySelectorRef.current;
            if (selector && (event.key === 'Escape' ||
                (event.type === 'pointerdown' && !selector.contains(event.target as Node | null)))) {
                selector.open = false;
                if (event.key === 'Escape') {
                    selector.querySelector('summary')?.focus();
                }
            }
        }

        document.addEventListener('pointerdown', closeLibrarySelector);
        document.addEventListener('keydown', closeLibrarySelector);
        return () => {
            document.removeEventListener('pointerdown', closeLibrarySelector);
            document.removeEventListener('keydown', closeLibrarySelector);
        };
    }, []);



    // ------------------- Selección de carpeta y creación de bibliotecas ---------

    /** Abre el selector y prepara el formulario con la carpeta elegida. */
    async function handleSelectFolder() {
        if (isLoading || activeControllerRef.current) {
            return;
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;

        setIsLoading(true);
        setLoadError('');

        try {
            const selection = await selectLibraryFolderRequest(mediaType, controller.signal);

            if (controller.signal.aborted || !selection.ruta) {
                return;
            }

            // Si la carpeta ya está registrada, carga esa biblioteca en lugar de duplicarla.
            const existingLibrary = libraries.find(library =>
                normalizePathForComparison(library.libraryPath) ===
                normalizePathForComparison(selection.ruta)
            );

            if (existingLibrary) {
                await loadAndSelectLibrary(
                    existingLibrary.id,
                    controller.signal
                );
                return;
            }

            // Propone como nombre el último segmento de la ruta seleccionada.
            const folderName = selection.ruta
                .replace(/[\\/]+$/, '')
                .split(/[\\/]/)
                .pop();

            setNewLibraryPath(selection.ruta);
            setNewLibraryName((folderName || (mediaType === 'Movies' ? 'Mis películas' : 'Mis series')).slice(0, 80));
            setCreationError('');

            createLibraryDialogRef.current?.showModal();
        } catch (error) {
            if (!controller.signal.aborted) {
                setLoadError(errorMessage(error));
            }
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;

                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }
    }


    /** Cierra el formulario cuando no se está guardando. */
    function closeCreateLibraryDialog() {
        if (isCreating) {
            return;
        }

        createLibraryDialogRef.current?.close();
        setNewLibraryPath('');
        setNewLibraryName('');
        setCreationError('');
    }


    /** Guarda la biblioteca, la incorpora al selector y carga su contenido. */
    async function handleCreateLibrary(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (isLoading || activeControllerRef.current || !newLibraryPath) {
            return;
        }

        const name = newLibraryName.trim();

        if (!name || name.length > 80) {
            setCreationError('El nombre debe tener entre 1 y 80 caracteres.');
            return;
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;

        setIsCreating(true);
        setIsLoading(true);
        setCreationError('');
        setLoadError('');

        let libraryCreated = false;

        try {
            const library = await createLibraryRequest(
                name,
                mediaType,
                newLibraryPath,
                controller.signal
            );

            if (controller.signal.aborted) {
                return;
            }

            libraryCreated = true;

            // Incorpora el resumen al selector antes de escanear.
            // Si el escaneo falla, la biblioteca guardada seguirá disponible para reintentar.
            setLibraries(current => current.concat({
                id: library.id,
                name: library.name,
                mediaType: library.mediaType,
                libraryPath: library.libraryPath
            }).sort((first, second) => first.name.localeCompare(second.name, 'es')));

            createLibraryDialogRef.current?.close();
            setNewLibraryPath('');
            setNewLibraryName('');

            await loadAndSelectLibrary(
                library.id,
                controller.signal
            );
        } catch (error) {
            if (!controller.signal.aborted) {
                if (libraryCreated) {
                    setLoadError(
                        `La biblioteca se ha guardado, pero no se ha podido cargar. ${errorMessage(error)}`);
                } else {
                    setCreationError(errorMessage(error));
                }
            }
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;

                if (!controller.signal.aborted) {
                    setIsCreating(false);
                    setIsLoading(false);
                }
            }
        }
    }

    // ------------------------- Eliminación de bibliotecas -----------------------

    /** Cierra el selector y solicita confirmación para eliminar la biblioteca. */
    function openDeleteLibraryDialog(library: LibrarySummary) {
        if (isLoading || activeControllerRef.current) {
            return;
        }

        closeLibrarySelector();

        setLibraryToDelete(library);
        setDeleteLibraryError('');
        deleteLibraryDialogRef.current?.showModal();
    }

    /** Cierra la confirmación cuando no se está eliminando. */
    function closeDeleteLibraryDialog() {
        if (isDeletingLibrary) {
            return;
        }

        deleteLibraryDialogRef.current?.close();
        setLibraryToDelete(null);
        setDeleteLibraryError('');
    }

    /** Elimina la biblioteca y actualiza el selector y el contenido visible. */
    async function handleDeleteLibrary(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!libraryToDelete || isLoading || activeControllerRef.current) {
            return;
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;

        setIsDeletingLibrary(true);
        setIsLoading(true);
        setDeleteLibraryError('');
        setLoadError('');

        let libraryDeleted = false;

        try {
            const libraryId = libraryToDelete.id;

            await deleteLibraryRequest(libraryId, controller.signal);

            if (controller.signal.aborted) {
                return;
            }

            libraryDeleted = true;

            const remainingLibraries = libraries.filter(library => {
                return library.id !== libraryId;
            });

            setLibraries(remainingLibraries);

            // Elimina la preferencia si apuntaba a la biblioteca borrada.
            if (getRememberedLibraryId(mediaType) === libraryId) {
                rememberLibraryId(mediaType, null);
            }

            deleteLibraryDialogRef.current?.close();
            setLibraryToDelete(null);

            // Eliminar otra biblioteca no cambia el contenido que estamos viendo.
            if (selectedLibrary?.id === libraryId) {
                setSelectedLibrary(null);
                onReset?.();

                // Si queda una sola biblioteca, la carga automáticamente.
                // Con varias, espera una nueva selección.
                if (remainingLibraries.length === 1) {
                    await loadAndSelectLibrary(
                        remainingLibraries[0].id,
                        controller.signal
                    );
                }
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                if (libraryDeleted) {
                    // El borrado terminó; el fallo corresponde a cargar la biblioteca restante.
                    setLoadError(
                        `La biblioteca se ha eliminado, pero no se ha podido cargar la restante. ${errorMessage(error)}`);
                } else {
                    setDeleteLibraryError(errorMessage(error));
                }
            }
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;

                if (!controller.signal.aborted) {
                    setIsDeletingLibrary(false);
                    setIsLoading(false);
                }
            }
        }
    }

    // ---------------------- Cambio de nombre de bibliotecas ---------------------

    /** Cierra el selector y abre el formulario con el nombre actual. */
    function openRenameLibraryDialog(library: LibrarySummary) {
        if (isLoading || activeControllerRef.current) {
            return;
        }

        closeLibrarySelector();

        setLibraryToRename(library);
        setEditedLibraryName(library.name);
        setRenameLibraryError('');
        renameLibraryDialogRef.current?.showModal();
    }

    /** Cierra el formulario cuando no hay un guardado en curso. */
    function closeRenameLibraryDialog() {
        if (isRenamingLibrary) {
            return;
        }

        renameLibraryDialogRef.current?.close();
        setLibraryToRename(null);
        setEditedLibraryName('');
        setRenameLibraryError('');
    }

    /** Guarda el nombre y actualiza el selector sin volver a escanear los vídeos. */
    async function handleRenameLibrary(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!libraryToRename || isLoading || activeControllerRef.current) {
            return;
        }

        const name = editedLibraryName.trim();

        if (!name || name.length > 80) {
            setRenameLibraryError(
                'El nombre debe tener entre 1 y 80 caracteres.');
            return;
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;

        setIsRenamingLibrary(true);
        setIsLoading(true);
        setRenameLibraryError('');

        try {
            const library = await renameLibraryRequest(
                libraryToRename.id,
                name,
                controller.signal
            );

            if (controller.signal.aborted) {
                return;
            }

            // Actualiza el nombre del resumen y vuelve a ordenar el selector.
            setLibraries(current => current.map(item => {
                return item.id === library.id
                    ? { ...item, name: library.name }
                    : item;
            }).sort((first, second) => {
                return first.name.localeCompare(second.name, 'es');
            }));

            // Solo cambia el título visible si se ha renombrado la biblioteca activa.
            setSelectedLibrary(current => {
                return current?.id === library.id ? library : current;
            });

            renameLibraryDialogRef.current?.close();
            setLibraryToRename(null);
            setEditedLibraryName('');
        } catch (error) {
            if (!controller.signal.aborted) {
                setRenameLibraryError(errorMessage(error));
            }
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;

                if (!controller.signal.aborted) {
                    setIsRenamingLibrary(false);
                    setIsLoading(false);
                }
            }
        }
    }

    // ---------------------------- Resultado del hook -----------------------------

    return {
        // Consulta y biblioteca seleccionada
        libraries,
        selectedLibrary,
        setSelectedLibrary,
        isLoading,
        setIsLoading,
        loadError,
        setLoadError,

        // Control y cancelación de operaciones
        activeControllerRef,

        // Selector de bibliotecas
        librarySelectorRef,
        selectLibrary,
        closeLibrarySelector,

        // Selección de carpeta y creación de bibliotecas
        newLibraryPath,
        newLibraryName,
        setNewLibraryName,
        isCreating,
        creationError,
        setCreationError,
        createLibraryDialogRef,
        handleSelectFolder,
        closeCreateLibraryDialog,
        handleCreateLibrary,

        // Eliminación de bibliotecas
        libraryToDelete,
        isDeletingLibrary,
        deleteLibraryError,
        deleteLibraryDialogRef,
        openDeleteLibraryDialog,
        closeDeleteLibraryDialog,
        handleDeleteLibrary,

        // Renombrado de bibliotecas
        editedLibraryName,
        setEditedLibraryName,
        isRenamingLibrary,
        renameLibraryError,
        setRenameLibraryError,
        renameLibraryDialogRef,
        openRenameLibraryDialog,
        closeRenameLibraryDialog,
        handleRenameLibrary
    };
}

/** Contrato inferido de los estados y acciones devueltos por el hook. */
export type UseLibrariesResult = ReturnType<typeof useLibraries>;
