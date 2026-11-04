using System.Runtime.ExceptionServices;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using HuexMediaApp.Server.Models;

namespace HuexMediaApp.Server.Services;

/// <summary>Abre el selector de carpetas de Windows en el equipo donde se ejecuta el servidor.</summary>
public sealed class WindowsFolderSelectionService
{
    private readonly ILogger<WindowsFolderSelectionService> _logger;

    #region Construcción

    public WindowsFolderSelectionService(ILogger<WindowsFolderSelectionService> logger)
    {
        _logger = logger;
    }

    #endregion

    #region Selección de carpeta

    /// <summary>Abre el diálogo con el texto recibido y devuelve la ruta elegida; cancelar devuelve una cadena vacía.</summary>
    public FolderSelection SelectFolder(string description = "Selecciona una carpeta")
    {
        string selectedPath = string.Empty;
        Exception? dialogError = null;

        // Conserva la ventana activa para que el diálogo se abra asociado a ella desde el hilo STA.
        IntPtr foregroundWindow = GetForegroundWindow();
        Thread thread = new Thread(() =>
        {
            try
            {
                using FolderBrowserDialog dialog = new FolderBrowserDialog
                {
                    Description = description,
                    UseDescriptionForTitle = true,
                    ShowNewFolderButton = false
                };

                DialogResult result;
                if (foregroundWindow != IntPtr.Zero && IsWindow(foregroundWindow))
                {
                    WindowOwner owner = new WindowOwner(foregroundWindow);
                    result = dialog.ShowDialog(owner);
                }
                else
                {
                    _logger.LogWarning("No hay una ventana activa válida para asociar el selector de carpeta.");
                    result = dialog.ShowDialog();
                }

                if (result == DialogResult.OK)
                {
                    selectedPath = dialog.SelectedPath;
                }
            }
            catch (Exception exception)
            {
                // El error se recoge aquí para poder propagarlo al hilo que solicitó el selector.
                dialogError = exception;
            }
        });

        // Windows Forms necesita STA. Join espera a que el usuario cierre el diálogo.
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (dialogError is not null)
        {
            ExceptionDispatchInfo.Capture(dialogError).Throw();
        }


        return new FolderSelection { Ruta = selectedPath }; 
    }

    #endregion

    #region Ventana propietaria de Windows

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(IntPtr windowHandle);

    /// <summary>Permite usar una ventana existente como propietaria del diálogo de Windows Forms.</summary>
    private sealed class WindowOwner : IWin32Window
    {
        public IntPtr Handle { get; }

        public WindowOwner(IntPtr handle)
        {
            Handle = handle;
        }
    }

    #endregion
}
