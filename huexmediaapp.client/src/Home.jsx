import { useNavigate } from 'react-router-dom';
import HuexCard from './HuexCard';
import HuexPageHeader from './HuexPageHeader';

// -------------------------- Secciones de biblioteca --------------------------

const librarySections = [
    { nombre: 'Películas', path: '/movies', theme: 'movies', urlImagen: '/default-film-horizontal.png' },
    { nombre: 'Series', path: '/series', theme: 'series' },
    { nombre: 'Música', path: '/music', theme: 'music', urlImagen: '/default-music-horizontal.png' }
];

/** Muestra los accesos a películas, series y música de la biblioteca. */
export default function Home() {
    // -------------------------------- Navegación ---------------------------------

    const navigate = useNavigate();

    /** Abre la sección correspondiente a la tarjeta seleccionada. */
    function openSection(path) {
        navigate(path);
    }

    // -------------------------------- Renderizado --------------------------------

    return (
        <div className="huex-container">
            <HuexPageHeader title="Mi biblioteca" outlinedTitle />
            <p className="huex-description">Tus películas, series y música en un solo lugar.</p>
            <div className="huex-grid huex-home-grid">
                {librarySections.map((item) => (
                    <HuexCard
                        key={item.path}
                        item={item}
                        variant="horizontal"
                        theme={item.theme}
                        onClick={() => openSection(item.path)}
                    />
                ))}
            </div>
        </div>
    );
}
