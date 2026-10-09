import { Link } from 'react-router-dom';
function Home() {
    const cardStyle = {
        display: 'inline-block', padding: '30px 50px', margin: '10px',
        backgroundColor: '#1e1e1e', color: 'white', textDecoration: 'none',
        borderRadius: '10px', fontSize: '1.5rem', fontWeight: 'bold',
        transition: 'transform 0.2s'
    };

    return (
        <div style={{ textAlign: 'center', padding: '50px', fontFamily: 'sans-serif' }}>
            <h1>Bienvenido a Huexflix App</h1>
            <div style={{ marginTop: '40px' }}>
                <Link to="/peliculas" style={cardStyle}>🎬 Películas</Link>
                <Link to="/series" style={cardStyle}>📺 Series</Link>
                <Link to="/musica" style={cardStyle}>🎵 Música</Link>
            </div>
        </div>
    );
}
export default Home;