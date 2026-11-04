import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface HuexCardMenuItem {
    /** Identificador estable de la opción. */
    id: string;
    /** Texto de la opción. */
    label: string;
    /** Acción que ejecuta el componente padre. */
    onSelect?: () => void;
    /** Opciones del submenú. */
    children?: HuexCardMenuItem[];
    /** Estado seleccionado de una opción de categoría. */
    checked?: boolean;
    /** Devuelve el foco al cerrar; false para acciones que abren un diálogo. */
    restoreFocus?: boolean;
    /** Deshabilita esta opción. */
    disabled?: boolean;
}

export interface HuexCardMenuProps {
    /** Título de la tarjeta usado en los textos accesibles. */
    name: string;
    /** Opciones que proporciona el componente padre. */
    menuItems: HuexCardMenuItem[];
    /** Encabezado opcional del menú principal. */
    title?: string;
    /** Deshabilita el botón de opciones y la acción del menú. */
    disabled?: boolean;
}

/**
 * Muestra las acciones de una tarjeta en un menú independiente de su contenido.
 * @param props Propiedades del menú.
 */
export default function HuexCardMenu(props: HuexCardMenuProps) {
    const { name, menuItems = [], disabled = false, title = '' } = props;
    // null: cerrado; un objeto guarda la posición y el color del menú abierto.
    const [menuPosition, setMenuPosition] = useState<(React.CSSProperties & {"--huex-accent": string}) | null>(null);
    // Guarda los identificadores de los submenús abiertos para permitir volver atrás.
    const [submenuPath, setSubmenuPath] = useState<string[]>([]);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();
    const returnFocusIdRef = useRef<string | null>(null);

    // ------------------------------ Nivel del menú -------------------------------

    let currentItems = menuItems;
    let currentTitle = title;
    for (const itemId of submenuPath) {
        const parentItem = currentItems.find(item => item.id === itemId);
        currentItems = parentItem?.children ?? [];
        currentTitle = parentItem?.label ?? '';
    }

    // ------------------------------ Posicionamiento ------------------------------

    /** Fija la posición inicial junto al botón y reserva el espacio inferior para el scroll. */
    function calculatePosition(items: HuexCardMenuItem[], heading: string, isSubmenu: boolean) {
        const button = buttonRef.current!;
        const buttonBounds = button.getBoundingClientRect();
        const menuWidth = Math.min(260, window.innerWidth - 24);
        const extraHeight = (heading ? 36 : 0) + (isSubmenu ? 40 : 0);
        const menuHeight = items.length * 40 + 18 + extraHeight;
        const spaceBelow = window.innerHeight - buttonBounds.bottom - 20;
        const spaceAbove = buttonBounds.top - 20;
        const opensBelow = spaceBelow >= menuHeight || spaceBelow >= spaceAbove;
        const maxHeight = Math.max(40, Math.min(340, opensBelow ? spaceBelow : spaceAbove));
        const left = Math.max(12, Math.min(
            buttonBounds.right - menuWidth,
            window.innerWidth - menuWidth - 12
        ));
        const top = Math.max(12, opensBelow
            ? buttonBounds.bottom + 8
            : buttonBounds.top - Math.min(menuHeight, maxHeight) - 8);

        return {
            '--huex-accent': window.getComputedStyle(button).getPropertyValue('--huex-accent'),
            width: menuWidth,
            maxHeight: Math.max(1, Math.min(340, window.innerHeight - top - 12)),
            left,
            top
        };
    }

    // ----------------------------- Apertura y cierre -----------------------------

    /** Cierra el desplegable, limpia el recorrido y, por defecto, devuelve el foco a los tres puntos. */
    function closeMenu(restoreFocus = true) {
        setMenuPosition(null);
        setSubmenuPath([]);
        returnFocusIdRef.current = null;
        if (restoreFocus) {
            buttonRef.current?.focus({ preventScroll: true });
        }
    }

    /** Alterna la apertura al pulsar los tres puntos y calcula dónde colocar el menú. */
    function handleToggleMenu(event: React.MouseEvent<HTMLButtonElement>) {
        event.stopPropagation();
        if (menuPosition) {
            closeMenu();
            return;
        }
        setSubmenuPath([]);
        returnFocusIdRef.current = null;
        setMenuPosition(calculatePosition(menuItems, title, false));
    }

    // -------------------------- Navegación por submenús --------------------------

    /** Vuelve al nivel anterior sin cambiar la posición y recupera el foco de su opción. */
    function goBack() {
        const parentId = submenuPath[submenuPath.length - 1];
        const parentPath = submenuPath.slice(0, -1);
        returnFocusIdRef.current = parentId;
        setSubmenuPath(parentPath);
    }

    /** Abre los hijos de una opción o cierra el menú antes de ejecutar su acción. */
    function handleSelectItem(item: HuexCardMenuItem) {
        if (disabled || item.disabled) {
            return;
        }
        if (item.children) {
            returnFocusIdRef.current = null;
            // Conserva el anclaje inicial; las opciones adicionales usan el scroll del menú.
            setSubmenuPath([...submenuPath, item.id]);
            return;
        }
        closeMenu(item.restoreFocus !== false);
        item.onSelect?.();
    }

    // ---------------------------- Eventos de teclado -----------------------------

    /** Recorre las opciones habilitadas, abre o vuelve de submenús y cierra con Escape/Tab. */
    function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (event.key === 'ArrowLeft' && submenuPath.length > 0) {
            event.preventDefault();
            goBack();
            return;
        }
        if (event.key === 'ArrowRight') {
            const focusedItem = currentItems.find(item => item.id === (document.activeElement as HTMLElement | null)?.dataset.menuItemId);
            if (focusedItem?.children && !disabled && !focusedItem.disabled) {
                event.preventDefault();
                handleSelectItem(focusedItem);
            }
            return;
        }
        if (['Escape', 'Tab'].includes(event.key)) {
            event.preventDefault();
            closeMenu();
            return;
        }

        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const options = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(
                '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)'
            ) ?? []);
            if (options.length === 0) {
                return;
            }
            const currentIndex = options.indexOf(document.activeElement as HTMLElement);
            let nextIndex;
            if (event.key === 'Home') {
                nextIndex = 0;
            } else if (event.key === 'End') {
                nextIndex = options.length - 1;
            } else if (event.key === 'ArrowDown') {
                nextIndex = (currentIndex + 1) % options.length;
            } else {
                nextIndex = currentIndex < 0 ? options.length - 1 : (currentIndex - 1 + options.length) % options.length;
            }
            options[nextIndex].focus();
        }
    }

    // ------------------------- Eventos exteriores y foco -------------------------

    // Al abrir o cambiar de nivel, enfoca la opción de vuelta, la marcada o la primera habilitada.
    // Registra los cierres exteriores; la limpieza retira los eventos al cerrar, repetir o desmontar.
    useEffect(() => {
        if (!menuPosition) {
            return;
        }
        const options = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(
            '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)'
        ) ?? []);
        const returnOption = options.find(option => option.dataset.menuItemId === returnFocusIdRef.current);
        const checkedOption = options.find(option => option.getAttribute('aria-checked') === 'true');
        (returnOption ?? checkedOption ?? options[0])?.focus({ preventScroll: true });
        returnFocusIdRef.current = null;

        /** Cierra al pulsar fuera del menú y del botón, conservando el foco de la interacción exterior. */
        function handleOutsidePointerDown(event: PointerEvent) {
            const clickedMenu = menuRef.current?.contains(event.target as Node | null);
            const clickedButton = buttonRef.current?.contains(event.target as Node | null);
            if (!clickedMenu && !clickedButton) {
                setMenuPosition(null);
            }
        }

        /** Cierra ante resize o scroll exterior, pero permite desplazar las opciones dentro del menú. */
        function dismissMenu(event: Event) {
            if (event.target instanceof Node && menuRef.current?.contains(event.target as Node | null)) {
                return;
            }
            setMenuPosition(null);
        }
        document.addEventListener('pointerdown', handleOutsidePointerDown, true);
        document.addEventListener('scroll', dismissMenu, true);
        window.addEventListener('resize', dismissMenu);
        // Retira los eventos al cerrar o desmontar el componente.
        return () => {
            document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
            document.removeEventListener('scroll', dismissMenu, true);
            window.removeEventListener('resize', dismissMenu);
        };
    }, [menuPosition, submenuPath]);

    // ---------------------------- Evento de arrastre -----------------------------
    /** Evita que arrastrar los tres puntos inicie el movimiento de la tarjeta que los contiene. */
    function handleButtonDragStart(event: React.DragEvent<HTMLButtonElement>) {
        event.preventDefault();
        event.stopPropagation();
    }

    // --------------------------- Renderizado del menú ----------------------------

    const isMenuOpen = Boolean(menuPosition);

    if (menuItems.length === 0) {
        return null;
    }

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className="series-category-options episode-card-options"
                disabled={disabled}
                aria-label={`Opciones de ${name}`}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                aria-controls={isMenuOpen ? menuId : undefined}
                onClick={handleToggleMenu}
                draggable={false}
                onDragStart={handleButtonDragStart}
            >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                </svg>
            </button>

            {/* El portal sitúa el menú fuera de la tarjeta para evitar recortes. */}
            {isMenuOpen && createPortal(
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    className="series-category-menu"
                    aria-label={`Opciones de ${name}`}
                    style={menuPosition ?? undefined}
                    onKeyDown={handleMenuKeyDown}
                >
                    {submenuPath.length > 0 && <button type="button" role="menuitem" tabIndex={-1}
                        disabled={disabled} onClick={goBack}>‹ Volver a opciones</button>}
                    {currentTitle && <div className="series-category-menu-title">{currentTitle}</div>}
                    {currentItems.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            role={typeof item.checked === 'boolean' ? 'menuitemradio' : 'menuitem'}
                            aria-checked={typeof item.checked === 'boolean' ? item.checked : undefined}
                            aria-haspopup={item.children ? 'menu' : undefined}
                            data-menu-item-id={item.id}
                            tabIndex={-1}
                            disabled={disabled || item.disabled}
                            onClick={() => handleSelectItem(item)}
                        >
                            <span>{item.label}</span>
                            {item.children && <span aria-hidden="true">›</span>}
                            {item.checked && <span className="series-category-menu-check" aria-hidden="true">✓</span>}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}
