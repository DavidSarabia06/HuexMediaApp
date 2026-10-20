import HuexPageHeader from './HuexPageHeader';

// -------------------------- Página de configuración --------------------------

/** Muestra la página de configuración y orienta al usuario hacia la selección de carpeta en Series. */
export default function Settings() {
    // ------------------------------ Renderizado -------------------------------

    return (
        <div className="huex-container">
            <HuexPageHeader title="Configuración" />
            <div className="empty-state">
                <h3>Configuración de la biblioteca</h3>
                <p className="huex-description">Puedes seleccionar la carpeta de tu biblioteca desde la sección Series.</p>
            </div>
        </div>
    );
}
