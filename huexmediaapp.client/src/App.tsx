import type { CategoryRowItem } from './components/SeriesCategoryRow';
import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Header from './components/Header';
import Series from './pages/Series';
import Movies from './pages/Movies';
import SeriesDetail from './pages/SeriesDetail';
import Settings from './pages/Settings';
import VideoPlayer from './pages/VideoPlayer';
import HuexPageHeader from './components/HuexPageHeader';
import useLibraryDensity from './hooks/useLibraryDensity';
import useTitleBorderStyle from './hooks/useTitleBorderStyle';

// ---------------------------- Tema de la sección -----------------------------

/** Aplica al contenido el tema asociado al primer segmento de la ruta actual. */
function SectionTheme({ children }: { children: React.ReactNode }) {
    const { pathname } = useLocation();
    const theme = {
        '': 'library',
        series: 'series',
        player: 'series',
        movies: 'movies',
        music: 'music'
    }[pathname.split('/')[1]];

    return <main className={`huex-app-content${theme ? ` huex-theme-${theme}` : ''}`}>{children}</main>;
}

// --------------------------- Aplicación principal ----------------------------

/** Mantiene la lista compartida de series y conecta la cabecera con las páginas de cada ruta. */
function App() {
    // ---------------------------------- Estados ----------------------------------

    // Conserva las series de la biblioteca mientras App permanece montado.
    const [seriesList, setSeriesList] = useState<CategoryRowItem[]>([]);
    const [moviesList, setMoviesList] = useState<CategoryRowItem[]>([]);
    // El header y cada biblioteca comparten la selección sin duplicar su estado.
    const seriesView = useLibraryDensity('huex-series-density');
    const moviesView = useLibraryDensity('huex-movies-density');
    // El contorno animado de los títulos se comparte con Configuración desde App.
    const {
        borderStyle, setBorderStyle,
        durationSeconds, setDurationSeconds,
        lineCount, setLineCount,
        lineLengthPercent, setLineLengthPercent,
        titleBorderStyle
    } = useTitleBorderStyle();

    // -------------------------- Estructura y navegación --------------------------

    return (
        <Router>
            <div className="huex-app" data-title-border-style={borderStyle} style={titleBorderStyle}>
                <Header seriesView={seriesView} moviesView={moviesView} />
                <SectionTheme>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/movies" element={
                            <Movies moviesList={moviesList} setMoviesList={setMoviesList} densityStyle={moviesView.densityStyle} />
                        } />
                        <Route path="/series" element={
                            <Series seriesList={seriesList} setSeriesList={setSeriesList} densityStyle={seriesView.densityStyle} />
                        } />

                        <Route path="/series/episodes" element={<SeriesDetail />} />
                        <Route path="/player" element={<VideoPlayer />} />
                        <Route path="/music" element={
                            <div className="huex-container">
                                <HuexPageHeader title="Mi música" />
                                <div className="empty-state">
                                    <h3>Música</h3>
                                    <p className="huex-description">Esta sección estará disponible próximamente.</p>
                                </div>
                            </div>
                        } />
                        <Route path="/settings" element={<Settings
                            borderStyle={borderStyle} onBorderStyleChange={setBorderStyle}
                            durationSeconds={durationSeconds} onDurationChange={setDurationSeconds}
                            lineCount={lineCount} onLineCountChange={setLineCount}
                            lineLengthPercent={lineLengthPercent} onLineLengthChange={setLineLengthPercent}
                        />} />
                    </Routes>
                </SectionTheme>
            </div>
        </Router>
    );
}

export default App;
