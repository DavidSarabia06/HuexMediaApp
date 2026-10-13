import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HuexCard from './HuexCard';
import HuexPageHeader from './HuexPageHeader';
import './css/HuexStyles.css';

function Series({ seriesList, setSeriesList }) {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();


    useEffect(() => {

        const cargarSeries = async () => {
            setIsLoading(true);
            try {

                const response = await fetch(
                    `/api/configuration/get?key=SeriesLibraryPath`
                );

                if (!response.ok) {
                    throw new Error("Error al obtener la configuración");
                }

                const data = await response.json();

                const respuestaScan = await fetch(
                    `/api/series/scan?path=${encodeURIComponent(data.value)}`
                );

                if (!respuestaScan.ok) {
                    throw new Error("Error al escanear las series");
                }

                const carpetasEncontradas = await respuestaScan.json();

                setSeriesList(carpetasEncontradas);

            } catch (error) {
                console.error("Error:", error);
            }
            finally {
                setIsLoading(false);
            }
        };

        cargarSeries();

    }, [setSeriesList]);


    const handleSelectFolder = async () => {
        setIsLoading(true);

        try {
            const respuestaDialogo = await fetch('/api/series/select-folder');

            if (!respuestaDialogo.ok) {
                throw new Error("Error al seleccionar la carpeta");
            }

            const datosDialogo = await respuestaDialogo.json();

            if (datosDialogo.ruta) {

      
                // Escanear la carpeta seleccionada
                const respuestaScan = await fetch(
                    `/api/series/scan?path=${encodeURIComponent(datosDialogo.ruta)}`
                );

                if (!respuestaScan.ok) {
                    throw new Error("Error al escanear la carpeta");
                }

                const carpetasEncontradas = await respuestaScan.json();

                setSeriesList(carpetasEncontradas);

                // Guardar RutaSeries en configuración
                const respuestaConfiguracion = await fetch(
                    '/api/configuration/update',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            clave: 'SeriesLibraryPath',
                            valor: datosDialogo.ruta
                        })
                    }
                );

                if (!respuestaConfiguracion.ok) {
                    throw new Error("Error al guardar la configuración");
                }
            }

        } catch (error) {
            console.error("Error al procesar la carpeta:", error);
            alert("Hubo un error al procesar la carpeta.");
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="huex-container">

            <HuexPageHeader title="Mis series">
                <button className="action-btn" onClick={handleSelectFolder} disabled={isLoading}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="22px" height="22px" style={{ display: 'block' }}>
                        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                    </svg>
                    {isLoading ? 'Cargando...' : 'Seleccionar Carpeta'}
                </button>
            </HuexPageHeader>

            {seriesList.length === 0 ? (
                <div className="empty-state">
                    <h3 style={{ color: '#ffffff', fontSize: '1.5rem', margin: '0 0 10px 0' }}>No hay series cargadas</h3>
                    <p style={{ color: '#8c8c8c' }}>Haz clic en "Seleccionar Carpeta" para escanear tu disco local.</p>
                </div>
            ) : (
                    <div className="huex-grid-vertical">
                    {seriesList.map((serie, index) => (
                        <HuexCard
                            key={index}
                            item={serie}
                            variant="vertical" 
                            showPlayButton={false}
                            onClick={() => navigate('/series/episodes', {
                                state: { folderPath: serie.rutaCompleta, seriesName: serie.nombre }
                            })}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Series;
