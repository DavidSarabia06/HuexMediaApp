import type { RefObject, FormEventHandler } from 'react';
import { useId } from 'react';
import '../css/HuexStyles.css';

export interface NameDialogProps {
    dialogRef: RefObject<HTMLDialogElement | null>;
    name: string;
    title?: string;
    nameLabel?: string;
    submitLabel?: string;
    savingLabel?: string;
    error: string;
    isSaving?: boolean;
    onNameChange: (name: string) => void;
    onSubmit: FormEventHandler<HTMLFormElement>;
    onCancel: () => void;
}
export interface CreateLibraryDialogProps extends NameDialogProps { libraryPath: string; }
export interface DeleteConfirmationDialogProps {
    dialogRef: RefObject<HTMLDialogElement | null>;
    title: string;
    message: string;
    error: string;
    isDeleting?: boolean;
    confirmLabel?: string;
    pendingLabel?: string;
    onSubmit: FormEventHandler<HTMLFormElement>;
    onCancel: () => void;
}
export interface ResumePlaybackDialogProps {
    dialogRef: RefObject<HTMLDialogElement | null>;
    name?: string;
    positionLabel: string;
    onCancel: () => void;
    onRestart: () => void;
    onResume: () => void;
}


// ----------------------- Creación de una biblioteca --------------------------

/** Formulario compartido; la página gestiona el guardado, los estados y su apertura. */
export function CreateLibraryDialog({
    dialogRef,
    title = 'Nueva biblioteca',
    libraryPath,
    name,
    error,
    isSaving = false,
    onNameChange,
    onSubmit,
    onCancel
}: CreateLibraryDialogProps) {
    // Cada instancia tiene sus propios identificadores de accesibilidad.
    const id = useId();
    const titleId = `${id}-title`;
    const pathId = `${id}-path`;
    const nameId = `${id}-name`;
    const errorId = `${id}-error`;

    return (
        <dialog
            ref={dialogRef}
            className="category-dialog"
            aria-labelledby={titleId}
            aria-describedby={pathId}
            onCancel={event => {
                event.preventDefault();
                onCancel();
            }}
        >
            <form
                className="category-dialog-form"
                onSubmit={onSubmit}
                aria-busy={isSaving}
            >
                <h3 id={titleId}>{title}</h3>

                <p id={pathId} style={{ overflowWrap: 'anywhere' }}>
                    {libraryPath}
                </p>

                <label htmlFor={nameId}>
                    Nombre de la biblioteca
                </label>

                <input
                    id={nameId}
                    type="text"
                    value={name}
                    maxLength={80}
                    required
                    autoFocus
                    autoComplete="off"
                    disabled={isSaving}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    onChange={event => {
                        onNameChange(event.target.value);
                    }}
                />

                {error && (
                    <p
                        id={errorId}
                        className="category-dialog-error"
                        role="alert"
                    >
                        {error}
                    </p>
                )}

                <div className="category-dialog-actions">
                    <button
                        type="button"
                        className="category-dialog-cancel"
                        disabled={isSaving}
                        onClick={onCancel}
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        className="action-btn"
                        disabled={isSaving}
                    >
                        {isSaving ? 'Creando…' : 'Crear biblioteca'}
                    </button>
                </div>
            </form>
        </dialog>
    );
}


// ------------------------ Creación de una categoría --------------------------

/** Formulario compartido para introducir el nombre de una categoría o biblioteca. */
export function NameDialog({
    dialogRef,
    name,
    title='Crear categoría',
    nameLabel = 'Nombre de la categoría',
    submitLabel='Crear categoría',
    savingLabel='Creando…',
    error,
    isSaving = false,
    onNameChange,
    onSubmit,
    onCancel
}: NameDialogProps) {
    const id = useId();
    const titleId = `${id}-title`;
    const nameId = `${id}-name`;
    const errorId = `${id}-error`;

    return (
        <dialog
            ref={dialogRef}
            className="category-dialog"
            aria-labelledby={titleId}
            onCancel={event => {
                event.preventDefault();
                onCancel();
            }}
        >
            <form
                className="category-dialog-form"
                onSubmit={onSubmit}
                aria-busy={isSaving}
            >
                <h3 id={titleId}>{title}</h3>

                <label htmlFor={nameId}>{nameLabel}</label>

                <input
                    id={nameId}
                    type="text"
                    value={name}
                    maxLength={80}
                    required
                    autoFocus
                    autoComplete="off"
                    disabled={isSaving}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    onChange={event => {
                        onNameChange(event.target.value);
                    }}
                />

                {error && (
                    <p
                        id={errorId}
                        className="category-dialog-error"
                        role="alert"
                    >
                        {error}
                    </p>
                )}

                <div className="category-dialog-actions">
                    <button
                        type="button"
                        className="category-dialog-cancel"
                        disabled={isSaving}
                        onClick={onCancel}
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        className="action-btn"
                        disabled={isSaving}
                    >
                        {isSaving ? savingLabel : submitLabel}
                    </button>
                </div>
            </form>
        </dialog>
    );
}

// --------------------------- Confirmación de borrado -------------------------

/** Solicita confirmación; la página realiza la eliminación y gestiona los errores. */
export function DeleteConfirmationDialog({
    dialogRef,
    title,
    message,
    error,
    isDeleting = false,
    confirmLabel = 'Eliminar',
    pendingLabel = 'Eliminando…',
    onSubmit,
    onCancel
}: DeleteConfirmationDialogProps) {
    const id = useId();
    const titleId = `${id}-title`;
    const messageId = `${id}-message`;

    return (
        <dialog
            ref={dialogRef}
            className="category-dialog"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            onCancel={event => {
                event.preventDefault();
                onCancel();
            }}
        >
            <form
                className="category-dialog-form"
                onSubmit={onSubmit}
                aria-busy={isDeleting}
            >
                <h3 id={titleId}>{title}</h3>
                <p id={messageId}>{message}</p>

                {error && (
                    <p className="category-dialog-error" role="alert">
                        {error}
                    </p>
                )}

                <div className="category-dialog-actions">
                    <button
                        type="button"
                        className="category-dialog-cancel"
                        autoFocus
                        disabled={isDeleting}
                        onClick={onCancel}
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        className="action-btn category-dialog-delete"
                        disabled={isDeleting}
                    >
                        {isDeleting ? pendingLabel : confirmLabel}
                    </button>
                </div>
            </form>
        </dialog>
    );
}

// -------------------------- Continuar reproducción ---------------------------

/** Permite continuar un vídeo empezado o reproducirlo desde el principio. */
export function ResumePlaybackDialog({
    dialogRef,
    name,
    positionLabel,
    onCancel,
    onRestart,
    onResume
}: ResumePlaybackDialogProps) {
    const id = useId();
    const titleId = `${id}-title`;
    const descriptionId = `${id}-description`;

    return (
        <dialog
            ref={dialogRef}
            className="category-dialog"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onCancel={event => {
                event.preventDefault();
                onCancel();
            }}
        >
            <div className="category-dialog-form">
                <h3 id={titleId}>¿Continuamos?</h3>
                <p id={descriptionId}>{name}</p>

                <div className="category-dialog-actions">
                    <button
                        type="button"
                        className="category-dialog-cancel"
                        onClick={onCancel}
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        className="action-btn"
                        onClick={onRestart}
                    >
                        Empezar de nuevo
                    </button>

                    <button
                        type="button"
                        className="action-btn"
                        autoFocus
                        onClick={onResume}
                    >
                        Continuar desde {positionLabel}
                    </button>
                </div>
            </div>
        </dialog>
    );
}
