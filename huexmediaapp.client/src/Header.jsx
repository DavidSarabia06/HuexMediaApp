import { Link } from 'react-router-dom';

function Header() {
    const headerStyle = {
        backgroundColor: '#111111',
        padding: '15px 30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #2a2a2a'
    };

    const logoStyle = {
        color: '#E50914',
        fontSize: '24px',
        fontWeight: '900',
        textDecoration: 'none',
        fontFamily: 'Arial, sans-serif',
        letterSpacing: '1px'
    };

    // Nuevo estilo para agrupar los iconos
    const navGroupStyle = {
        display: 'flex',
        gap: '25px', // Separación entre cada icono
        alignItems: 'center'
    };


    const iconStyle = {
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer'
    };

    return (
        <header style={headerStyle}>
            <Link to="/" style={logoStyle}>
                HUEX MEDIA APP
            </Link>

            {/* Contenedor que agrupa todos los botones a la derecha */}
            <div style={navGroupStyle}>

                <Link to="/movies" style={iconStyle} className="nav-icon" title="Películas">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="28px" height="28px">
                        <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
                    </svg>
                </Link>

                <Link to="/series" style={iconStyle} className="nav-icon" title="Series">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="28px" height="28px">
                        <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
                    </svg>
                </Link>

                <Link to="/music" style={iconStyle} className="nav-icon" title="Música">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="28px" height="28px">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                </Link>

                <Link to="/" style={iconStyle} className="nav-icon" title="Volver al inicio">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="28px" height="28px">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                    </svg>
                </Link>

                <Link to="/settings" style={iconStyle} className="nav-icon" title="Configuracion">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="28px" height="28px">
                        <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94l-0.36-2.54c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41l-0.36,2.54c-0.59,0.24-1.13,0.57-1.62,0.94l-2.39-0.96c-0.22-0.08-0.47,0-0.59,0.22 l-1.92,3.32c-0.12,0.21-0.08,0.47,0.12,0.61l2.03,1.58c-0.05,0.3-0.09,0.63-0.09,0.94s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
                    </svg>
                </Link>

            </div>
        </header>
    );
}

export default Header;
