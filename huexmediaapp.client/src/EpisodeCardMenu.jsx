import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function EpisodeCardMenu({ name, watched, onSetWatched, disabled }) {
    const [menu, setMenu] = useState(null);
    const anchorRef = useRef(null);
    const menuRef = useRef(null);
    const menuId = useId();

    function close(restoreFocus = true) {
        setMenu(null);
        if (restoreFocus) anchorRef.current?.focus({ preventScroll: true });
    }

    useEffect(() => {
        if (!menu) return;
        menuRef.current?.querySelector('button')?.focus({ preventScroll: true });
        function outside(event) {
            if (!menuRef.current?.contains(event.target) && !anchorRef.current?.contains(event.target)) setMenu(null);
        }
        function dismiss() { setMenu(null); }
        document.addEventListener('pointerdown', outside, true);
        document.addEventListener('scroll', dismiss, true);
        window.addEventListener('resize', dismiss);
        return () => {
            document.removeEventListener('pointerdown', outside, true);
            document.removeEventListener('scroll', dismiss, true);
            window.removeEventListener('resize', dismiss);
        };
    }, [menu]);

    return <>
        <button ref={anchorRef} type="button" className="series-category-options episode-card-options"
            disabled={disabled} aria-label={`Opciones de ${name}`} aria-haspopup="menu"
            aria-expanded={Boolean(menu)} aria-controls={menu ? menuId : undefined}
            onClick={event => {
                event.stopPropagation();
                if (menu) { close(); return; }
                const rect = event.currentTarget.getBoundingClientRect();
                const width = Math.min(250, window.innerWidth - 24);
                setMenu({ '--huex-accent': window.getComputedStyle(event.currentTarget).getPropertyValue('--huex-accent'),
                    width, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
                    top: Math.max(12, rect.bottom + 70 < window.innerHeight ? rect.bottom + 8 : rect.top - 58) });
            }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
            </svg>
        </button>
        {menu && createPortal(<div ref={menuRef} id={menuId} role="menu" className="series-category-menu"
            aria-label={`Estado de ${name}`} style={menu}
            onKeyDown={event => {
                if (['Escape', 'Tab'].includes(event.key)) { event.preventDefault(); close(); }
                if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    menuRef.current?.querySelector('button')?.focus();
                }
            }}>
            <button type="button" role="menuitem" tabIndex={-1} disabled={disabled} onClick={() => {
                close();
                onSetWatched(!watched);
            }}>{watched ? 'Marcar como no visto' : 'Marcar como visto'}</button>
        </div>, document.body)}
    </>;
}
