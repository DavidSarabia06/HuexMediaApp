

import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './Home';
import Header from './Header';
import Series from './Series';
import SeriesDetail from './SeriesDetail';
import Settings from './Settings';
import VideoPlayer from './VideoPlayer';
import HuexPageHeader from './HuexPageHeader';

function SectionTheme({ children }) {
    const { pathname } = useLocation();
    const theme = { '': 'library', series: 'series', player: 'series', movies: 'movies', music: 'music' }[pathname.split('/')[1]];
    return <main className={`huex-app-content${theme ? ` huex-theme-${theme}` : ''}`}>{children}</main>;
}

function App() {


    const [seriesList, setSeriesList] = useState([]);

    return (
        <Router>
            <div className="huex-app">
                <Header />
                <SectionTheme>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/movies" element={<div className="huex-container"><HuexPageHeader title="Mis películas" /><div className="empty-state"><h3>Películas</h3><p className="huex-description">Esta sección estará disponible próximamente.</p></div></div>} />

                        <Route path="/series" element={
                            <Series seriesList={seriesList} setSeriesList={setSeriesList} />} />

                        <Route path="/series/episodes" element={<SeriesDetail />} />
                        <Route path="/player" element={<VideoPlayer />} />
                        <Route path="/music" element={<div className="huex-container"><HuexPageHeader title="Mi música" /><div className="empty-state"><h3>Música</h3><p className="huex-description">Esta sección estará disponible próximamente.</p></div></div>} />
                        <Route path="/settings" element={<Settings />} />
                    </Routes>
                </SectionTheme>
            </div>
        </Router>
    );
}

export default App;
