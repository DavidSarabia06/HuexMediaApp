import { useNavigate } from 'react-router-dom';
import HuexCard from './HuexCard';
import HuexPageHeader from './HuexPageHeader';

export default function Home() {
    const navigate = useNavigate();
    return (
        <div className="huex-container">
            <HuexPageHeader title="Mi biblioteca" outlinedTitle />
            <p className="huex-description">Tus películas, series y música en un solo lugar.</p>
            <div className="huex-grid huex-home-grid">
                {[
                    { nombre: 'Películas', path: '/movies', theme: 'movies', urlImagen: '/default-film-horizontal.png' },
                    { nombre: 'Series', path: '/series', theme: 'series' },
                    { nombre: 'Música', path: '/music', theme: 'music', urlImagen: '/default-music-horizontal.png' }
                ].map((item) => (
                    <HuexCard key={item.path} item={item} variant="horizontal" theme={item.theme} onClick={() => navigate(item.path)} />
                ))}
            </div>
        </div>
    );
}
