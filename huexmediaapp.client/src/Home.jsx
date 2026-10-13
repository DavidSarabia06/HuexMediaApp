import { useNavigate } from 'react-router-dom';
import HuexCard from './HuexCard';
import HuexPageHeader from './HuexPageHeader';

export default function Home() {
    const navigate = useNavigate();
    return (
        <div className="huex-container">
            <HuexPageHeader title="Mi biblioteca" />
            <p className="huex-description">Tus películas, series y música en un solo lugar.</p>
            <div className="huex-grid huex-home-grid">
                {[
                    { nombre: 'Películas', path: '/movies' },
                    { nombre: 'Series', path: '/series' },
                    { nombre: 'Música', path: '/music' }
                ].map((item) => (
                    <HuexCard key={item.path} item={item} variant="horizontal" onClick={() => navigate(item.path)} />
                ))}
            </div>
        </div>
    );
}
