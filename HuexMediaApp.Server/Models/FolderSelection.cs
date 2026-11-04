namespace HuexMediaApp.Server.Models
{ 

    /// <summary>Resultado de seleccionar una carpeta en Windows.</summary>
    public sealed class FolderSelection
    {
        /// <summary>Ruta seleccionada; queda vacía si el usuario cancela.</summary>
        public string Ruta { get; set; } = "";
    }

  
}
