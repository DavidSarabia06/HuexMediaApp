import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { UseLibrariesResult } from './useLibraries';
import type { MediaCategory, MediaItem } from '../utils/categoryUtils';
import { createCategoryRequest, createSubcategoryRequest, moveCategoryItemRequest, deleteCategoryRequest, renameCategoryRequest, reorderCategoryRequest } from '../api/categoriesApi';
import { collectItemPaths, getCategoryDestinations } from '../utils/categoryUtils';
import { errorMessage, normalizePathForComparison } from '../utils/generalUtils';

const EMPTY_CATEGORIES: MediaCategory[] = [];

// ---------------------------- Opciones del hook ------------------------------

export interface UseCategoriesOptions {
    /** Biblioteca y bloqueo compartidos con sus otras operaciones. */
    libraryManager: Pick<UseLibrariesResult,
        'selectedLibrary' | 'setSelectedLibrary' | 'isLoading' |
        'setIsLoading' | 'activeControllerRef'>;
    /** Elementos escaneados para calcular los que siguen sin categoría. */
    items: MediaItem[];
    /** Prefijo de los identificadores HTML utilizados al recuperar el foco. */
    groupIdPrefix: string;
}

/**
 * Gestiona categorías, subcategorías, asignaciones y orden de una biblioteca.
 * @param options Gestor de bibliotecas, elementos y prefijo de los paneles.
 * @returns Datos, formularios y acciones para dibujar y modificar los grupos.
 */
export default function useCategories({ libraryManager, items, groupIdPrefix }: UseCategoriesOptions) {
    const { selectedLibrary, setSelectedLibrary, isLoading, setIsLoading, activeControllerRef } = libraryManager;

    // La biblioteca seleccionada es la fuente de las categorías actualizadas.
    const categories = selectedLibrary?.categories ?? EMPTY_CATEGORIES;
    const libraryId = selectedLibrary?.id;

    // --------------------- Estados de creación de categorías --------------------

    // Nombre escrito en el formulario.
    const [newCategoryName, setNewCategoryName] = useState('');

    const [categoryCreationError, setCategoryCreationError] = useState('');

    // Bloquea el formulario mientras se guarda la categoría.
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);

    // Permite abrir y cerrar el diálogo.
    const createCategoryDialogRef = useRef<HTMLDialogElement>(null);

    // Grupo que recibirá la subcategoría; null para crear una categoría principal.
    const [categoryParent, setCategoryParent] = useState<MediaCategory | null>(null);


    // ------------------------ Estados de movimiento entre grupos -----------------
    const [moveError, setMoveError] = useState('');


    // --------------------- Estados de eliminación de grupos ----------------------

    // Categoría o subcategoría pendiente de confirmar.
    const [categoryToDelete, setCategoryToDelete] = useState<MediaCategory | null>(null);

    const [deleteCategoryError, setDeleteCategoryError] = useState('');

    // Bloquea el diálogo durante el guardado.
    const [isDeletingCategory, setIsDeletingCategory] = useState(false);

    const deleteCategoryDialogRef = useRef<HTMLDialogElement>(null);


    // ---------------------- Estados de renombrado de grupos ----------------------

    // Grupo que se está editando.
    const [categoryToRename, setCategoryToRename] = useState<MediaCategory | null>(null);

    // Nombre editable del grupo.
    const [editedCategoryName, setEditedCategoryName] = useState('');

    const [renameCategoryError, setRenameCategoryError] = useState('');

    // Bloquea el formulario mientras se guarda.
    const [isRenamingCategory, setIsRenamingCategory] = useState(false);

    const renameCategoryDialogRef = useRef<HTMLDialogElement>(null);


    // ------------------------ Estados de orden de los grupos ---------------------
    const [reorderError, setReorderError] = useState('');
    // Recuerda qué grupo debe recuperar el foco después de cambiar el orden.
    const movedCategoryIdRef = useRef<string | null>(null);


    // ----------------------- Cambio de biblioteca activa -------------------------

    /** Limpia los errores de la biblioteca anterior al cambiar la selección. */
    useEffect(() => {
        function resetErrors(): void {
            setMoveError('');
            setReorderError('');
            setCategoryCreationError('');
            setDeleteCategoryError('');
            setRenameCategoryError('');
            movedCategoryIdRef.current = null;
        }
        resetErrors();
    }, [libraryId]);

    // ------------------------- Creación de categorías ---------------------------

    /**
     * Limpia el formulario y lo abre para la biblioteca seleccionada.
     * @param parent Grupo que recibirá el hijo; null para una categoría principal.
     * @returns Prepara los datos y abre el diálogo.
     */
    function openCreateCategoryDialog(parent: MediaCategory | null = null) {
        if (!selectedLibrary || isLoading || activeControllerRef.current) {
            return;
        }

        setCategoryParent(parent);
        setNewCategoryName('');
        setCategoryCreationError('');
        createCategoryDialogRef.current?.showModal();
    }

    /** Cierra el formulario cuando no se está guardando. */
    function closeCreateCategoryDialog() {
        if (isCreatingCategory) {
            return;
        }

        createCategoryDialogRef.current?.close();
        setCategoryParent(null);
        setNewCategoryName('');
        setCategoryCreationError('');
    }

    /**
     * Guarda la categoría y aplica las categorías devueltas por el servidor.
     * @param event Envío del formulario de creación.
     * @returns Finalización de la operación y actualización de sus estados.
     */
    async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!selectedLibrary || isLoading || activeControllerRef.current) {
            return;
        }

        const name = newCategoryName.trim();

        if (!name || name.length > 80) {
            setCategoryCreationError(
                'El nombre debe tener entre 1 y 80 caracteres.');
            return;
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;

        setIsCreatingCategory(true);
        setIsLoading(true);
        setCategoryCreationError('');

        try {
            let library;

            if (categoryParent) {
                // Añade un hijo al grupo desde el que se abrió el formulario.
                library = await createSubcategoryRequest(
                    selectedLibrary.id,
                    categoryParent.id,
                    name,
                    controller.signal
                );
            } else {
                // Sin padre, crea una categoría principal.
                library = await createCategoryRequest(
                    selectedLibrary.id,
                    name,
                    controller.signal
                );
            }

            if (controller.signal.aborted) {
                return;
            }

            // La respuesta ya contiene la categoría guardada con su identificador.
            setSelectedLibrary(library);

            createCategoryDialogRef.current?.close();
            setNewCategoryName('');
            setCategoryParent(null);
        } catch (error) {
            if (!controller.signal.aborted) {
                setCategoryCreationError(errorMessage(error));
            }
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;

                if (!controller.signal.aborted) {
                    setIsCreatingCategory(false);
                    setIsLoading(false);
                }
            }
        }
    }


    // -------------------------- Movimiento entre grupos --------------------------

    /**
     * Guarda el nuevo destino y aplica las categorías devueltas por el servidor.
     * @param itemPath Ruta del elemento que cambia de grupo.
     * @param categoryId Destino; una cadena vacía representa «Sin categoría».
     * @returns Finalización de la operación y actualización de sus estados.
     */
    async function handleMoveItem(itemPath: string, categoryId: string) {
        if (!selectedLibrary || isLoading || activeControllerRef.current) {
            return;
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;

        setIsLoading(true);
        setMoveError('');

        try {
            // El carrusel representa «Sin categoría» con '', pero la API espera null.
            const targetCategoryId = categoryId || null;

            const library = await moveCategoryItemRequest(
                selectedLibrary.id,
                itemPath,
                targetCategoryId,
                controller.signal
            );

            if (controller.signal.aborted) {
                return;
            }

            setSelectedLibrary(library);
        } catch (error) {
            if (!controller.signal.aborted) {
                setMoveError(errorMessage(error));
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

    // ------------------------- Eliminación de categorías ------------------------

    /**
     * Conserva el grupo elegido y abre la confirmación.
     * @param group Categoría o subcategoría que se va a eliminar.
     * @returns Prepara los datos y abre el diálogo.
     */
    function openDeleteCategoryDialog(group: MediaCategory) {
        if (!selectedLibrary || isLoading || activeControllerRef.current) {
            return;
        }

        setCategoryToDelete(group);
        setDeleteCategoryError('');
        deleteCategoryDialogRef.current?.showModal();
    }

    /** Cierra la confirmación cuando no hay una eliminación en curso. */
    function closeDeleteCategoryDialog() {
        if (isDeletingCategory) {
            return;
        }

        deleteCategoryDialogRef.current?.close();
        setCategoryToDelete(null);
        setDeleteCategoryError('');
    }

    /**
     * Elimina el grupo y aplica la biblioteca actualizada.
     * @param event Envío de la confirmación de eliminación.
     * @returns Finalización de la operación y actualización de sus estados.
     */
    async function handleDeleteCategory(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!selectedLibrary || !categoryToDelete ||
            isLoading || activeControllerRef.current) {
            return;
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;

        setIsDeletingCategory(true);
        setIsLoading(true);
        setDeleteCategoryError('');

        try {
            const library = await deleteCategoryRequest(
                selectedLibrary.id,
                categoryToDelete.id,
                controller.signal
            );

            if (controller.signal.aborted) {
                return;
            }

            // Al actualizar las asignaciones, las elementos de la rama
            // eliminada vuelven a aparecer en «Sin categoría».
            setSelectedLibrary(library);

            deleteCategoryDialogRef.current?.close();
            setCategoryToDelete(null);
        } catch (error) {
            if (!controller.signal.aborted) {
                setDeleteCategoryError(errorMessage(error));
            }
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;

                if (!controller.signal.aborted) {
                    setIsDeletingCategory(false);
                    setIsLoading(false);
                }
            }
        }
    }


    // ------------------------- Renombrado de categorías --------------------------

    /**
     * Abre el formulario con el nombre actual del grupo.
     * @param group Categoría o subcategoría cuyo nombre se edita.
     * @returns Prepara los datos y abre el diálogo.
     */
    function openRenameCategoryDialog(group: MediaCategory) {
        if (!selectedLibrary || isLoading || activeControllerRef.current) {
            return;
        }

        setCategoryToRename(group);
        setEditedCategoryName(group.name);
        setRenameCategoryError('');
        renameCategoryDialogRef.current?.showModal();
    }

    /** Cierra el formulario cuando no se está guardando. */
    function closeRenameCategoryDialog() {
        if (isRenamingCategory) {
            return;
        }

        renameCategoryDialogRef.current?.close();
        setCategoryToRename(null);
        setEditedCategoryName('');
        setRenameCategoryError('');
    }

    /**
     * Guarda el nombre y aplica la biblioteca actualizada.
     * @param event Envío del formulario de renombrado.
     * @returns Finalización de la operación y actualización de sus estados.
     */
    async function handleRenameCategory(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!selectedLibrary || !categoryToRename ||
            isLoading || activeControllerRef.current) {
            return;
        }

        const name = editedCategoryName.trim();

        if (!name || name.length > 80) {
            setRenameCategoryError(
                'El nombre debe tener entre 1 y 80 caracteres.');
            return;
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;

        setIsRenamingCategory(true);
        setIsLoading(true);
        setRenameCategoryError('');

        try {
            const library = await renameCategoryRequest(
                selectedLibrary.id,
                categoryToRename.id,
                name,
                controller.signal
            );

            if (controller.signal.aborted) {
                return;
            }

            setSelectedLibrary(library);

            renameCategoryDialogRef.current?.close();
            setCategoryToRename(null);
            setEditedCategoryName('');
        } catch (error) {
            if (!controller.signal.aborted) {
                setRenameCategoryError(errorMessage(error));
            }
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;

                if (!controller.signal.aborted) {
                    setIsRenamingCategory(false);
                    setIsLoading(false);
                }
            }
        }
    }

    // -------------------------- Orden de los grupos -----------------------------

    /**
     * Guarda el desplazamiento y aplica el orden devuelto por el servidor.
     * @param group Grupo que se desplaza dentro de su nivel.
     * @param offset -1 para subir o 1 para bajar una posición.
     * @returns Finalización de la operación y actualización de sus estados.
     */
    async function handleReorderCategory(group: MediaCategory, offset: -1 | 1) {
        if (!selectedLibrary || isLoading || activeControllerRef.current) {
            return;
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;

        setIsLoading(true);
        setReorderError('');

        try {
            const library = await reorderCategoryRequest(
                selectedLibrary.id,
                group.id,
                offset,
                controller.signal
            );

            if (controller.signal.aborted) {
                return;
            }

            movedCategoryIdRef.current = group.id;

            setSelectedLibrary(library);
        } catch (error) {
            if (!controller.signal.aborted) {
                setReorderError(errorMessage(error));
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

    // ---------------------------- Datos para la vista ----------------------------

    // Junta las rutas de todas las categorías en una lista.
    const assignedPaths = new Set(
        categories.flatMap(category => collectItemPaths(category.itemPaths ?? [], category.subcategories ?? []))
            .map(normalizePathForComparison)
    );

    // Excluye los elementos asignados a cualquier grupo para obtener «Sin categoría».
    const uncategorizedItems = items.filter(item =>
        !assignedPaths.has(normalizePathForComparison(item.rutaCompleta))
    );

    // Incluye las categorías principales y todas sus subcategorías.
    const categoryDestinations = getCategoryDestinations(categories);

    /** Recupera el foco y mantiene visible el título del grupo tras reordenarlo. */
    useLayoutEffect(() => {
        const categoryId = movedCategoryIdRef.current;

        if (!categoryId) {
            return;
        }

        movedCategoryIdRef.current = null;

        const container = document.getElementById(`${groupIdPrefix}-${categoryId}`);
        const heading = container?.querySelector<HTMLElement>('.category-title-editable');

        if (heading) {
            heading.focus({ preventScroll: true });
            heading.scrollIntoView({
                block: 'center',
                inline: 'nearest'
            });
        }
    }, [categories, groupIdPrefix]);

    // ---------------------------- Resultado del hook -----------------------------

    return {
        // Categorías y destinos
        categories,
        categoryDestinations,
        uncategorizedItems,

        // Creación de categorías y subcategorías
        categoryParent,
        newCategoryName,
        setNewCategoryName,
        isCreatingCategory,
        categoryCreationError,
        setCategoryCreationError,
        createCategoryDialogRef,
        openCreateCategoryDialog,
        closeCreateCategoryDialog,
        handleCreateCategory,

        // Movimiento entre grupos
        moveError,
        handleMoveItem,

        // Eliminación de categorías y subcategorías
        categoryToDelete,
        isDeletingCategory,
        deleteCategoryError,
        deleteCategoryDialogRef,
        openDeleteCategoryDialog,
        closeDeleteCategoryDialog,
        handleDeleteCategory,

        // Renombrado de categorías y subcategorías
        editedCategoryName,
        setEditedCategoryName,
        isRenamingCategory,
        renameCategoryError,
        setRenameCategoryError,
        renameCategoryDialogRef,
        openRenameCategoryDialog,
        closeRenameCategoryDialog,
        handleRenameCategory,

        // Orden de los grupos
        reorderError,
        handleReorderCategory,
    };
}

export type UseCategoriesResult = ReturnType<typeof useCategories>;
