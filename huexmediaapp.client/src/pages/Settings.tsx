import type { TitleBorderStyle } from '../hooks/useTitleBorderStyle';
import type { MediaLibrary, MediaType, LibrarySummary } from '../utils/libraryUtils';
import type { LibraryPlaybackProgress } from '../utils/playbackProgress';
import { errorMessage } from '../utils/generalUtils';
import { useEffect, useRef, useState } from 'react';
import HuexPageHeader from '../components/HuexPageHeader';
import { FolderIcon } from '../components/Icons';
import '../css/Settings.css';
import { readJson, normalizePathForComparison } from '../utils/generalUtils';
import { getLibrariesRequest } from '../api/librariesApi';

interface LegacyLibrary { fileName: string; mediaType: MediaType; libraryPath: string; categoryCount: number; name: string; }
interface LegacyProgress { fileName: string; libraryPath: string; seriesCount: number; watchedEpisodeCount: number; inProgressCount: number; libraryId: string; }

export interface SettingsProps {
    /** Estilo de contorno compartido con los títulos principales. */
    borderStyle: TitleBorderStyle;
    /** Actualiza la preferencia visual conservada por App. */
    onBorderStyleChange: (style: TitleBorderStyle) => void;
    /** Segundos que tarda cada línea en completar una vuelta. */
    durationSeconds: number;
    onDurationChange: (seconds: number) => void;
    /** Número de líneas distribuidas por el contorno. */
    lineCount: number;
    onLineCountChange: (count: number) => void;
    /** Porcentaje del tramo de cada línea ocupado por su trazo visible. */
    lineLengthPercent: number;
    onLineLengthChange: (percent: number) => void;
}

// -------------------------- Página de configuración --------------------------

/** Configura la apariencia y permite migrar bibliotecas y progreso antiguos. */
export default function Settings({
    borderStyle, onBorderStyleChange,
    durationSeconds, onDurationChange,
    lineCount, onLineCountChange,
    lineLengthPercent, onLineLengthChange
}: SettingsProps) {
    // ------------------------------- Estados ------------------------------------

    // Bibliotecas antiguas pendientes de actualizar, con el nombre elegido para cada una.
    const [legacyLibraries, setLegacyLibraries] = useState<LegacyLibrary[]>([]);

    // Indica si ya hemos realizado una búsqueda.
    const [hasSearched, setHasSearched] = useState(false);

    // Bloquea los controles durante una búsqueda o actualización.
    const [isBusy, setIsBusy] = useState(false);

    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    // Conserva la petición activa para cancelarla al salir de Configuración.
    const controllerRef = useRef<AbortController | null>(null);

    // Archivos de progreso encontrados y biblioteca elegida para cada uno.
    const [legacyProgress, setLegacyProgress] = useState<LegacyProgress[]>([]);
    const [progressLibraries, setProgressLibraries] = useState<LibrarySummary[]>([]);
    const [hasSearchedProgress, setHasSearchedProgress] = useState(false);
    const [isProcessingProgress, setIsProcessingProgress] = useState(false);
    const [progressError, setProgressError] = useState('');
    const [progressMessage, setProgressMessage] = useState('');

    // -------------------------- Cancelación al salir ----------------------------

    useEffect(() => {
        return () => {
            controllerRef.current?.abort();
            controllerRef.current = null;
        };
    }, []);

    // ----------------------- Detección de archivos antiguos ----------------------

    /** Busca archivos de versión 1 y descarta bibliotecas ya registradas en versión 2. */
    async function handleSearchLegacyLibraries() {
        if (controllerRef.current) {
            return;
        }

        const controller = new AbortController();
        controllerRef.current = controller;

        setIsBusy(true);
        setError('');
        setMessage('');

        try {
            // Consulta en paralelo los archivos antiguos y las bibliotecas actuales.
            const [
                legacySeries,
                legacyMovies,
                savedSeries,
                savedMovies
            ] = await Promise.all([
                fetch('/api/libraries/legacy?mediaType=Series', {
                    signal: controller.signal
                }).then(readJson<LegacyLibrary[]>),

                fetch('/api/libraries/legacy?mediaType=Movies', {
                    signal: controller.signal
                }).then(readJson<LegacyLibrary[]>),

                getLibrariesRequest('Series', controller.signal),
                getLibrariesRequest('Movies', controller.signal)
            ]);

            if (controller.signal.aborted) {
                return;
            }

            if (!Array.isArray(legacySeries) ||
                !Array.isArray(legacyMovies)) {
                throw new Error(
                    'La lista de bibliotecas antiguas recibida no es válida.');
            }

            const oldLibraries = legacySeries.concat(legacyMovies);
            const currentLibraries = savedSeries.concat(savedMovies);

            // El archivo antiguo se conserva después de convertirlo.
            // Por eso comprobamos si su carpeta ya está registrada en versión 2.
            const pendingLibraries = oldLibraries.filter(legacy =>
                !currentLibraries.some(current =>
                    current.mediaType === legacy.mediaType &&
                    normalizePathForComparison(current.libraryPath) ===
                    normalizePathForComparison(legacy.libraryPath)
                )
            );

            setLegacyLibraries(pendingLibraries.map(library => ({
                ...library,
                name: library.mediaType === 'Series'
                    ? 'Mis series'
                    : 'Mis películas'
            })));

            setHasSearched(true);
        } catch (failure) {
            if (!controller.signal.aborted) {
                setError(errorMessage(failure));
            }
        } finally {
            if (controllerRef.current === controller) {
                controllerRef.current = null;

                if (!controller.signal.aborted) {
                    setIsBusy(false);
                }
            }
        }
    }

    // ----------------------- Nombre de la nueva biblioteca -----------------------

    /** Actualiza el nombre que se utilizará al crear el archivo de versión 2. */
    function handleLibraryNameChange(mediaType: MediaType, name: string) {
        setLegacyLibraries(current => current.map(library =>
            library.mediaType === mediaType
                ? { ...library, name }
                : library
        ));

        setError('');
    }

    // ------------------------- Conversión de bibliotecas -------------------------

    /** Solicita la conversión y retira de la lista la biblioteca actualizada. */
    async function handleMigrateLibrary(event: React.FormEvent<HTMLFormElement>, library: LegacyLibrary) {
        event.preventDefault();

        if (controllerRef.current) {
            return;
        }

        const name = library.name.trim();

        if (!name || name.length > 80) {
            setError('El nombre debe tener entre 1 y 80 caracteres.');
            return;
        }

        const controller = new AbortController();
        controllerRef.current = controller;

        setIsBusy(true);
        setError('');
        setMessage('');

        try {
            const converted = await fetch('/api/libraries/legacy/migrate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
                body: JSON.stringify({
                    name,
                    mediaType: library.mediaType
                })
            }).then(readJson<MediaLibrary>);

            if (controller.signal.aborted) {
                return;
            }

            setLegacyLibraries(current => current.filter(item =>
                item.mediaType !== library.mediaType
            ));

            setMessage(
                `La biblioteca «${converted.name}» se ha actualizado a la versión 2.`);
        } catch (failure) {
            if (!controller.signal.aborted) {
                setError(errorMessage(failure));
            }
        } finally {
            if (controllerRef.current === controller) {
                controllerRef.current = null;

                if (!controller.signal.aborted) {
                    setIsBusy(false);
                }
            }
        }
    }

    // ----------------------- Detección de progreso antiguo ----------------------

    /** Busca archivos de versión 1 y propone una biblioteca con la misma raíz. */
    async function handleSearchLegacyProgress() {
        if (controllerRef.current) {
            return;
        }
        const controller = new AbortController();
        controllerRef.current = controller;
        setIsBusy(true);
        setIsProcessingProgress(true);
        setProgressError('');
        setProgressMessage('');
        try {
            const [files, libraries] = await Promise.all([
                fetch('/api/playbackprogress/legacy', { signal: controller.signal }).then(readJson<LegacyProgress[]>),
                getLibrariesRequest('Series', controller.signal)
            ]);
            if (controller.signal.aborted) {
                return;
            }
            if (!Array.isArray(files)) {
                throw new Error('La lista de archivos de progreso recibida no es válida.');
            }
            setProgressLibraries(libraries);
            setLegacyProgress(files.map(file => ({
                ...file,
                libraryId: libraries.find(library =>
                    normalizePathForComparison(library.libraryPath) ===
                    normalizePathForComparison(file.libraryPath))?.id ?? ''
            })));
            setHasSearchedProgress(true);
        } catch (failure) {
            if (!controller.signal.aborted) {
                setProgressError(errorMessage(failure));
            }
        } finally {
            if (controllerRef.current === controller) {
                controllerRef.current = null;
                if (!controller.signal.aborted) {
                    setIsBusy(false);
                    setIsProcessingProgress(false);
                }
            }
        }
    }

    /** Cambia la biblioteca de destino elegida para un archivo de progreso. */
    function handleProgressLibraryChange(fileName: string, libraryId: string) {
        setLegacyProgress(current => current.map(file =>
            file.fileName === fileName ? { ...file, libraryId } : file));
        setProgressError('');
    }

    // ----------------------- Migración manual del progreso ----------------------

    /** Importa el archivo confirmado y retira la tarjeta al terminar. */
    async function handleMigrateProgress(event: React.FormEvent<HTMLFormElement>, file: LegacyProgress) {
        event.preventDefault();
        if (controllerRef.current) {
            return;
        }
        if (!file.libraryId) {
            setProgressError('Selecciona la biblioteca que recibirá el progreso.');
            return;
        }
        const controller = new AbortController();
        controllerRef.current = controller;
        setIsBusy(true);
        setIsProcessingProgress(true);
        setProgressError('');
        setProgressMessage('');
        try {
            const converted = await fetch('/api/playbackprogress/legacy/migrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ fileName: file.fileName, libraryId: file.libraryId })
            }).then(readJson<LibraryPlaybackProgress>);
            if (controller.signal.aborted) {
                return;
            }
            if (converted.libraryId !== file.libraryId || !Array.isArray(converted.series)) {
                throw new Error('El progreso recibido no corresponde a la biblioteca elegida.');
            }
            setLegacyProgress(current => current.filter(item => item.fileName !== file.fileName));
            const library = progressLibraries.find(item => item.id === file.libraryId);
            setProgressMessage(`Se ha migrado el progreso a «${library?.name ?? "Biblioteca"}». El archivo original se ha conservado.`);
        } catch (failure) {
            if (!controller.signal.aborted) {
                setProgressError(errorMessage(failure));
            }
        } finally {
            if (controllerRef.current === controller) {
                controllerRef.current = null;
                if (!controller.signal.aborted) {
                    setIsBusy(false);
                    setIsProcessingProgress(false);
                }
            }
        }
    }

    // ------------------------------- Renderizado --------------------------------

    return (
        <div className="huex-container huex-settings-page">
            <HuexPageHeader title="Configuración" outlinedTitle />

            <section className="settings-panel settings-appearance-panel" aria-labelledby="border-style-title">
                <div className="settings-panel-header">
                    <div>
                        <p className="settings-eyebrow">Apariencia</p>
                        <h3 id="border-style-title">Bordes de los títulos</h3>
                        <p id="border-style-description" className="huex-description">
                            Anima el contorno de los títulos principales con su propio color o mantenlo liso.
                        </p>
                    </div>

                    <fieldset className="settings-border-options" aria-describedby="border-style-description">
                        <legend className="settings-visually-hidden">Estilo de los bordes</legend>
                        <label className="settings-border-option">
                            <input
                                type="radio" name="title-border-style" value="smooth"
                                checked={borderStyle === 'smooth'}
                                onChange={() => onBorderStyleChange('smooth')}
                            />
                            <span>Lisos</span>
                        </label>
                        <label className="settings-border-option">
                            <input
                                type="radio" name="title-border-style" value="animated"
                                checked={borderStyle === 'animated'}
                                onChange={() => onBorderStyleChange('animated')}
                            />
                            <span>Animados</span>
                        </label>
                    </fieldset>
                </div>

                <fieldset className="settings-title-animation" disabled={borderStyle === 'smooth'}>
                    <legend className="settings-visually-hidden">Opciones de la animación</legend>
                    <div className="settings-title-animation-field">
                        <label htmlFor="title-border-duration">
                            Velocidad <span>{durationSeconds} s por vuelta</span>
                        </label>
                        <input
                            id="title-border-duration" type="range" min="2" max="20" step="1"
                            value={durationSeconds}
                            aria-valuetext={`Una vuelta cada ${durationSeconds} segundos`}
                            onChange={event => onDurationChange(Number(event.currentTarget.value))}
                        />
                        <div className="settings-range-labels" aria-hidden="true">
                            <span>Más rápido</span><span>Más lento</span>
                        </div>
                    </div>
                    <div className="settings-title-animation-field">
                        <label htmlFor="title-border-length">
                            Longitud <span>{lineLengthPercent}% del tramo</span>
                        </label>
                        <input
                            id="title-border-length" type="range" min="10" max="90" step="1"
                            value={lineLengthPercent}
                            aria-valuetext={`${lineLengthPercent} por ciento del tramo de cada línea`}
                            onChange={event => onLineLengthChange(Number(event.currentTarget.value))}
                        />
                        <div className="settings-range-labels" aria-hidden="true">
                            <span>Más cortas</span><span>Más largas</span>
                        </div>
                    </div>
                    <div className="settings-title-animation-field">
                        <label htmlFor="title-border-lines">Número de líneas</label>
                        <select
                            id="title-border-lines" value={lineCount}
                            onChange={event => onLineCountChange(Number(event.currentTarget.value))}
                        >
                            {[1, 2, 3, 4, 5, 6].map(count => (
                                <option key={count} value={count}>
                                    {count} {count === 1 ? 'línea' : 'líneas'}
                                </option>
                            ))}
                        </select>
                    </div>
                </fieldset>
            </section>

            <section className="settings-panel" aria-labelledby="library-update-title">
                <div className="settings-panel-header">
                    <div>
                        <p className="settings-eyebrow">Bibliotecas</p>
                        <h3 id="library-update-title">Actualizar bibliotecas antiguas</h3>
                        <p className="huex-description">
                            Recupera las categorías guardadas en versiones anteriores.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="action-btn"
                        disabled={isBusy}
                        onClick={handleSearchLegacyLibraries}
                    >
                        <FolderIcon size={20} />
                        {hasSearched ? 'Volver a buscar' : 'Buscar bibliotecas'}
                    </button>
                </div>

                <p className="settings-preservation-note">
                    Se creará una biblioteca nueva conservando el archivo original.
                </p>
            </section>

            <div className="settings-feedback" aria-live="polite">
                {isBusy && !isProcessingProgress && <p role="status">Procesando bibliotecas…</p>}
                {error && <p className="settings-notice is-error" role="alert">{error}</p>}
                {message && <p className="settings-notice" role="status">{message}</p>}
                {hasSearched && !isBusy && !error && !message && legacyLibraries.length === 0 && (
                    <p className="settings-notice">Tus bibliotecas están al día. No hay actualizaciones pendientes.</p>
                )}
            </div>

            <div className="settings-libraries-grid">
                {legacyLibraries.map(library => (
                    <section
                        key={library.mediaType}
                        className="settings-panel settings-library-card"
                        data-media-type={library.mediaType}
                        aria-labelledby={`legacy-title-${library.mediaType}`}
                    >
                        <div className="settings-library-heading">
                            <span className="settings-library-icon" aria-hidden="true">
                                <FolderIcon size={24} />
                            </span>
                            <div>
                                <p className="settings-eyebrow">Biblioteca encontrada</p>
                                <h3 id={`legacy-title-${library.mediaType}`}>
                                    {library.mediaType === 'Series' ? 'Series' : 'Películas'}
                                </h3>
                            </div>
                            <span className="series-category-count">
                                {library.categoryCount} {library.categoryCount === 1 ? 'categoría' : 'categorías'}
                            </span>
                        </div>

                        <dl className="settings-library-details">
                            <div>
                                <dt>Ubicación</dt>
                                <dd>{library.libraryPath}</dd>
                            </div>
                            <div>
                                <dt>Archivo original</dt>
                                <dd>{library.fileName}</dd>
                            </div>
                        </dl>

                        <form
                            className="category-dialog-form settings-library-form"
                            aria-busy={isBusy}
                            onSubmit={event => {
                                void handleMigrateLibrary(event, library);
                            }}
                        >
                            <label htmlFor={`library-name-${library.mediaType}`}>
                                Nombre de la nueva biblioteca
                            </label>
                            <input
                                id={`library-name-${library.mediaType}`}
                                type="text"
                                value={library.name}
                                maxLength={80}
                                required
                                disabled={isBusy}
                                onChange={event => handleLibraryNameChange(
                                    library.mediaType,
                                    event.target.value
                                )}
                            />
                            <div className="category-dialog-actions">
                                <button type="submit" className="action-btn" disabled={isBusy}>
                                    Actualizar biblioteca
                                </button>
                            </div>
                        </form>
                    </section>
                ))}
            </div>
            {/* La migración del progreso se ejecuta únicamente desde este apartado. */}
            <section className="settings-panel settings-progress-section" aria-labelledby="progress-update-title">
                <div className="settings-panel-header">
                    <div>
                        <p className="settings-eyebrow">Progreso de reproducción</p>
                        <h3 id="progress-update-title">Migrar progreso antiguo</h3>
                        <p className="huex-description">
                            Recupera los episodios vistos y el minuto guardado en una biblioteca de series.
                        </p>
                    </div>
                    <button type="button" className="action-btn" disabled={isBusy}
                        onClick={handleSearchLegacyProgress}>
                        <FolderIcon size={20} />
                        {hasSearchedProgress ? 'Volver a buscar' : 'Buscar progreso antiguo'}
                    </button>
                </div>
                <p className="settings-preservation-note">
                    Busca archivos de versión 1 en App_Data/PlaybackProgress. Selecciona primero una
                    biblioteca creada o actualizada. Si cambia la carpeta raíz, se adaptarán las rutas
                    conservando las subcarpetas. El archivo original se conserva y el progreso existente no se sobrescribe.
                </p>
            </section>

            <div className="settings-feedback" aria-live="polite">
                {isProcessingProgress && <p role="status">Procesando progreso…</p>}
                {progressError && <p className="settings-notice is-error" role="alert">{progressError}</p>}
                {progressMessage && <p className="settings-notice" role="status">{progressMessage}</p>}
                {hasSearchedProgress && !isBusy && !progressError && !progressMessage && legacyProgress.length === 0 && (
                    <p className="settings-notice">No se han encontrado archivos de progreso de versión 1.</p>
                )}
                {hasSearchedProgress && legacyProgress.length > 0 && progressLibraries.length === 0 && (
                    <p className="settings-notice">Crea o actualiza una biblioteca de series antes de migrar su progreso.</p>
                )}
            </div>

            <div className="settings-libraries-grid">
                {legacyProgress.map((file, index) => (
                    <section key={file.fileName} className="settings-panel settings-library-card" data-media-type="Series">
                        <div className="settings-library-heading">
                            <span className="settings-library-icon" aria-hidden="true"><FolderIcon size={24} /></span>
                            <div>
                                <p className="settings-eyebrow">Progreso encontrado</p>
                                <h3>{file.seriesCount} {file.seriesCount === 1 ? 'serie' : 'series'}</h3>
                            </div>
                        </div>
                        <dl className="settings-library-details">
                            <div><dt>Archivo original</dt><dd>{file.fileName}</dd></div>
                            <div><dt>Biblioteca original</dt><dd>{file.libraryPath}</dd></div>
                            <div><dt>Contenido</dt><dd>{file.watchedEpisodeCount} episodios vistos · {file.inProgressCount} en curso</dd></div>
                        </dl>
                        <form className="category-dialog-form settings-library-form" aria-busy={isBusy}
                            onSubmit={event => { void handleMigrateProgress(event, file); }}>
                            <label htmlFor={`progress-library-${index}`}>Biblioteca de destino</label>
                            <select id={`progress-library-${index}`} value={file.libraryId} required disabled={isBusy}
                                onChange={event => handleProgressLibraryChange(file.fileName, event.target.value)}>
                                <option value="">Selecciona una biblioteca</option>
                                {progressLibraries.map(library => (
                                    <option key={library.id} value={library.id}>{library.name}</option>
                                ))}
                            </select>
                            {file.libraryId && (
                                <p className="huex-description">
                                    {progressLibraries.find(library => library.id === file.libraryId)?.libraryPath}
                                </p>
                            )}
                            <div className="category-dialog-actions">
                                <button type="submit" className="action-btn" disabled={isBusy || !file.libraryId}>
                                    Migrar progreso
                                </button>
                            </div>
                        </form>
                    </section>
                ))}
            </div>
        </div>
    );
}
