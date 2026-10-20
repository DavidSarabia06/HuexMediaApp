using System.Text.Json.Serialization;

namespace HuexMediaApp.Server.Models
{
    public class MoviesMediaItem
    {
        /// <summary>Nombre de la carpeta de serie o del archivo de vídeo sin extensión.</summary>
        public string Nombre { get; set; } = "";

        /// <summary>Ruta de la carpeta o del vídeo que representa la tarjeta.</summary>
        public string RutaCompleta { get; set; } = "";

        /// <summary>URL de la imagen local o de la imagen predeterminada.</summary>
        public string UrlImagen { get; set; } = "";

        /// <summary>Ruta interna que el controlador convierte en URL; nunca se envía como propiedad JSON.</summary>
        [JsonIgnore]
        public string? ImagePath { get; set; }
    }
}
