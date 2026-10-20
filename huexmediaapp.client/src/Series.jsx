import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SeriesCategoryRow from './SeriesCategoryRow';
import HuexPageHeader from './HuexPageHeader';
import { loadContinueWatching, waitForProgressSaves } from './playbackProgress';
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

/** Carga series y categorías en paralelo y después obtiene los episodios de «Continuar viendo». */
async function loadLibrary(libraryPath, signal) {
    const encodedPath = encodeURIComponent(libraryPath);
    const [series, categories] = await Promise.all([
        fetch(`/api/series/scan?path=${encodedPath}`, { signal }).then(readJson),
        fetch(`/api/seriescategories?libraryPath=${encodedPath}`, { signal }).then(readJson)
    ]);
    if (!Array.isArray(series) || !Array.isArray(categories)) {
        throw new Error('No se ha podido leer la organización de la biblioteca.');
    }

    const continuingEpisodes = await loadContinueWatching(libraryPath, series, signal);
    return { series, categories, continuingEpisodes };
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
function Series(props) {
    const { seriesList, setSeriesList } = props;
    // Carga inicial o cambio de carpeta en curso.
    const [isLoading, setIsLoading] = useState(true);
    // La biblioteca se ha cargado y permite editar su organización.
    const [isReady, setIsReady] = useState(false);
    // Carpeta de la biblioteca que se está mostrando.
    const [libraryPath, setLibraryPath] = useState('');
    // Categorías y asignaciones recibidas del servidor.
    const [categories, setCategories] = useState([]);
    // Episodios que aparecen en «Continuar viendo».
    const [continuingEpisodes, setContinuingEpisodes] = useState([]);
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

    // Categoría elegida para confirmar su eliminación.
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [deleteCategoryError, setDeleteCategoryError] = useState('');
    const deleteCategoryDialogRef = useRef(null);

    // Serie elegida para confirmar el reinicio de su progreso.
    const [seriesToReset, setSeriesToReset] = useState(null);
    const [resetError, setResetError] = useState('');
    const resetDialogRef = useRef(null);

    const navigate = useNavigate();

    // -------------------------- Carga de la biblioteca ---------------------------

    /** Aplica los datos cargados, limpia los errores de edición y habilita las acciones de biblioteca. */
    const applyLibraryData = useCallback(function applyLibraryData(path, data) {
        setSeriesList(data.series);
        setCategories(data.categories);
        setContinuingEpisodes(data.continuingEpisodes);
        setLibraryPath(path);
        setCategoryError('');
        setSaveError('');
        setIsReady(true);
    }, [setSeriesList]);

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
                const configuration = await fetch('/api/configuration/get?key=SeriesLibraryPath', {
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
            const selection = await fetch('/api/series/select-folder').then(readJson);
            if (!selection.ruta) {
                return;
            }
            const libraryData = await loadLibrary(selection.ruta);
            await fetch('/api/configuration/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'SeriesLibraryPath', value: selection.ruta })
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

    /** Limpia el formulario y abre el diálogo de creación de categoría. */
    function openCreateCategoryDialog() {
        setCategoryName('');
        setCategoryError('');
        categoryDialogRef.current.showModal();
    }

    /** Actualiza el nombre escrito y retira el error de validación del formulario. */
    function handleCategoryNameChange(event) {
        setCategoryName(event.target.value);
        setCategoryError('');
    }

    /** Valida el nombre, solicita la creación y sustituye las categorías con la respuesta del servidor. */
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
        const normalizedName = name.toLocaleLowerCase('es');
        const categoryAlreadyExists = categories.some(category =>
            category.name.toLocaleLowerCase('es') === normalizedName
        );
        if (normalizedName === 'sin categoría' || categoryAlreadyExists) {
            setCategoryError('Ya existe una categoría con ese nombre.');
            return;
        }
        busyRef.current = true;
        setIsSaving(true);
        setCategoryError('');
        setSaveError('');
        try {
            const updatedCategories = await fetch('/api/seriescategories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ libraryPath, name })
            }).then(readJson);
            setCategories(updatedCategories);
            setCategoryName('');
            categoryDialogRef.current?.close();
        } catch (error) {
            setCategoryError(error.message);
        } finally {
            busyRef.current = false;
            setIsSaving(false);
        }
    }

    // --------------------------- Movimiento de series ----------------------------

    /** Comprueba el origen y destino y solicita mover la serie; un destino vacío la deja sin categoría. */
    async function handleMoveSeries(seriesPath, targetCategoryId) {
        if (busyRef.current || isLoading || !isReady) {
            return;
        }
        const normalizedSeriesPath = normalizePathForComparison(seriesPath);
        const seriesBelongsToLibrary = seriesList.some(serie =>
            normalizePathForComparison(serie.rutaCompleta) === normalizedSeriesPath
        );
        if (!seriesBelongsToLibrary) {
            return;
        }
        if (targetCategoryId && !categories.some(category => category.id === targetCategoryId)) {
            return;
        }
        busyRef.current = true;
        setIsSaving(true);
        setSaveError('');
        try {
            const updatedCategories = await fetch('/api/seriescategories/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ libraryPath, seriesPath, categoryId: targetCategoryId || null })
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
    function requestDeleteCategory(category) {
        if (busyRef.current || isLoading || !isReady) {
            return;
        }
        setCategoryToDelete(category);
        setDeleteCategoryError('');
        deleteCategoryDialogRef.current.showModal();
    }

    /** Elimina la categoría confirmada, aplica la lista devuelta y cierra el diálogo al completarse. */
    async function handleDeleteCategory(event) {
        event.preventDefault();
        if (busyRef.current || isLoading || !isReady || !categoryToDelete) {
            return;
        }
        busyRef.current = true;
        setIsSaving(true);
        setDeleteCategoryError('');
        try {
            const encodedLibraryPath = encodeURIComponent(libraryPath);
            const updatedCategories = await fetch(
                `/api/seriescategories/${categoryToDelete.id}?libraryPath=${encodedLibraryPath}`,
                { method: 'DELETE' }
            ).then(readJson);
            setCategories(updatedCategories);
            deleteCategoryDialogRef.current.close();
            setCategoryToDelete(null);
        } catch (error) {
            setDeleteCategoryError(error.message);
        } finally {
            busyRef.current = false;
            setIsSaving(false);
        }
    }

    // --------------------------- Reinicio del progreso ---------------------------

    /** Guarda la serie elegida y abre la confirmación de reinicio de su progreso. */
    function requestResetSeries(serie) {
        if (busyRef.current || isLoading || !isReady) {
            return;
        }
        setSeriesToReset(serie);
        setResetError('');
        resetDialogRef.current.showModal();
    }

    /** Espera los guardados pendientes, reinicia el progreso y retira la serie de «Continuar viendo». */
    async function handleResetSeries(event) {
        event.preventDefault();
        if (busyRef.current || isLoading || !isReady || !seriesToReset) {
            return;
        }
        busyRef.current = true;
        setIsSaving(true);
        setResetError('');
        try {
            await waitForProgressSaves();
            await fetch('/api/playbackprogress/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ libraryPath, seriesPath: seriesToReset.rutaCompleta })
            }).then(readJson);
            const resetSeriesPath = normalizePathForComparison(seriesToReset.rutaCompleta);
            setContinuingEpisodes(episodes => episodes.filter(episode =>
                normalizePathForComparison(episode.seriesPath) !== resetSeriesPath
            ));
            resetDialogRef.current.close();
            setSeriesToReset(null);
        } catch (error) {
            setResetError(error.message);
        } finally {
            busyRef.current = false;
            setIsSaving(false);
        }
    }

    // -------------------------- Eventos de los diálogos --------------------------

    /** Impide cerrar con Escape un diálogo mientras hay una operación en curso. */
    function handleDialogCancel(event) {
        if (busyRef.current) {
            event.preventDefault();
        }
    }

    // -------------------------------- Navegación ---------------------------------

    /** Abre los episodios de la serie enviando su ruta y su nombre al destino. */
    function openSeries(serie) {
        navigate('/series/episodes', {
            state: {
                folderPath: serie.rutaCompleta,
                seriesName: serie.nombre
            }
        });
    }

    /** Abre el reproductor con el episodio, su biblioteca y la posición desde la que continuar. */
    function continueEpisode(episode) {
        navigate('/player', {
            state: {
                episode,
                libraryPath,
                seriesPath: episode.seriesPath,
                startSeconds: episode.playbackProgress.positionSeconds
            }
        });
    }

    // ---------------------------- Datos para la vista ----------------------------

    /** Selecciona de la biblioteca las series cuyas rutas están asignadas a esta categoría. */
    function getCategorySeries(category) {
        const categorySeries = seriesList.filter(serie => category.seriesPaths.some(path =>
            normalizePathForComparison(path) === normalizePathForComparison(serie.rutaCompleta)
        ));
        return categorySeries;
    }

    const canEditLibrary = isReady && !isLoading && !isSaving;
    const assignedPaths = new Set(
        categories.flatMap(category => category.seriesPaths.map(normalizePathForComparison))
    );
    const uncategorizedSeries = seriesList.filter(serie =>
        !assignedPaths.has(normalizePathForComparison(serie.rutaCompleta))
    );


    // ------------------------- Renderizado de la página --------------------------

    return (
        <div className="huex-container">

            {/* Cabecera */}
            <HuexPageHeader title="Mis series" outlinedTitle>
                <button type="button" className="action-btn"
                    disabled={!canEditLibrary}
                    onClick={openCreateCategoryDialog}>
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
                    <h3 id="category-dialog-title">Crear categoría</h3>
                    <p id="category-dialog-description">Dale un espacio propio a tus series favoritas.</p>
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
            <dialog ref={deleteCategoryDialogRef} className="category-dialog" aria-labelledby="delete-category-title"
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

            {/* Reiniciar serie */}
            <dialog ref={resetDialogRef} className="category-dialog" aria-labelledby="reset-series-title"
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
            {!isLoading && continuingEpisodes.length > 0 && <SeriesCategoryRow
                title="Continuar viendo"
                series={continuingEpisodes}
                cardVariant="horizontal"
                onSelectSeries={continueEpisode}
            />}

            {/* Categorías y series sin asignar */}
            {categories.map(category => (
                 <SeriesCategoryRow
                    key={category.id}
                    categoryId={category.id}
                    onDeleteCategory={canEditLibrary ? requestDeleteCategory : undefined}
                    categories={categories}
                    onMoveSeries={canEditLibrary ? handleMoveSeries : undefined}
                    onResetSeries={canEditLibrary ? requestResetSeries : undefined}
                    title={category.name}
                    series={getCategorySeries(category)}
                    onSelectSeries={openSeries}
                    typeVariant='serie'
                />
            ))}

            {seriesList.length === 0 ? (
                <div className="empty-state">
                    <h3 style={{ color: '#ffffff', fontSize: '1.5rem', margin: '0 0 10px 0' }}>No hay series cargadas</h3>
                    <p style={{ color: '#8c8c8c' }}>Haz clic en "Seleccionar Carpeta" para escanear tu disco local.</p>
                </div>
            ) : (
                <SeriesCategoryRow
                    title="Sin categoría"
                    categoryId=""
                    categories={categories}
                    onMoveSeries={canEditLibrary ? handleMoveSeries : undefined}
                    onResetSeries={canEditLibrary ? requestResetSeries : undefined}
                    series={uncategorizedSeries}
                    onSelectSeries={openSeries}
                />
            )}
        </div>
    );
}

export default Series;
