import { useState, useEffect } from 'react';

function Settings() {

    useEffect(() => {
        // Cargamos la preferencia guardada al abrir la pantalla
        
    }, []);



    return (
        <div style={{ padding: '20px 40px', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ color: '#00e676', letterSpacing: '2px', fontSize: '1.8rem', margin: '0 0 20px 0' }}>CONFIGURACIÓN</h2>
            <hr style={{ borderColor: '#2a2a2a', borderStyle: 'solid', borderWidth: '1px 0 0 0', marginBottom: '30px' }} />

        </div>
    );
}

export default Settings;