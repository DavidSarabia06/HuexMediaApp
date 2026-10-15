import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SeriesCategoryRow from './SeriesCategoryRow';
import HuexPageHeader from './HuexPageHeader';
import { loadContinueWatching, waitForProgressSaves } from './playbackProgress';
import './css/HuexStyles.css';

async function readJson(response) {
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error ?? body?.message ?? `La solicitud ha fallado (HTTP ${response.status}).`);
    if (body === null) throw new Error('El servidor ha devuelto una respuesta no válida.');
    return body;
}

async function loadLibrary(path, signal) {
    const [series, categories] = await Promise.all([
        fetch(`/api/series/scan?path=${encodeURIComponent(path)}`, { signal }).then(readJson),
        fetch(`/api/seriescategories?libraryPath=${encodeURIComponent(path)}`, { signal }).then(readJson)
    ]);
    if (!Array.isArray(series) || !Array.isArray(categories)) throw new Error('No se ha podido leer la organización de la biblioteca.');
    const continuing = await loadContinueWatching(path, series, signal);
    return { series, categories, continuing };
}

const pathKey = path => path.replaceAll('/', '\\').replace(/\\+$/, '').toUpperCase();

function Series({ seriesList, setSeriesList }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [libraryPath, setLibraryPath] = useState('');
    const [categories, setCategories] = useState([]);
    const [continuingEpisodes, setContinuingEpisodes] = useState([]);
    const [categoryName, setCategoryName] = useState('');
    const [categoryError, setCategoryError] = useState('');
    const [loadError, setLoadError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const busyRef = useRef(false);
    const categoryDialogRef = useRef(null);
    const resetDialogRef = useRef(null);
    const deleteCategoryDialogRef = useRef(null);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [deleteCategoryError, setDeleteCategoryError] = useState('');
    const [resetSeries, setResetSeries] = useState(null);
    const [resetError, setResetError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            setIsLoading(true);
            setIsReady(false);
            setLoadError('');
            try {
                const config = await fetch('/api/configuration/get?key=SeriesLibraryPath', { signal: controller.signal }).then(readJson);
                const data = await loadLibrary(config.value, controller.signal);
                if (controller.signal.aborted) return;
                setSeriesList(data.series);
                setCategories(data.categories);
                setContinuingEpisodes(data.continuing);
                setLibraryPath(config.value);
                setCategoryError('');
                setSaveError('');
                setIsReady(true);
            } catch (error) {
                if (!controller.signal.aborted) setLoadError(error.message);
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        }
        void load();
        return () => controller.abort();
    }, [setSeriesList, loadAttempt]);

    async function handleSelectFolder() {
        if (busyRef.current || isLoading) return;
        busyRef.current = true;
        setIsLoading(true);
        setLoadError('');
        try {
            const selection = await fetch('/api/series/select-folder').then(readJson);
            if (!selection.ruta) return;
            const data = await loadLibrary(selection.ruta);
            await fetch('/api/configuration/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'SeriesLibraryPath', value: selection.ruta })
            }).then(readJson);
            // Solo cambia de biblioteca después de cargar sus categorías y guardar la ruta.
            setSeriesList(data.series);
            setCategories(data.categories);
            setContinuingEpisodes(data.continuing);
            setLibraryPath(selection.ruta);
            setCategoryError('');
            setSaveError('');
            setIsReady(true);
        } catch (error) {
            setLoadError(error.message);
        } finally {
            busyRef.current = false;
            setIsLoading(false);
        }
    }

    async function handleCreateCategory(event) {
        event.preventDefault();
        if (busyRef.current || isLoading || !isReady) return;
        const name = categoryName.trim();
        if (!name || name.length > 80) {
            setCategoryError('El nombre debe tener entre 1 y 80 caracteres.');
            return;
        }
        const normalizedName = name.toLocaleLowerCase('es');
        if (normalizedName === 'sin categoría' || categories.some(category => category.name.toLocaleLowerCase('es') === normalizedName)) {
            setCategoryError('Ya existe una categoría con ese nombre.');
            return;
        }
        busyRef.current = true;
        setIsSaving(true);
        setCategoryError('');
        setSaveError('');
        try {
            const saved = await fetch('/api/seriescategories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ libraryPath, name })
            }).then(readJson);
            setCategories(saved);
            setCategoryName('');
            categoryDialogRef.current?.close();
        } catch (error) {
            setCategoryError(error.message);
        } finally {
            busyRef.current = false;
            setIsSaving(false);
        }
    }

    async function handleMoveSeries(seriesPath, targetCategoryId) {
        if (busyRef.current || isLoading || !isReady) return;
        if (!seriesList.some(serie => pathKey(serie.rutaCompleta) === pathKey(seriesPath))) return;
        if (targetCategoryId && !categories.some(category => category.id === targetCategoryId)) return;
        busyRef.current = true;
        setIsSaving(true);
        setSaveError('');
        try {
            const saved = await fetch('/api/seriescategories/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ libraryPath, seriesPath, categoryId: targetCategoryId || null })
            }).then(readJson);
            // La organización visible cambia únicamente cuando el servidor confirma el guardado.
            setCategories(saved);
        } catch (error) {
            setSaveError(error.message);
        } finally {
            busyRef.current = false;
            setIsSaving(false);
        }
    }
    function requestResetSeries(serie) {
        if (busyRef.current || isLoading || !isReady) return;
        setResetSeries(serie);
        setResetError('');
        resetDialogRef.current.showModal();
    }

    async function handleResetSeries(event) {
        event.preventDefault();
        if (busyRef.current || isLoading || !isReady || !resetSeries) return;
        busyRef.current = true;
        setIsSaving(true);
        setResetError('');
        try {
            await waitForProgressSaves();
            await fetch('/api/playbackprogress/reset', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ libraryPath, seriesPath: resetSeries.rutaCompleta })
            }).then(readJson);
            setContinuingEpisodes(episodes => episodes.filter(episode => pathKey(episode.seriesPath) !== pathKey(resetSeries.rutaCompleta)));
            resetDialogRef.current.close();
            setResetSeries(null);
        } catch (error) {
            setResetError(error.message);
        } finally {
            busyRef.current = false;
            setIsSaving(false);
        }
    }

    function requestDeleteCategory(category) {
        if (busyRef.current || isLoading || !isReady) return;
        setCategoryToDelete(category);
        setDeleteCategoryError('');
        deleteCategoryDialogRef.current.showModal();
    }

    async function handleDeleteCategory(event) {
        event.preventDefault();
        if (busyRef.current || isLoading || !isReady || !categoryToDelete) return;
        busyRef.current = true;
        setIsSaving(true);
        setDeleteCategoryError('');
        try {
            const saved = await fetch(`/api/seriescategories/${categoryToDelete.id}?libraryPath=${encodeURIComponent(libraryPath)}`,
                { method: 'DELETE' }).then(readJson);
            setCategories(saved);
            deleteCategoryDialogRef.current.close();
            setCategoryToDelete(null);
        } catch (error) {
            setDeleteCategoryError(error.message);
        } finally {
            busyRef.current = false;
            setIsSaving(false);
        }
    }

    const assignedPaths = new Set(categories.flatMap(category => category.seriesPaths.map(pathKey)));
    const uncategorizedSeries = seriesList.filter(serie => !assignedPaths.has(pathKey(serie.rutaCompleta)));

    return (
        <div className="huex-container">

            <HuexPageHeader title="Mis series" outlinedTitle>
                <button type="button" className="action-btn"
                    disabled={isLoading || isSaving || !isReady}
                    onClick={() => {
                        setCategoryName('');
                        setCategoryError('');
                        categoryDialogRef.current.showModal();
                    }}>
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

            {isLoading && <p role="status">Cargando biblioteca…</p>}
            {isSaving && <p role="status">Guardando cambios…</p>}
            {loadError && <div role="alert">
                <p>{loadError}</p>
                <button type="button" className="action-btn" disabled={isLoading || isSaving}
                    onClick={() => setLoadAttempt(attempt => attempt + 1)}>Reintentar carga</button>
            </div>}
            {saveError && <p role="alert">{saveError}</p>}

            <dialog ref={categoryDialogRef} className="category-dialog"
                aria-labelledby="category-dialog-title" aria-describedby="category-dialog-description"
                onCancel={event => { if (busyRef.current) event.preventDefault(); }}>
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
                        disabled={isLoading || isSaving || !isReady}
                        placeholder="Por ejemplo, Comedia"
                        onChange={(event) => {
                            setCategoryName(event.target.value);
                            setCategoryError('');
                        }}
                        aria-invalid={Boolean(categoryError)}
                        aria-describedby={categoryError ? 'category-error' : undefined}
                    />
                    {categoryError && <p id="category-error" className="category-dialog-error" role="alert">{categoryError}</p>}
                    <div className="category-dialog-actions">
                        <button type="button" className="category-dialog-cancel" disabled={isSaving}
                            onClick={() => categoryDialogRef.current.close()}>Cancelar</button>
                        <button type="submit" className="action-btn" disabled={isLoading || isSaving || !isReady}>
                            {isSaving ? 'Creando…' : 'Crear'}
                        </button>
                    </div>
                </form>
            </dialog>

            <dialog ref={deleteCategoryDialogRef} className="category-dialog" aria-labelledby="delete-category-title"
                aria-describedby="delete-category-description"
                onCancel={event => { if (busyRef.current) event.preventDefault(); }}>
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

            <dialog ref={resetDialogRef} className="category-dialog" aria-labelledby="reset-series-title"
                aria-describedby="reset-series-description"
                onCancel={event => { if (busyRef.current) event.preventDefault(); }}>
                <form onSubmit={handleResetSeries} className="category-dialog-form" aria-busy={isSaving}>
                    <h3 id="reset-series-title">¿Reiniciar serie?</h3>
                    <p id="reset-series-description">Todos los episodios de <strong>{resetSeries?.nombre}</strong> pasarán a no vistos
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

            {!isLoading && continuingEpisodes.length > 0 && <SeriesCategoryRow
                title="Continuar viendo"
                series={continuingEpisodes}
                cardVariant="horizontal"
                onSelectSeries={episode => navigate('/player', {
                    state: { episode, libraryPath, seriesPath: episode.seriesPath,
                        startSeconds: episode.playbackProgress.positionSeconds }
                })}
            />}

            {categories.map(category => (
                <SeriesCategoryRow
                    key={category.id}
                    categoryId={category.id}
                    onDeleteCategory={isLoading || isSaving || !isReady ? undefined : requestDeleteCategory}
                    categories={categories}
                    onMoveSeries={isLoading || isSaving || !isReady ? undefined : handleMoveSeries}
                    onResetSeries={isLoading || isSaving || !isReady ? undefined : requestResetSeries}
                    title={category.name}
                    series={seriesList.filter(serie => category.seriesPaths.some(path => pathKey(path) === pathKey(serie.rutaCompleta)))}
                    onSelectSeries={(serie) => navigate('/series/episodes', {
                        state: {
                            folderPath: serie.rutaCompleta,
                            seriesName: serie.nombre
                        }
                    })}
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
                    onMoveSeries={isLoading || isSaving || !isReady ? undefined : handleMoveSeries}
                    onResetSeries={isLoading || isSaving || !isReady ? undefined : requestResetSeries}
                    series={uncategorizedSeries}
                    onSelectSeries={(serie) => navigate('/series/episodes', {
                        state: {
                            folderPath: serie.rutaCompleta,
                            seriesName: serie.nombre
                        }
                    })}
                />
            )}
        </div>
    );
}

export default Series;
