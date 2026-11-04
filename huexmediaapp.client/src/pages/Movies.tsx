import type { MediaCategory } from '../utils/categoryUtils';
import type { CategoryRowItem } from '../components/SeriesCategoryRow';
import type { MoviePlaybackProgress, LibraryPlaybackProgress } from '../utils/playbackProgress';
import { errorMessage } from '../utils/generalUtils';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SeriesCategoryRow from '../components/SeriesCategoryRow';
import HuexPageHeader from '../components/HuexPageHeader';
import { formatProgressTime, normalizePathForComparison } from '../utils/generalUtils';
import type { LibraryLoadResult } from '../utils/libraryUtils';
import { getCategoryItems, countCategoryItems } from '../utils/categoryUtils';
import { CreateLibraryDialog, NameDialog, DeleteConfirmationDialog, ResumePlaybackDialog } from '../components/dialogs';
import { FolderIcon, ChevronDownIcon, PlusIcon, TrashIcon, EditIcon, VerticalArrowIcon } from '../components/Icons';
import '../css/HuexStyles.css';
import { buildContinueWatchingMovies, hideMovieFromContinueWatching } from '../utils/playbackProgress';

import useLibraries from '../hooks/useLibraries';
import useCategories from '../hooks/useCategories';

// ------------------------- Propiedades de la página --------------------------

export interface MoviesProps {
    /** Películas compartidas con App. */
    moviesList: import('../components/SeriesCategoryRow').CategoryRowItem[];
    /** Actualiza las películas compartidas. */
    setMoviesList: import('react').Dispatch<import('react').SetStateAction<import('../components/SeriesCategoryRow').CategoryRowItem[]>>;
    /** Tamaño de las carátulas elegido en el header. */
    densityStyle: import('react').CSSProperties;
}

/**
 * Selecciona una biblioteca guardada y dibuja sus categorías y carátulas.
 * @param props Datos compartidos con App.
 */
function Movies(props: MoviesProps) {
    const { moviesList, setMoviesList, densityStyle } = props;
    const navigate = useNavigate();

    // ------------------------- Estados de Progreso de películas ----------------------------

    // Entradas de progreso de la biblioteca cargada.
    const [moviesProgress, setMoviesProgress] = useState<MoviePlaybackProgress[]>([]);

    // Película y posición pendientes de elegir entre continuar o empezar de nuevo.
    const [movieToResume, setMovieToResume] = useState<{ movie: CategoryRowItem; positionSeconds: number } | null>(null);

    const resumeMovieDialogRef = useRef<HTMLDialogElement>(null);

    // ------------------------- Estados de continuar viendo ----------------------------

    // Bloquea las papeleras mientras se guarda la ocultación.
    const [isHidingMovie, setIsHidingMovie] = useState(false);

    const [hideMovieError, setHideMovieError] = useState('');


    // -------------------------- Aplicación de la biblioteca --------------------------

    /**
     * Aplica las películas y el progreso que ha consultado el hook.
     * @param result Biblioteca y elementos obtenidos del escaneo.
     * @param progress Progreso guardado de esa biblioteca.
     * @returns Actualiza los estados utilizados para dibujar la página.
     */
    const applyLoadedLibrary = useCallback((
        result: LibraryLoadResult,
        progress: LibraryPlaybackProgress
    ): void => {
        setMoviesList(result.items);
        setMoviesProgress(progress.movies);
    }, [setMoviesList]);

    // ---------------------------- Gestión de bibliotecas -------------------------

    /** Limpia el contenido y los errores antes de consultar las bibliotecas. */
    const resetMovieLibrary = useCallback((): void => {
        setHideMovieError('');
        setMoviesList([]);
        setMoviesProgress([]);
    }, [setMoviesList]);


    // El hook consulta las bibliotecas y decide cuál cargar al entrar.
    // Movies aplica a sus estados el contenido y progreso recibidos.
    const libraryManager = useLibraries({
        mediaType: 'Movies',
        onReset: resetMovieLibrary,
        onLibraryLoaded: applyLoadedLibrary
    });

    const {
        // Consulta y biblioteca seleccionada
        libraries,
        selectedLibrary,
        isLoading,
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
        uncategorizedItems: uncategorizedMovies,

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
        handleMoveItem: handleMoveMovie,

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
        items: moviesList,
        groupIdPrefix: 'movies-group'
    });

    // ------------------------- Reproducción de películas ------------------------

    /** Navega al reproductor desde la posición indicada. */
    function playMovie(movie: CategoryRowItem, startSeconds = 0) {
        if (!selectedLibrary || isLoading || activeControllerRef.current) {
            return;
        }

        navigate('/player', {
            state: {
                episode: movie,
                mediaType: 'Movies',
                libraryId: selectedLibrary.id,
                startSeconds
            }
        });
    }

    /** Reanuda directamente desde la tarjeta de «Continuar viendo». */
    function continueMovie(movie: CategoryRowItem) {
        playMovie(
            movie,
            movie.playbackProgress?.positionSeconds ?? 0
        );
    }
    /** Ofrece continuar si la película está empezada y todavía no está vista. */
    function handleSelectMovie(movie: CategoryRowItem) {
        if (!selectedLibrary || isLoading || activeControllerRef.current) {
            return;
        }

        const progress = moviesProgress.find(item => {
            return normalizePathForComparison(item.moviePath) ===
                normalizePathForComparison(movie.rutaCompleta);
        });

        if (progress && !progress.watched &&
            progress.positionSeconds > 0 &&
            progress.positionSeconds < progress.durationSeconds) {
            setMovieToResume({
                movie,
                positionSeconds: progress.positionSeconds
            });

            resumeMovieDialogRef.current?.showModal();
        } else {
            playMovie(movie);
        }
    }

    /** Cierra la elección sin iniciar la reproducción. */
    function closeResumeMovieDialog() {
        resumeMovieDialogRef.current?.close();
        setMovieToResume(null);
    }

    /** Reproduce desde el minuto guardado. */
    function resumeSelectedMovie() {
        if (!movieToResume) {
            return;
        }

        const { movie, positionSeconds } = movieToResume;

        closeResumeMovieDialog();
        playMovie(movie, positionSeconds);
    }

    /** Reproduce desde el principio. */
    function restartSelectedMovie() {
        if (!movieToResume) {
            return;
        }

        const movie = movieToResume.movie;

        closeResumeMovieDialog();
        playMovie(movie);
    }


    // ------------------------- Continuar viendo ------------------------
    /** Oculta la tarjeta conservando el progreso guardado de la película. */
    async function handleHideMovie(movie: CategoryRowItem) {
        if (!selectedLibrary || isLoading || activeControllerRef.current) {
            return;
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;

        setIsHidingMovie(true);
        setHideMovieError('');

        try {
            const progress = await hideMovieFromContinueWatching(
                selectedLibrary.id,
                movie.rutaCompleta,
                controller.signal
            );

            if (controller.signal.aborted) {
                return;
            }

            // El filtro de Continuar viendo retira la tarjeta marcada como oculta.
            setMoviesProgress(progress.movies);
        } catch (error) {
            if (!controller.signal.aborted) {
                setHideMovieError(errorMessage(error));
            }
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;

                if (!controller.signal.aborted) {
                    setIsHidingMovie(false);
                }
            }
        }
    }


    // ---------------------------- Datos para la vista ----------------------------

    // Películas empezadas y pendientes de terminar, con las más recientes primero.
    const continuingMovies = buildContinueWatchingMovies(
        moviesList,
        moviesProgress
    );
    // ------------------------- Renderizado de los grupos -------------------------

    /** Dibuja el grupo y sus hijos; recibe su posición y el número de grupos de su lista. */
    function renderGroups(group: MediaCategory, depth: number, groupIndex: number, groupCount: number): React.JSX.Element {
        // El nivel 1 es una categoría principal. Los siguientes niveles son subcategorías.
        const isCategory = depth === 1;
        const children = group.subcategories ?? [];
        const directMovies = getCategoryItems(moviesList, group.itemPaths ?? []);

        // El nivel determina el título HTML y el estilo del contenedor.
        // Categoría = h3, subcategoría = h4, siguiente nivel = h5; el máximo HTML es h6.
        const Heading = `h${Math.min(depth + 2, 6)}` as "h3" | "h4" | "h5" | "h6";
        const className = isCategory
            ? 'movies-category-group'
            : `movies-subcategory-group${depth > 2 ? ' is-nested' : ''}`;

        // Prepara el carrusel de películas directas y los contenedores de los hijos.
        // Este fragmento agrupa JSX sin añadir un elemento extra al DOM.
        const content = (
            <>
                {(directMovies.length > 0 || children.length === 0) && (
                    <SeriesCategoryRow
                        title={group.name}
                        showHeader={false}
                        series={directMovies}
                        typeVariant="película"

                        // Movimiento
                        categoryId={group.id}
                        categories={categoryDestinations}
                        onMoveSeries={isLoading ? undefined : handleMoveMovie}

                        // Seleccion
                        onSelectSeries={handleSelectMovie}
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
                id={`movies-group-${group.id}`}
                className={className}
                aria-label={group.name}
            >
                {/* La cabecera contiene el nombre y el total de películas de toda la rama. */}
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
                    <span className="series-category-count">{countCategoryItems(moviesList, group)}</span>

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
        <div className="huex-container huex-movies-page huex-density-library" style={densityStyle}>
            {/* densityStyle aplica al contenedor el número de columnas elegido desde el header general. */}
            <HuexPageHeader
                title="Mis películas"
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
                                <summary aria-label="Biblioteca de películas">
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
                title="Nueva biblioteca de películas"
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
                message="Se eliminará este grupo con todas sus subcategorías. Sus películas pasarán a «Sin categoría». Los archivos de vídeo se conservarán."
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

            {/* Formulario compartido para iniciar reproduccion. */}
            <ResumePlaybackDialog
                dialogRef={resumeMovieDialogRef}
                name={movieToResume?.movie.nombre ?? ''}
                positionLabel={formatProgressTime(
                    movieToResume?.positionSeconds ?? 0
                )}
                onCancel={closeResumeMovieDialog}
                onRestart={restartSelectedMovie}
                onResume={resumeSelectedMovie}
            />

            {isLoading && <p role="status">Cargando biblioteca…</p>}
            {loadError && <p role="alert">{loadError}</p>}
            {moveError && <p role="alert">{moveError}</p>}
            {reorderError && <p role="alert">{reorderError}</p>}
            {hideMovieError && <p role="alert">{hideMovieError}</p>}

            {!isLoading && !loadError && libraries.length === 0 && (
                <p>No hay bibliotecas de películas guardadas.</p>
            )}

            {!isLoading && !loadError && libraries.length > 1 && !selectedLibrary && (
                <p>Selecciona la biblioteca que quieres cargar.</p>
            )}

            {/* El contenido se muestra cuando una biblioteca ha terminado de cargarse. */}
            {selectedLibrary && (
                <>

                    {/* Películas pendientes de terminar. */}
                    {!isLoading && continuingMovies.length > 0 && (
                        <SeriesCategoryRow
                            title="Continuar viendo"
                            series={continuingMovies}
                            cardVariant="horizontal"
                            typeVariant="película"
                            onSelectSeries={continueMovie}
                            onRemoveItem={handleHideMovie}
                            actionsDisabled={isHidingMovie}
                        />
                    )}

                    {/*Prueba de 1 o varias categorias*/} {/*categories.slice(0, 3).map(category => renderGroups(category, 1))*/}
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

                    {moviesList.length === 0 ? (
                        <div className="empty-state">
                            <h3 style={{ color: '#ffffff', fontSize: '1.5rem', margin: '0 0 10px 0' }}>
                                No hay películas en esta biblioteca
                            </h3>
                            <p style={{ color: '#8c8c8c' }}>{selectedLibrary.libraryPath}</p>
                        </div>
                    ) : (
                        <SeriesCategoryRow
                            title="Sin categoría"
                            series={uncategorizedMovies}
                            typeVariant="película"

                            // Movimiento
                            categoryId=""
                            categories={categoryDestinations}
                            onMoveSeries={isLoading ? undefined : handleMoveMovie}

                            // Seleccion
                            onSelectSeries={handleSelectMovie}
                        />
                    )}
                </>
            )}
        </div>
    );
}

export default Movies;
