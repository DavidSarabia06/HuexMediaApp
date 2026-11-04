using System.Text.Json;

namespace HuexMediaApp.Server.Services;

/// <summary>Lee documentos JSON y los guarda mediante un archivo temporal.</summary>
public sealed class JsonFileStoreService
{
    private static readonly JsonSerializerOptions JsonOptions =
        new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            WriteIndented = true
        };

    #region Lectura

    /// <summary>Lee el documento; devuelve null si el archivo o su carpeta todavía no existen.</summary>
    public async Task<T?> ReadAsync<T>(
        string filePath,
        CancellationToken cancellationToken = default)
        where T : class
    {
        try
        {
            await using FileStream stream = new FileStream(
                filePath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read);

            T? document = await JsonSerializer.DeserializeAsync<T>(
                stream,
                JsonOptions,
                cancellationToken);

            if (document is null)
            {
                throw new InvalidDataException(
                    $"El archivo '{Path.GetFileName(filePath)}' contiene un documento vacío.");
            }

            return document;
        }
        catch (FileNotFoundException)
        {
            return null;
        }
        catch (DirectoryNotFoundException)
        {
            return null;
        }
        catch (JsonException exception)
        {
            throw new InvalidDataException(
                $"El archivo '{Path.GetFileName(filePath)}' no contiene un JSON válido.",
                exception);
        }
    }

    #endregion

    #region Guardado

    /// <summary>Escribe el documento completo antes de sustituir el archivo definitivo.</summary>
    public async Task WriteAsync<T>(
        string filePath,
        T document,
        CancellationToken cancellationToken = default)
        where T : class
    {
        ArgumentNullException.ThrowIfNull(document);

        string destination = Path.GetFullPath(filePath);
        string directory = Path.GetDirectoryName(destination)!;

        Directory.CreateDirectory(directory);

        // El temporal se crea junto al destino para poder sustituirlo en el mismo disco.
        string temporary = destination + "." + Guid.NewGuid().ToString("N") + ".tmp";

        try
        {
            await WriteTemporaryFileAsync(
                temporary,
                document,
                cancellationToken);

            cancellationToken.ThrowIfCancellationRequested();

            if (File.Exists(destination))
            {
                File.Replace(temporary, destination, null);
            }
            else
            {
                File.Move(temporary, destination);
            }
        }
        finally
        {
            TryDeleteTemporaryFile(temporary);
        }
    }

    /// <summary>Serializa el documento y solicita el vaciado de los datos a disco.</summary>
    private static async Task WriteTemporaryFileAsync<T>(
        string temporary,
        T document,
        CancellationToken cancellationToken)
        where T : class
    {
        await using FileStream stream = new FileStream(
            temporary,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            4096,
            FileOptions.Asynchronous | FileOptions.WriteThrough);

        await JsonSerializer.SerializeAsync(
            stream,
            document,
            JsonOptions,
            cancellationToken);

        // Vacía los datos pendientes del stream y solicita su escritura física en disco.
        await stream.FlushAsync(cancellationToken);
        stream.Flush(flushToDisk: true);
    }

    #endregion

    #region Limpieza del temporal

    /// <summary>Retira el temporal sobrante sin sustituir el error original del guardado.</summary>
    private static void TryDeleteTemporaryFile(string temporary)
    {
        try
        {
            File.Delete(temporary);
        }
        catch (IOException)
        {
            // El archivo puede estar bloqueado; se conserva el resultado original.
        }
        catch (UnauthorizedAccessException)
        {
            // Un fallo de permisos en la limpieza no sustituye al error original.
        }
    }

    #endregion
}