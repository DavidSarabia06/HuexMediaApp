import HuexPageHeader from './HuexPageHeader';

export default function Settings() {
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
