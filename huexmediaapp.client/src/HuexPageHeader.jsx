import './css/HuexStyles.css';

export default function HuexPageHeader({ title, onBack, children, outlinedTitle = false }) {
    return (
        <>
            <div className={`huex-header${outlinedTitle ? ' huex-header-outlined' : ''}`}>
                {onBack && (
                    <button onClick={onBack} className="back-btn" aria-label="Volver">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32" aria-hidden="true">
                            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                        </svg>
                    </button>
                )}
                <h2 className="huex-title">
                    {outlinedTitle ? <span className="huex-title-outline">{title}</span> : title}
                </h2>
                {children && <div className="huex-header-actions">{children}</div>}
            </div>
            <hr className="huex-divider" />
        </>
    );
}
