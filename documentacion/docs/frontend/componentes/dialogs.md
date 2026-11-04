# Diálogos compartidos

[Frontend](../README.md) · [Código TSX](../../codigo/Dialogs.md)

`components/dialogs.tsx` contiene los formularios reutilizados por Series y Películas. Las páginas mantienen los estados y realizan las peticiones; los diálogos reciben los datos y eventos mediante propiedades.

- `CreateLibraryDialog` solicita el nombre de la biblioteca y muestra su carpeta.
- `NameDialog` utiliza títulos, etiquetas y textos de botones configurables. Sirve para crear categorías y subcategorías y para renombrar grupos o bibliotecas.
- `DeleteConfirmationDialog` muestra la confirmación y sus errores. `confirmLabel` y `pendingLabel` permiten utilizarlo también para reiniciar una serie.
- `ResumePlaybackDialog` ofrece cancelar, empezar de nuevo o continuar desde el minuto guardado.

Cada diálogo recibe una referencia para abrirlo con `showModal()` y cerrarlo con `close()`. Los identificadores generados con `useId` relacionan títulos y descripciones con el diálogo. Los botones se bloquean durante el guardado.
