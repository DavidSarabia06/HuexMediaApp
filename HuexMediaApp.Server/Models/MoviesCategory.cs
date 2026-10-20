namespace HuexMediaApp.Server.Models
{
    #region Datos de categorías

    /// <summary>
    /// Representa una categoría y las subcategorias asignadas a ella.
    /// Se almacena dentro del JSON de la biblioteca y se devuelve en las respuestas de la API.
    /// </summary>
    public class MoviesCategory
    {
        /// <summary>Identificador estable que genera el servicio al crear la categoría.</summary>
        public Guid Id { get; set; }

        /// <summary>Nombre visible, único en su biblioteca sin distinguir mayúsculas.</summary>
        public string Name { get; set; } = "";

        /// <summary>Películas asignadas directamente a la categoría, sin subcategoría.</summary>
        public List<string> MoviesPaths { get; set; } = [];

        /// <summary>
        /// listas de subcategorias.
        /// Una misma peli solo puede estar asignada a una subcategoria.
        /// </summary>
        public List<MoviesSubcategory> MoviesSubcategories { get; set; } = [];
    }

    public class MoviesSubcategory
    {
        /// <summary>Identificador estable que genera el servicio al crear la subcategoría.</summary>
        public Guid Id { get; set; }

        /// <summary>Nombre visible, único en su biblioteca sin distinguir mayúsculas.</summary>
        public string Name { get; set; } = "";

        /// <summary>
        /// Rutas absolutas de las carpetas de pelis asignadas, hijas directas de la biblioteca.
        /// Una misma peli solo puede estar asignada a una subcategoria.
        /// </summary>
        public List<string> MoviesPaths { get; set; } = [];
    }

    /// <summary>Contenido raíz del JSON que guarda la organización de una biblioteca.</summary>
    public sealed class MoviesCategoryLibrary
    {
        /// <summary>Versión del formato de datos; el servicio admite actualmente la versión 1.</summary>
        public int Version { get; set; } = 1;

        /// <summary>Ruta absoluta de la biblioteca a la que pertenece el archivo.</summary>
        public string LibraryPath { get; set; } = "";

        /// <summary>Categorías guardadas; una biblioteca nueva comienza con la lista vacía.</summary>
        public List<MoviesCategory> Categories { get; set; } = [];
    }
}




#endregion

#region Solicitudes de la API

/// <summary>
/// Datos recibidos por el controlador para crear una categoría.
/// El servicio normaliza la ruta, recorta el nombre y valida sus reglas.
/// </summary>
public sealed class CreateMoviesCategoryRequest
{
    /// <summary>Biblioteca existente en la que se creará la categoría.</summary>
    public string LibraryPath { get; set; } = "";

    /// <summary>Nombre solicitado; se valida después de recortar los espacios de los extremos.</summary>
    public string CategoryName { get; set; } = "";
}
public sealed class CreateMoviesSubcategoryRequest
{
    /// <summary>Biblioteca existente en la que se creará la categoría.</summary>
    public string LibraryPath { get; set; } = "";

    /// <summary>Nombre solicitado; se valida después de recortar los espacios de los extremos.</summary>
    public string SubcategoryName { get; set; } = "";

    public Guid? CategoryId { get; set; }
}

/// <summary>Datos recibidos para cambiar la categoría de una serie o dejarla sin asignación.</summary>
public sealed class MoveMoviesCategoryRequest
{
    /// <summary>Biblioteca existente a la que pertenece la serie.</summary>
    public string LibraryPath { get; set; } = "";

    /// <summary>Ruta absoluta de la peli que se desea mover entre categorias y subcategorias.</summary>
    public string MoviePath { get; set; } = "";

    /// <summary>
    /// Categoría de destino; null significa «Sin categoría».
    /// Guid.Empty no equivale a null ni identifica una categoría válida.
    /// </summary>
    public Guid? CategoryId { get; set; }
    public Guid? SubcategoryId { get; set; }
}

#endregion
