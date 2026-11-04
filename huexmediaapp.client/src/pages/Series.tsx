import type { MediaCategory } from '../utils/categoryUtils';
import type { LibraryLoadResult } from '../utils/libraryUtils';
import type { CategoryRowItem } from '../components/SeriesCategoryRow';
import type { SeriesPlaybackProgress, SeriesContinuationItem, LibraryPlaybackProgress } from '../utils/playbackProgress';
import { errorMessage } from '../utils/generalUtils';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SeriesCategoryRow from '../components/SeriesCategoryRow';
import HuexPageHeader from '../components/HuexPageHeader';
import { normalizePathForComparison } from '../utils/generalUtils';
import { getCategoryItems, countCategoryItems } from '../utils/categoryUtils';
import { CreateLibraryDialog, NameDialog, DeleteConfirmationDialog } from '../components/dialogs';
import { FolderIcon, ChevronDownIcon, PlusIcon, TrashIcon, EditIcon, VerticalArrowIcon } from '../components/Icons';
import '../css/HuexStyles.css';
import useLibraries from '../hooks/useLibraries';
import useCategories from '../hooks/useCategories';
import { buildContinueWatchingSeries, hideSeriesFromContinueWatching, resetSeriesProgress } from '../utils/playbackProgress';

// ------------------------- Propiedades de la página --------------------------

export interface SeriesProps {
    /** Series compartidas con App. */
    seriesList: import('../components/SeriesCategoryRow').CategoryRowItem[];
    /** Actualiza las series compartidas. */
    setSeriesList: import('react').Dispatch<import('react').SetStateAction<import('../components/SeriesCategoryRow').CategoryRowItem[]>>;
    /** Tamaño de las carátulas elegido en el header. */
    densityStyle: import('react').CSSProperties;
}

/**
 * Selecciona una biblioteca guardada y dibuja sus categorías y carátulas.
 * @param props Datos compartidos con App.
 */
function Series(props: SeriesProps) {
    const { seriesList, setSeriesList, densityStyle } = props;
    const navigate = useNavigate();

    // ------------------------- Estados de Progreso de series ----------------------------

    // Entradas de progreso de la biblioteca cargada.
    const [seriesProgress, setSeriesProgress] = useState<SeriesPlaybackProgress[]>([]);
    // Episodios en curso o siguientes pendientes de las series con progreso.
    const [continuingEpisodes, setContinuingEpisodes] = useState<SeriesContinuationItem[]>([]);


    // ------------------------- Estados de continuar viendo ----------------------------
    // Bloquea las papeleras mientras se guarda la ocultación.
    const [isHidingSeries, setIsHidingSeries] = useState(false);

    const [hideSeriesError, setHideSeriesError] = useState('');

    // ----------------------------- Reinicio de serie ----------------------------
    const [seriesToReset, setSeriesToReset] = useState<CategoryRowItem | null>(null);
    const [resetError, setResetError] = useState('');
    const [isResettingSeries, setIsResettingSeries] = useState(false);
    const resetDialogRef = useRef<HTMLDialogElement>(null);

    // ------------------------- Aplicación de la biblioteca -----------------------

    /**
     * Prepara la continuación y aplica las series y el progreso cargados por el hook.
     * @param result Documento de biblioteca y series disponibles.
     * @param progress Progreso guardado de esa biblioteca.
     * @param signal Cancelación compartida con la carga y el escaneo de episodios.
     * @returns Finalización de la preparación y actualización de los estados.
     */
    const applyLoadedLibrary = useCallback(async (
        result: LibraryLoadResult,
        progress: LibraryPlaybackProgress,
        signal: AbortSignal
    ): Promise<void> => {
        const episodes = await buildContinueWatchingSeries(
            result.library.id,
            result.items,
            progress.series,
            signal
        );

        if (signal.aborted) {
            return;
        }

        setContinuingEpisodes(episodes);
        setSeriesList(result.items);
        setSeriesProgress(progress.series);
    }, [setSeriesList]);

    // ---------------------------- Gestión de bibliotecas -------------------------

    /** Limpia las series, el progreso y los avisos de la biblioteca anterior. */
    const resetSeriesLibrary = useCallback((): void => {
        setHideSeriesError('');
        setResetError('');
        setSeriesList([]);
        setSeriesProgress([]);
        setContinuingEpisodes([]);
    }, [setSeriesList]);

    const libraryManager = useLibraries({
        mediaType: 'Series',
        onReset: resetSeriesLibrary,
        onLibraryLoaded: applyLoadedLibrary
    });

    const {
        // Consulta y biblioteca seleccionada
        libraries,
        selectedLibrary,
        isLoading,
        setIsLoading,
        loadError,

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
    } = libraryManager;

    // ------------------------- Gestión de categorías ----------------------------

    const {
        // Categorías y destinos
        categories,
        categoryDestinations,
        uncategorizedItems: uncategorizedSeries,

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
        handleMoveItem: handleMoveSeries,

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
    } = useCategories({
        libraryManager,
        items: seriesList,
        groupIdPrefix: 'series-group'
    });

    // ------------------------- Reproducción de series ------------------------

    /** Abre las temporadas y episodios conservando la biblioteca seleccionada. */
    function openSeries(serie: CategoryRowItem) {
        if (!selectedLibrary || isLoading || activeControllerRef.current) {
            return;
        }
        navigate('/series/episodes', {
            state: {
                folderPath: serie.rutaCompleta,
                seriesName: serie.nombre,
                libraryId: selectedLibrary.id
            }
        });
    }

    /** Reproduce el episodio pendiente o el siguiente ofrecido por Continuar viendo. */
    function continueEpisode(episode: SeriesContinuationItem) {
        if (!selectedLibrary || isLoading || activeControllerRef.current) {
            return;
        }
        navigate('/player', {
            state: {
                episode,
                mediaType: 'Series',
                libraryId: selectedLibrary.id,
                seriesPath: episode.seriesPath,
                startSeconds: episode.playbackProgress?.positionSeconds ?? 0
            }
        });
    }

    // ------------------------- Continuar viendo ------------------------
    /** Oculta la tarjeta conservando el progreso guardado de la serie. */
    async function handleHideSeries(episode: SeriesContinuationItem) {
        if (!selectedLibrary || isLoading || activeControllerRef.current ||
            !seriesProgress.some(item => normalizePathForComparison(item.seriesPath) ===
                normalizePathForComparison(episode.seriesPath))) {
            return;
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;

        setIsHidingSeries(true);
        setHideSeriesError('');

        try {
            const progress = await hideSeriesFromContinueWatching(
                selectedLibrary.id,
                episode.seriesPath,
                controller.signal
            );

            if (controller.signal.aborted) {
                return;
            }

            // El filtro de Continuar viendo retira la tarjeta marcada como oculta.
            setSeriesProgress(progress.series);
            setContinuingEpisodes(current => current.filter(item =>
                normalizePathForComparison(item.seriesPath) !== normalizePathForComparison(episode.seriesPath)));
        } catch (error) {
            if (!controller.signal.aborted) {
                setHideSeriesError(errorMessage(error));
            }
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;

                if (!controller.signal.aborted) {
                    setIsHidingSeries(false);
                }
            }
        }
    }


    // ----------------------------- Reinicio de serie ----------------------------

    /** Solicita confirmación antes de borrar los vistos y el episodio en curso. */
    function requestResetSeries(serie: CategoryRowItem) {
        if (!selectedLibrary || isLoading || activeControllerRef.current) {
            return;
        }
        setSeriesToReset(serie);
        setResetError('');
        resetDialogRef.current?.showModal();
    }

    /** Cierra la confirmación cuando no hay un reinicio en curso. */
    function closeResetDialog() {
        if (!isResettingSeries) {
            resetDialogRef.current?.close();
            setSeriesToReset(null);
        }
    }

    /** Reinicia la serie y retira su tarjeta de continuar viendo. */
    async function handleResetSeries(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedLibrary || !seriesToReset || activeControllerRef.current) {
            return;
        }
        const controller = new AbortController();
        activeControllerRef.current = controller;
        setIsResettingSeries(true);
        setIsLoading(true);
        setResetError('');
        try {
            const progress = await resetSeriesProgress(
                selectedLibrary.id, seriesToReset.rutaCompleta, controller.signal);
            if (controller.signal.aborted) {
                return;
            }
            setSeriesProgress(progress.series);
            setContinuingEpisodes(current => current.filter(item =>
                normalizePathForComparison(item.seriesPath) !==
                normalizePathForComparison(seriesToReset.rutaCompleta)));
            resetDialogRef.current?.close();
            setSeriesToReset(null);
        } catch (error) {
            if (!controller.signal.aborted) {
                setResetError(errorMessage(error));
            }
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;
                if (!controller.signal.aborted) {
                    setIsResettingSeries(false);
                    setIsLoading(false);
                }
            }
        }
    }

    // ------------------------- Renderizado de los grupos -------------------------

    /** Dibuja el grupo y sus hijos; recibe su posición y el número de grupos de su lista. */
    function renderGroups(group: MediaCategory, depth: number, groupIndex: number, groupCount: number): React.JSX.Element {
        // El nivel 1 es una categoría principal. Los siguientes niveles son subcategorías.
        const isCategory = depth === 1;
        const children = group.subcategories ?? [];
        const directSeries = getCategoryItems(seriesList, group.itemPaths ?? []);

        // El nivel determina el título HTML y el estilo del contenedor.
        // Categoría = h3, subcategoría = h4, siguiente nivel = h5; el máximo HTML es h6.
        const Heading = `h${Math.min(depth + 2, 6)}` as "h3" | "h4" | "h5" | "h6";
        const className = isCategory
            ? 'movies-category-group'
            : `movies-subcategory-group${depth > 2 ? ' is-nested' : ''}`;

        // Prepara el carrusel de series directas y los contenedores de los hijos.
        // Este fragmento agrupa JSX sin añadir un elemento extra al DOM.
        const content = (
            <>
                {(directSeries.length > 0 || children.length === 0) && (
                    <SeriesCategoryRow
                        title={group.name}
                        showHeader={false}
                        series={directSeries}
                        typeVariant="serie"

                        // Movimiento
                        categoryId={group.id}
                        categories={categoryDestinations}
                        onMoveSeries={isLoading ? undefined : handleMoveSeries}

                        // Seleccion
                        onSelectSeries={openSeries}
                        onResetSeries={isLoading ? undefined : requestResetSeries}
                    />
                )}

                {/* Cada hijo usa esta misma función con un nivel más.
                    Cuando no hay hijos, map devuelve un array vacío y termina esta rama. */}
                {children.map((child, index) => {
                    return renderGroups(child, depth + 1,index,children.length);
                })}
            </>
        );

        return (
            <section
                key={group.id}
                id={`series-group-${group.id}`}
                className={className}
                aria-label={group.name}
            >
                {/* La cabecera contiene el nombre y el total de series de toda la rama. */}
                <div className="movies-category-group-header">
                    <Heading
                        className="huex-title category-title-editable"
                        tabIndex={0}
                        aria-label={`${group.name}. Doble clic o F2 para cambiar el nombre`}
                        onDoubleClick={() => {
                            openRenameCategoryDialog(group);
                        }}
                        onKeyDown={event => {
                            if (event.key === 'F2' || event.key === 'Enter') {
                                event.preventDefault();
                                openRenameCategoryDialog(group);
                            }
                        }}
                    >
                        {group.name}
                    </Heading>
                    <span className="series-category-count">{countCategoryItems(seriesList, group)}</span>

                    {/* Boton de crear subcategoria */}
                    <button
                        type="button"
                        className="movies-add-subcategory"
                        disabled={isLoading}
                        aria-label={`Crear subcategoría en ${group.name}`}
                        data-tooltip="Nueva subcategoría"
                        onClick={() => {
                            openCreateCategoryDialog(group);
                        }}
                    >
                        <PlusIcon size={18} />
                    </button>

                    {/* Sube una posición dentro de la lista del mismo padre. */}
                    <button
                        type="button"
                        className="movies-add-subcategory movies-reorder-group"
                        disabled={isLoading || groupIndex === 0}
                        aria-label={`Subir ${group.name}`}
                        data-tooltip="Subir"
                        onClick={() => {
                            void handleReorderCategory(group, -1);
                        }}
                    >
                        <VerticalArrowIcon direction="up" />
                    </button>

                    {/* Baja una posición dentro de la lista del mismo padre. */}
                    <button
                        type="button"
                        className="movies-add-subcategory movies-reorder-group"
                        disabled={isLoading || groupIndex === groupCount - 1}
                        aria-label={`Bajar ${group.name}`}
                        data-tooltip="Bajar"
                        onClick={() => {
                            void handleReorderCategory(group, 1);
                        }}
                    >
                        <VerticalArrowIcon direction="down" />
                    </button>
                    {/* Boton de eliminar subcategoria */}
                    <button
                        type="button"
                        className="movies-add-subcategory movies-delete-group"
                        disabled={isLoading}
                        aria-label={`Eliminar ${group.name}`}
                        data-tooltip="Eliminar grupo"
                        onClick={() => {
                            openDeleteCategoryDialog(group);
                        }}
                    >
                        <TrashIcon />
                    </button>
                </div>

                {/* Las categorías conservan su contenedor interior; las subcategorías muestran el contenido directamente. */}
                {isCategory ? (
                    <div className="movies-category-group-content">
                        {content}
                    </div>
                ) : (
                    content
                )}
            </section>
        );
    }

    // ------------------------- Renderizado de la página --------------------------

    return (
        <div className="huex-container huex-series-page huex-density-library" style={densityStyle}>
            {/* densityStyle aplica al contenedor el número de columnas elegido desde el header general. */}
            <HuexPageHeader
                title="Mis series"
                outlinedTitle
                titleAccessory={(
                    <div className="movies-library-selector">
                        {/* Reserva el ancho del nombre más largo junto a sus botones. */}
                        <div className="movies-library-size-guide" aria-hidden="true">
                            <span>Crear / Seleccionar una biblioteca</span>
                            {libraries.map(library => (
                                <span key={library.id}>{library.name}</span>
                            ))}
                        </div>
                            <details ref={librarySelectorRef} className="movies-library-dropdown">
                                <summary aria-label="Biblioteca de series">
                                    <FolderIcon size={18} />
                                    <span className={!selectedLibrary ? 'movies-library-placeholder' : undefined}>
                                        {selectedLibrary?.name ?? 'Crear / Seleccionar una biblioteca'}
                                    </span>
                                    <span className="movies-library-chevron"><ChevronDownIcon /></span>
                                </summary>
                                <div className="movies-library-options" aria-label="Bibliotecas disponibles">
                                    {libraries.map(library => (
                                        <div key={library.id} className="movies-library-option-row">
                                            <button
                                                type="button"
                                                className="movies-library-select"
                                                disabled={isLoading}
                                                aria-pressed={library.id === selectedLibrary?.id}
                                                onClick={() => {
                                                    closeLibrarySelector();
                                                    void selectLibrary(library.id);
                                                }}
                                            >
                                                <FolderIcon size={18} />
                                                <span>{library.name}</span>
                                            </button>

                                            <button
                                                type="button"
                                                className="movies-library-action movies-library-rename"
                                                disabled={isLoading}
                                                aria-label={`Renombrar biblioteca ${library.name}`}
                                                onClick={() => {
                                                    openRenameLibraryDialog(library);
                                                }}
                                            >
                                                <EditIcon />
                                            </button>

                                            <button
                                                type="button"
                                                className="movies-library-delete"
                                                disabled={isLoading}
                                                aria-label={`Eliminar biblioteca ${library.name}`}
                                                onClick={() => {
                                                    openDeleteLibraryDialog(library);
                                                }}
                                            >
                                                <TrashIcon size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className="movies-library-create"
                                        disabled={isLoading}
                                        onClick={() => {
                                            librarySelectorRef.current!.open = false;
                                            librarySelectorRef.current!.querySelector<HTMLElement>('summary')?.focus();
                                            void handleSelectFolder();
                                        }}
                                    >
                                        <PlusIcon size={18} />
                                        <span>Crear nueva biblioteca</span>
                                    </button>
                                </div>
                            </details>
                    </div>
                )}
            />

            {/* Formulario compartido para crear una biblioteca. */}
            <CreateLibraryDialog
                dialogRef={createLibraryDialogRef}
                title="Nueva biblioteca de series"
                libraryPath={newLibraryPath}
                name={newLibraryName}
                error={creationError}
                isSaving={isCreating}
                onNameChange={name => {
                    setNewLibraryName(name);
                    setCreationError('');
                }}
                onSubmit={handleCreateLibrary}
                onCancel={closeCreateLibraryDialog}
            />
            {/* Formulario compartido para eliminar una biblioteca. */}
            <DeleteConfirmationDialog
                dialogRef={deleteLibraryDialogRef}
                title={libraryToDelete ? `Eliminar «${libraryToDelete.name}»` : 'Eliminar biblioteca'}
                message="Se eliminará la biblioteca guardada con todas sus categorías y asignaciones. Los archivos de vídeo se conservarán."
                error={deleteLibraryError}
                isDeleting={isDeletingLibrary}
                onSubmit={handleDeleteLibrary}
                onCancel={closeDeleteLibraryDialog}
            />

            {/* Formulario compartido para renombrar una biblioteca. */}
            <NameDialog
                dialogRef={renameLibraryDialogRef}
                title="Cambiar nombre de biblioteca"
                nameLabel="Nombre de la biblioteca"
                submitLabel="Guardar"
                savingLabel="Guardando…"
                name={editedLibraryName}
                error={renameLibraryError}
                isSaving={isRenamingLibrary}
                onNameChange={name => {
                    setEditedLibraryName(name);
                    setRenameLibraryError('');
                }}
                onSubmit={handleRenameLibrary}
                onCancel={closeRenameLibraryDialog}
            />

            {/* Formulario compartido para crear una nueva categoría o subcategoría. */}
            <NameDialog
                dialogRef={createCategoryDialogRef}
                name={newCategoryName}
                title={categoryParent ? `Nueva subcategoría en «${categoryParent.name}»` : 'Nueva categoría'}
                nameLabel={categoryParent ? 'Nombre de la subcategoría' : 'Nombre de la categoría'}
                submitLabel={categoryParent ? 'Crear subcategoría' : 'Crear categoría'}
                error={categoryCreationError}
                isSaving={isCreatingCategory}
                onNameChange={name => {
                    setNewCategoryName(name);
                    setCategoryCreationError('');
                }}
                onSubmit={handleCreateCategory}
                onCancel={closeCreateCategoryDialog}
            />
            {/* Formulario compartido para eliminar categorías o subcategorías. */}
            <DeleteConfirmationDialog
                dialogRef={deleteCategoryDialogRef}
                title={categoryToDelete ? `Eliminar «${categoryToDelete.name}»` : 'Eliminar grupo'}
                message="Se eliminará este grupo con todas sus subcategorías. Sus series pasarán a «Sin categoría». Los archivos de vídeo se conservarán."
                error={deleteCategoryError}
                isDeleting={isDeletingCategory}
                onSubmit={handleDeleteCategory}
                onCancel={closeDeleteCategoryDialog}
            />

            {/* Formulario compartido para cambiar el nombre de categorías o subcategorías. */}
            <NameDialog
                dialogRef={renameCategoryDialogRef}
                title="Cambiar nombre"
                nameLabel="Nombre del grupo"
                submitLabel="Guardar"
                savingLabel="Guardando…"
                name={editedCategoryName}
                error={renameCategoryError}
                isSaving={isRenamingCategory}
                onNameChange={name => {
                    setEditedCategoryName(name);
                    setRenameCategoryError('');
                }}
                onSubmit={handleRenameCategory}
                onCancel={closeRenameCategoryDialog}
            />

            {/* Formulario compartido para resetear la visualizacion de una serie. */}
            <DeleteConfirmationDialog
                dialogRef={resetDialogRef}
                title={seriesToReset ? `Reiniciar «${seriesToReset.nombre}»` : 'Reiniciar serie'}
                message="Todos sus episodios pasarán a no vistos y se borrará el minuto guardado."
                confirmLabel="Reiniciar"
                pendingLabel="Reiniciando…"
                error={resetError}
                isDeleting={isResettingSeries}
                onSubmit={handleResetSeries}
                onCancel={closeResetDialog}
            />


            {isLoading && <p role="status">Cargando biblioteca…</p>}
            {loadError && <p role="alert">{loadError}</p>}
            {moveError && <p role="alert">{moveError}</p>}
            {reorderError && <p role="alert">{reorderError}</p>}
            {hideSeriesError && <p role="alert">{hideSeriesError}</p>}

            {!isLoading && !loadError && libraries.length === 0 && (
                <p>No hay bibliotecas de series guardadas.</p>
            )}

            {!isLoading && !loadError && libraries.length > 1 && !selectedLibrary && (
                <p>Selecciona la biblioteca que quieres cargar.</p>
            )}

            {/* El contenido se muestra cuando una biblioteca ha terminado de cargarse. */}
            {selectedLibrary && (
                <>

                    {/* Series pendientes de terminar. */}
                    {!isLoading && continuingEpisodes.length > 0 && (
                        <SeriesCategoryRow
                            title="Continuar viendo"
                            series={continuingEpisodes}
                            cardVariant="horizontal"
                            typeVariant="serie"
                            onSelectSeries={continueEpisode}
                            onRemoveItem={handleHideSeries}
                            actionsDisabled={isHidingSeries}
                        />
                    )}

                    {categories.map((category, index) => {return renderGroups(category,1,index, categories.length);})}

                    <button
                        type="button"
                        className="library-add-category-panel"
                        disabled={isLoading}
                        onClick={() => {
                            openCreateCategoryDialog(); // Hacemos una lamda para evitar que react le pase el evento del click como si fuera el padre que espara como parametro.
                        }}
                    >
                        <PlusIcon />
                        <span>NUEVA CATEGORÍA</span>
                    </button>

                    {seriesList.length === 0 ? (
                        <div className="empty-state">
                            <h3 style={{ color: '#ffffff', fontSize: '1.5rem', margin: '0 0 10px 0' }}>
                                No hay series en esta biblioteca
                            </h3>
                            <p style={{ color: '#8c8c8c' }}>{selectedLibrary.libraryPath}</p>
                        </div>
                    ) : (
                        <SeriesCategoryRow
                            title="Sin categoría"
                            series={uncategorizedSeries}
                            typeVariant="serie"

                            // Movimiento
                            categoryId=""
                            categories={categoryDestinations}
                            onMoveSeries={isLoading ? undefined : handleMoveSeries}

                            // Seleccion
                            onSelectSeries={openSeries}
                            onResetSeries={isLoading ? undefined : requestResetSeries}
                        />
                    )}
                </>
            )}
        </div>
    );
}

export default Series;
