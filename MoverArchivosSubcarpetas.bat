@echo off
setlocal
set "HUEX_MOVE_SCRIPT=%~f0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$source = [System.IO.File]::ReadAllText($env:HUEX_MOVE_SCRIPT); $marker = '# POWERSHELL_' + 'START'; $code = $source.Substring($source.IndexOf($marker) + $marker.Length); & ([scriptblock]::Create($code))"
set "moveExitCode=%errorlevel%"
echo.
pause
exit /b %moveExitCode%

# POWERSHELL_START
$ErrorActionPreference = 'Stop'
$rootPath = [System.IO.Path]::GetFullPath([System.IO.Path]::GetDirectoryName($env:HUEX_MOVE_SCRIPT))
$rootPrefix = $rootPath.TrimEnd('\') + '\'
$filesToMove = New-Object 'System.Collections.Generic.List[System.IO.FileInfo]'
$foldersToCheck = New-Object 'System.Collections.Generic.List[string]'

function Collect-Files([string] $folderPath) {
    foreach ($entry in Get-ChildItem -LiteralPath $folderPath -Force) {
        # No sigue enlaces ni uniones que puedan apuntar fuera de esta carpeta.
        if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            continue
        }
        if ($entry.PSIsContainer) {
            Collect-Files $entry.FullName
            # Registra primero los hijos para borrar las carpetas desde dentro hacia fuera.
            $foldersToCheck.Add($entry.FullName)
        }
        elseif (-not [string]::Equals($folderPath, $rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
            $filesToMove.Add($entry)
        }
    }
}

try {
    Write-Host "Carpeta de destino: $rootPath"
    Write-Host 'Buscando archivos en las subcarpetas...'
    # Reune la lista antes de mover para no volver a procesar los archivos trasladados.
    Collect-Files $rootPath
}
catch {
    Write-Host "No se ha podido completar la busqueda: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$movedCount = 0
$failedCount = 0
foreach ($file in $filesToMove) {
    try {
        $sourcePath = [System.IO.Path]::GetFullPath($file.FullName)
        $destinationPath = Join-Path $rootPath $file.Name
        $suffix = 1
        while (Test-Path -LiteralPath $destinationPath) {
            $newName = '{0} ({1}){2}' -f $file.BaseName, $suffix, $file.Extension
            $destinationPath = Join-Path $rootPath $newName
            $suffix++
        }

        # Comprueba que el origen pertenece a esta carpeta y el destino esta directamente en su raiz.
        $destinationPath = [System.IO.Path]::GetFullPath($destinationPath)
        $destinationParent = [System.IO.Path]::GetDirectoryName($destinationPath)
        if (-not $sourcePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
            -not [string]::Equals($destinationParent, $rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw 'La ruta del archivo esta fuera de la carpeta prevista.'
        }

        Move-Item -LiteralPath $sourcePath -Destination $destinationPath -ErrorAction Stop
        $movedCount++
        Write-Host ('Movido: {0} -> {1}' -f $file.FullName, [System.IO.Path]::GetFileName($destinationPath))
    }
    catch {
        $failedCount++
        Write-Host "No se pudo mover '$($file.FullName)': $($_.Exception.Message)" -ForegroundColor Red
    }
}

$deletedFolderCount = 0
foreach ($folder in $foldersToCheck) {
    try {
        $folderPath = [System.IO.Path]::GetFullPath($folder)
        if (-not $folderPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw 'La carpeta esta fuera de la ruta prevista.'
        }

        $folderInfo = Get-Item -LiteralPath $folderPath -Force
        if (($folderInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            continue
        }

        # Incluye archivos ocultos. Delete con false solo elimina carpetas vacias, sin borrado recursivo.
        if (@(Get-ChildItem -LiteralPath $folderPath -Force).Count -eq 0) {
            [System.IO.Directory]::Delete($folderPath, $false)
            $deletedFolderCount++
            Write-Host "Carpeta vacia eliminada: $folderPath"
        }
    }
    catch {
        $failedCount++
        Write-Host "No se pudo limpiar '$folder': $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "Terminados: $movedCount archivos movidos. Carpetas vacias eliminadas: $deletedFolderCount. Errores: $failedCount."
if ($failedCount -gt 0) {
    exit 1
}
exit 0
