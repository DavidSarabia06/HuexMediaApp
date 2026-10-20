
import { useCallback, useEffect, useRef, useState } from 'react';
//import { useNavigate } from 'react-router-dom';
import SeriesCategoryRow from './SeriesCategoryRow';
import HuexPageHeader from './HuexPageHeader';
//import { loadContinueWatching, waitForProgressSaves } from './playbackProgress';
import './css/HuexStyles.css';

// --------------------------- Funciones auxiliares ----------------------------

/** Lee el JSON y convierte respuestas HTTP fallidas o vacías en errores para la página. */
async function readJson(response) {
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(body?.error ?? body?.message ?? `La solicitud ha fallado (HTTP ${response.status}).`);
    }
    if (body === null) {
        throw new Error('El servidor ha devuelto una respuesta no válida.');
    }
    return body;
}

/** Carga películas y categorías en paralelo y después obtiene los elementos de «Continuar viendo». */
async function loadLibrary(libraryPath, signal) {
    const encodedPath = encodeURIComponent(libraryPath);
    const [movies, categories] = await Promise.all([
        fetch(`/api/movies/scan?path=${encodedPath}`, { signal }).then(readJson),
        fetch(`/api/MoviesCategory?libraryPath=${encodedPath}`, { signal }).then(readJson)
    ]);
    if (!Array.isArray(movies) || !Array.isArray(categories)) {
        throw new Error('No se ha podido leer la organización de la biblioteca.');
    }

    /*const continuingEpisodes = await loadContinueWatching(libraryPath, series, signal);*/
    return { movies, categories, /*continuingEpisodes*/ };
}

/** Unifica barras, elimina las finales y convierte a mayúsculas para comparar rutas. */
function normalizePathForComparison(path) {
    return path.replaceAll('/', '\\').replace(/\\+$/, '').toUpperCase();
}
/**
 * @typedef {Object} SeriesProps
 * @property {import('./SeriesCategoryRow').CategoryRowItem[]} seriesList Elementos de la biblioteca compartidos con App.
 * @property {import('react').Dispatch<import('react').SetStateAction<import('./SeriesCategoryRow').CategoryRowItem[]>>} setSeriesList Actualiza la lista compartida.
 */

/**
 * Gestiona la biblioteca de series, sus categorías y las confirmaciones de las acciones.
 * @param {SeriesProps} props Propiedades de la página.
 */
function Movies(props) {
    const { moviesList, setMoviesList } = props;
    // Carga inicial o cambio de carpeta en curso.
    const [isLoading, setIsLoading] = useState(true);
    // La biblioteca se ha cargado y permite editar su organización.
    const [isReady, setIsReady] = useState(false);
    // Carpeta de la biblioteca que se está mostrando.
    const [libraryPath, setLibraryPath] = useState('');
    // Categorías y asignaciones recibidas del servidor.
    const [categories, setCategories] = useState([]);
    // Episodios que aparecen en «Continuar viendo».
   // const [continuingEpisodes, setContinuingEpisodes] = useState([]);
    const [loadError, setLoadError] = useState('');
    // Incrementarlo vuelve a ejecutar la carga de la biblioteca.
    const [loadAttempt, setLoadAttempt] = useState(0);

    // Hay un cambio de categorías o progreso pendiente de guardar.
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    // Bloquea operaciones simultáneas sin esperar al siguiente renderizado.
    const busyRef = useRef(false);

    // Nombre escrito en el formulario de nueva categoría.
    const [categoryName, setCategoryName] = useState('');
    const [categoryError, setCategoryError] = useState('');
    const categoryDialogRef = useRef(null);
    // Categoría de destino; null indica que se está creando una categoría principal.
    const [subcategoryParent, setSubcategoryParent] = useState(null);

    // Categoría elegida para confirmar su eliminación.

    //const deleteCategoryDialogRef = useRef(null);



    //const navigate = useNavigate();

    // -------------------------- Carga de la biblioteca ---------------------------

    /** Aplica los datos cargados, limpia los errores de edición y habilita las acciones de biblioteca. */
    const applyLibraryData = useCallback(function applyLibraryData(path, data) {
        setMoviesList(data.movies);
        setCategories(data.categories);
        //setContinuingEpisodes(data.continuingEpisodes);
        setLibraryPath(path);
        //setCategoryError('');
        setSaveError('');
        setIsReady(true);
    }, [setMoviesList]);

    // Al montar o reintentar, carga la biblioteca configurada usando una señal de cancelación.
    // La limpieza cancela las peticiones de este efecto al repetirlo o salir de la página.
    useEffect(() => {
        const controller = new AbortController();
        /** Lee la carpeta guardada, carga sus datos y los aplica si la petición sigue vigente. */
        async function loadConfiguredLibrary() {
            setIsLoading(true);
            setIsReady(false);
            setLoadError('');
            try {
                const configuration = await fetch('/api/configuration/get?key=MoviesLibraryPath', {
                    signal: controller.signal
                }).then(readJson);
                const libraryData = await loadLibrary(configuration.value, controller.signal);
                if (controller.signal.aborted) {
                    return;
                }
                applyLibraryData(configuration.value, libraryData);
            } catch (error) {
                if (!controller.signal.aborted) {
                    setLoadError(error.message);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }
        void loadConfiguredLibrary();

        return () => controller.abort();
    }, [applyLibraryData, loadAttempt]);

    // --------------------------- Selección de carpeta ----------------------------

    /** Abre el selector, carga la carpeta elegida y guarda su ruta antes de mostrar la nueva biblioteca. */
    async function handleSelectFolder() {
        if (busyRef.current || isLoading) {
            return;
        }
        busyRef.current = true;
        setIsLoading(true);
        setLoadError('');
        try {
            const selection = await fetch('/api/movies/select-folder').then(readJson);
            if (!selection.ruta) {
                return;
            }
            const libraryData = await loadLibrary(selection.ruta);
            await fetch('/api/configuration/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'MoviesLibraryPath', value: selection.ruta })
            }).then(readJson);
            // Solo cambia de biblioteca después de cargar sus categorías y guardar la ruta.
            applyLibraryData(selection.ruta, libraryData);
        } catch (error) {
            setLoadError(error.message);
        } finally {
            busyRef.current = false;
            setIsLoading(false);
        }
    }
 
    // -------------------------- Creación de categorías ---------------------------

    /** Prepara el diálogo para crear una categoría o una subcategoría del destino recibido. */
    function openCreateCategoryDialog(parent = null) {
        setSubcategoryParent(parent);
        setCategoryName('');
        setCategoryError('');
        categoryDialogRef.current.showModal();
    }

    /** Actualiza el nombre y retira el aviso del formulario. */
    function handleCategoryNameChange(event) {
        setCategoryName(event.target.value);
        setCategoryError('');
    }

    /** Solicita la creación y aplica la lista confirmada por el servidor. */
    async function handleCreateCategory(event) {
        event.preventDefault();
        if (busyRef.current || isLoading || !isReady) {
            return;
        }
        const name = categoryName.trim();
        if (!name || name.length > 80) {
            setCategoryError('El nombre debe tener entre 1 y 80 caracteres.');
            return;
        }
        busyRef.current = true;
        setIsSaving(true);
        setCategoryError('');
        setSaveError('');
        try {
            const url = subcategoryParent ? '/api/MoviesCategory/subcategories' : '/api/MoviesCategory';
            const request = subcategoryParent
                ? { libraryPath, categoryId: subcategoryParent.id, subcategoryName: name }
                : { libraryPath, categoryName: name };
            const updatedCategories = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            }).then(readJson);
            setCategories(updatedCategories);
            categoryDialogRef.current.close();
        } catch (error) {
            setCategoryError(error.message);
        } finally {
            busyRef.current = false;
            setIsSaving(false);
        }
    }

    /** Conserva el diálogo abierto cuando hay un guardado en curso. */
    function handleDialogCancel(event) {
        if (busyRef.current) {
            event.preventDefault();
        }
    }

    // --------------------------- Movimiento de series ----------------------------

    /** Mueve una película al destino directo o a la subcategoría seleccionada. */
    async function handleMoveSeries(seriesPath, targetId) {
        if (busyRef.current || isLoading || !isReady) {
            return;
        }
        const normalizedSeriesPath = normalizePathForComparison(seriesPath);
        const seriesBelongsToLibrary = moviesList.some(serie =>
            normalizePathForComparison(serie.rutaCompleta) === normalizedSeriesPath
        );
        if (!seriesBelongsToLibrary) {
            return;
        }
        const destination = moveDestinations.find(item => item.id === targetId);
        if (targetId && !destination) {
            return;
        }
        busyRef.current = true;
        setIsSaving(true);
        setSaveError('');
        try {
            const updatedCategories = await fetch('/api/MoviesCategory/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    libraryPath,
                    moviePath: seriesPath,
                    categoryId: destination?.categoryId ?? null,
                    subcategoryId: destination?.subcategoryId ?? null
                })
            }).then(readJson);
            // La organización visible cambia únicamente cuando el servidor confirma el guardado.
            setCategories(updatedCategories);
        } catch (error) {
            setSaveError(error.message);
        } finally {
            busyRef.current = false;
            setIsSaving(false);
        }
    }

    // ------------------------- Eliminación de categorías -------------------------

    /** Guarda la categoría elegida y abre su confirmación de eliminación. */
  
    // ---------------------------- Datos para la vista ----------------------------

    /** Obtiene las películas asignadas a la subcategoría recibida. */
    function getSubcategoryMovies(subcategory) {
        return moviesList.filter(movie => subcategory.moviesPaths.some(path =>
            normalizePathForComparison(path) === normalizePathForComparison(movie.rutaCompleta)
        ));
    }



    const canEditLibrary = isReady && !isLoading && !isSaving;
    const moveDestinations = categories.flatMap(category => category.moviesSubcategories.length === 0
        ? [{ id: category.id, name: category.name, categoryId: category.id }]
        : category.moviesSubcategories.map(subcategory => ({
            id: `${category.id}/${subcategory.id}`,
            name: `${category.name} · ${subcategory.name}`,
            categoryId: category.id,
            subcategoryId: subcategory.id
        })));
    const assignedPaths = new Set(
        categories.flatMap(category => [
            ...(category.moviesPaths ?? []),
            ...category.moviesSubcategories.flatMap(subcategory => subcategory.moviesPaths)
        ].map(normalizePathForComparison))
    );
    const uncategorizedSeries = moviesList.filter(serie =>
        !assignedPaths.has(normalizePathForComparison(serie.rutaCompleta))
    );


    // ------------------------- Renderizado de la página --------------------------
  return (
        <div className="huex-container">

            {/* Cabecera */}
            <HuexPageHeader title="Mis películas" outlinedTitle>
                <button type="button" className="action-btn"
                    disabled={!canEditLibrary}
                  onClick={() => openCreateCategoryDialog()}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true" style={{ display: 'block' }}>
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                        <path d="M17 13h2v3h3v2h-3v3h-2v-3h-3v-2h3z" />
                    </svg>
                    Nueva Categoria
                </button>
                <button className="action-btn" onClick={handleSelectFolder} disabled={isLoading || isSaving}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="22px" height="22px" style={{ display: 'block' }}>
                        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                    </svg>
                    {isLoading ? 'Cargando...' : 'Seleccionar Carpeta'}
                </button>
            </HuexPageHeader>

            {/* Estado de la biblioteca */}
            {isLoading && <p role="status">Cargando biblioteca…</p>}
            {isSaving && <p role="status">Guardando cambios…</p>}
            {loadError && <div role="alert">
                <p>{loadError}</p>
                <button type="button" className="action-btn" disabled={isLoading || isSaving}
                    onClick={() => setLoadAttempt(attempt => attempt + 1)}>Reintentar carga</button>
            </div>}
            {saveError && <p role="alert">{saveError}</p>}


            {/* Crear categoría */}
            <dialog ref={categoryDialogRef} className="category-dialog"
                aria-labelledby="category-dialog-title" aria-describedby="category-dialog-description"
                onCancel={handleDialogCancel}>
                <form onSubmit={handleCreateCategory} className="category-dialog-form" aria-busy={isSaving}>
                    <h3 id="category-dialog-title">{subcategoryParent ? 'Crear subcategoría' : 'Crear categoría'}</h3>
                    <p id="category-dialog-description">{subcategoryParent
                        ? `Organiza las películas dentro de ${subcategoryParent.name}.`
                        : 'Dale un espacio propio a tus películas favoritas.'}</p>
                    <label htmlFor="category-name">Nombre de la categoría</label>
                    <input
                        id="category-name"
                        type="text"
                        autoFocus
                        autoComplete="off"
                        value={categoryName}
                        maxLength={80}
                        disabled={!canEditLibrary}
                        placeholder="Por ejemplo, Comedia"
                        onChange={handleCategoryNameChange}
                        aria-invalid={Boolean(categoryError)}
                        aria-describedby={categoryError ? 'category-error' : undefined}
                    />
                    {categoryError && <p id="category-error" className="category-dialog-error" role="alert">{categoryError}</p>}
                    <div className="category-dialog-actions">
                        <button type="button" className="category-dialog-cancel" disabled={isSaving}
                            onClick={() => categoryDialogRef.current.close()}>Cancelar</button>
                        <button type="submit" className="action-btn" disabled={!canEditLibrary}>
                            {isSaving ? 'Creando…' : 'Crear'}
                        </button>
                    </div>
                </form>
            </dialog>
            {/* Eliminar categoría */}
          {/*            <dialog ref={deleteCategoryDialogRef} className="category-dialog" aria-labelledby="delete-category-title"
                aria-describedby="delete-category-description"
                onCancel={handleDialogCancel}>
                <form onSubmit={handleDeleteCategory} className="category-dialog-form" aria-busy={isSaving}>
                    <h3 id="delete-category-title">¿Eliminar categoría?</h3>
                    <p id="delete-category-description">Se eliminará <strong>{categoryToDelete?.name}</strong>.
                        Sus series pasarán a «Sin categoría» y conservarán sus capítulos vistos y su progreso.</p>
                    {deleteCategoryError && <p className="category-dialog-error" role="alert">{deleteCategoryError}</p>}
                    <div className="category-dialog-actions">
                        <button type="button" className="category-dialog-cancel" autoFocus disabled={isSaving}
                            onClick={() => deleteCategoryDialogRef.current.close()}>Cancelar</button>
                        <button type="submit" className="action-btn" disabled={isSaving}>
                            {isSaving ? 'Eliminando…' : 'Eliminar categoría'}
                        </button>
                    </div>
                </form>
            </dialog>
            */}
            {/* Reiniciar serie */}
          {/*  <dialog ref={resetDialogRef} className="category-dialog" aria-labelledby="reset-series-title"
                aria-describedby="reset-series-description"
                onCancel={handleDialogCancel}>
                <form onSubmit={handleResetSeries} className="category-dialog-form" aria-busy={isSaving}>
                    <h3 id="reset-series-title">¿Reiniciar serie?</h3>
                    <p id="reset-series-description">Todos los episodios de <strong>{seriesToReset?.nombre}</strong> pasarán a no vistos
                        y se borrará el minuto guardado. Esta acción no se puede deshacer.</p>
                    {resetError && <p className="category-dialog-error" role="alert">{resetError}</p>}
                    <div className="category-dialog-actions">
                        <button type="button" className="category-dialog-cancel" autoFocus disabled={isSaving}
                            onClick={() => resetDialogRef.current.close()}>Cancelar</button>
                        <button type="submit" className="action-btn" disabled={isSaving}>
                            {isSaving ? 'Reiniciando…' : 'Reiniciar serie'}
                        </button>
                    </div>
                </form>
            </dialog>

            {/* Continuar viendo */}
          {/* {!isLoading && continuingEpisodes.length > 0 && <SeriesCategoryRow
                title="Continuar viendo"
                series={continuingEpisodes}
                cardVariant="horizontal"
                onSelectSeries={continueEpisode}
            />}

            {/* Categorías y series sin asignar */}
            {categories.map(category => (
                <section key={category.id} className="movies-category-group"
                    aria-labelledby={`movies-category-${category.id}`}>
                    <div className="movies-category-group-header">
                        <h3 id={`movies-category-${category.id}`} className="huex-title">{category.name}</h3>
                        {category.moviesSubcategories.length === 0 && (
                            <span className="series-category-count">
                                {getSubcategoryMovies({ moviesPaths: category.moviesPaths ?? [] }).length}
                            </span>
                        )}
                    <button type="button" className="action-btn" disabled={!canEditLibrary}
                        onClick={() => openCreateCategoryDialog(category)}>
                        Nueva subcategoría
                    </button>
                    </div>
                    <div className="movies-category-group-content">
                    {category.moviesSubcategories.length === 0 && <SeriesCategoryRow
                        title={category.name}
                        showHeader={false}
                        categoryId={category.id}
                        categories={moveDestinations}
                        series={getSubcategoryMovies({ moviesPaths: category.moviesPaths ?? [] })}
                        onMoveSeries={canEditLibrary ? handleMoveSeries : undefined}
                        typeVariant="película"
                        onSelectSeries={() => {}}
                    />}
                    {category.moviesSubcategories.map(subcategory => (
                        <SeriesCategoryRow
                            key={subcategory.id}
                            title={subcategory.name}
                            categoryId={`${category.id}/${subcategory.id}`}
                            categories={moveDestinations}
                            onMoveSeries={canEditLibrary ? handleMoveSeries : undefined}
                            series={getSubcategoryMovies(subcategory)}
                            typeVariant="película"
                            onSelectSeries={() => {}}
                        />
                    ))}
                    </div>
                </section>
            ))}

            {moviesList.length === 0 ? (
                <div className="empty-state">
                    <h3 style={{ color: '#ffffff', fontSize: '1.5rem', margin: '0 0 10px 0' }}>No hay series cargadas</h3>
                    <p style={{ color: '#8c8c8c' }}>Haz clic en "Seleccionar Carpeta" para escanear tu disco local.</p>
                </div>
            ) : (
                <SeriesCategoryRow
                      title="Sin categoría"
                      categoryId=""
                      categories={moveDestinations}
                      onMoveSeries={canEditLibrary ? handleMoveSeries : undefined}
                      series={uncategorizedSeries}
                      typeVariant="película"
                      onSelectSeries={() => { } }
                />
            )}
        </div>
    );
}

export default Movies;
