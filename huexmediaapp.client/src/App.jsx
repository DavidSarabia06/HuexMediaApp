import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import Header from './Header';
import Series from './Series';
import SeriesDetail from './SeriesDetail';
import Settings from './Settings';

function App() {

    const [seriesList, setSeriesList] = useState([]);

    return (
        <Router>
            <div style={{ minHeight: '100vh', backgroundColor: '#141414', color: 'white' }}>
                <Header />
                <div style={{ padding: '20px' }}>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/movies" element={<h2 style={{ color: '#00e676' }}>MIS PELÍCULAS</h2>} />

                        <Route path="/series" element={
                            <Series seriesList={seriesList} setSeriesList={setSeriesList} />
                        } />

                        <Route path="/series/episodes" element={<SeriesDetail />} />
                        <Route path="/music" element={<h2 style={{ color: '#00e676' }}>MI MÚSICA</h2>} />
                        <Route path="/settings" element={<Settings />} />
                    </Routes>
                </div>
            </div>
        </Router>
    );
}

export default App;