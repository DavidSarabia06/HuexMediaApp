# Identifica únicamente instancias de MkDocs de este proyecto y del puerto elegido.
function Test-DocumentationProcess {
    param($ProcessInfo, [string]$ConfigPath, [string]$DocsPython, [int]$Port)

    if ($null -eq $ProcessInfo -or $ProcessInfo.Name -notmatch '^python(w)?\.exe$' -or
        [string]::IsNullOrWhiteSpace($ProcessInfo.CommandLine)) {
        return $false
    }

    [string[]]$arguments = @([regex]::Matches($ProcessInfo.CommandLine, '"[^"]*"|\S+') |
        ForEach-Object { $_.Value.Trim('"') })
    $moduleIndex = [Array]::IndexOf($arguments, '-m')
    $configIndex = [Array]::IndexOf($arguments, '--config-file')
    $addressIndex = [Array]::IndexOf($arguments, '--dev-addr')
    if ($moduleIndex -lt 0 -or $moduleIndex + 2 -ge $arguments.Length -or
        $arguments[$moduleIndex + 1] -ne 'mkdocs' -or $arguments[$moduleIndex + 2] -ne 'serve' -or
        $configIndex -lt 0 -or $configIndex + 1 -ge $arguments.Length -or
        $addressIndex -lt 0 -or $addressIndex + 1 -ge $arguments.Length) {
        return $false
    }
    if ($arguments[$addressIndex + 1] -notin @("127.0.0.1:$Port", "localhost:$Port", "[::1]:$Port")) {
        return $false
    }

    $candidateConfig = $arguments[$configIndex + 1]
    if (-not [System.IO.Path]::IsPathRooted($candidateConfig)) {
        # Los lanzamientos antiguos usaban una ruta relativa. Solo se admiten
        # cuando el ejecutable es el entorno propio de esta documentación.
        if ([string]::IsNullOrWhiteSpace($ProcessInfo.ExecutablePath) -or
            -not [string]::Equals([System.IO.Path]::GetFullPath($ProcessInfo.ExecutablePath),
                [System.IO.Path]::GetFullPath($DocsPython), [StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
        $repositoryRoot = Split-Path -Parent (Split-Path -Parent $ConfigPath)
        $candidateConfig = Join-Path $repositoryRoot $candidateConfig
    }
    try {
        return [string]::Equals([System.IO.Path]::GetFullPath($candidateConfig),
            [System.IO.Path]::GetFullPath($ConfigPath), [StringComparison]::OrdinalIgnoreCase)
    } catch {
        return $false
    }
}

function Stop-PreviousDocumentationServer {
    param([string]$ConfigPath, [string]$DocsPython, [int]$Port)

    # netstat permite localizar el dueño del puerto sin modificar la red.
    $listenerIds = @(& netstat.exe -ano -p tcp | ForEach-Object {
        $columns = $_.Trim() -split '\s+'
        if ($columns.Length -eq 5 -and $columns[0] -eq 'TCP' -and
            $columns[1] -match ":$Port$" -and $columns[3] -eq 'LISTENING') {
            [int]$columns[4]
        }
    } | Select-Object -Unique)

    foreach ($listenerId in $listenerIds) {
        try {
            $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerId" -ErrorAction Stop
        } catch {
            throw "El puerto $Port esta ocupado y no se ha podido comprobar su proceso. No se ha detenido ninguna aplicacion."
        }
        if ($null -eq $owner) { continue }

        # El Python de un entorno virtual puede lanzar un segundo Python.
        # Comprueba la cadena para reconocer el lanzador propio con ruta relativa.
        $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($owner.ParentProcessId)" -ErrorAction Stop
        $isOwner = Test-DocumentationProcess $owner $ConfigPath $DocsPython $Port
        $isParent = Test-DocumentationProcess $parent $ConfigPath $DocsPython $Port
        # El ejecutable cambia entre el lanzador del entorno y su Python real;
        # los argumentos de MkDocs deben ser exactamente los mismos.
        $ownerArguments = $owner.CommandLine -replace '^(?:"[^"]*"|\S+)\s*', ''
        $parentArguments = if ($null -ne $parent) { $parent.CommandLine -replace '^(?:"[^"]*"|\S+)\s*', '' } else { '' }
        $sameCommand = $null -ne $parent -and $ownerArguments -ceq $parentArguments
        if (-not $isOwner -and -not ($isParent -and $sameCommand)) {
            throw "El puerto $Port pertenece a otro proceso o a otra documentacion. Se ha conservado; usa -Port 8001."
        }

        $previousProcesses = @($owner)
        if ($isParent) { $previousProcesses += $parent }
        foreach ($previous in $previousProcesses) {
            $running = Get-Process -Id $previous.ProcessId -ErrorAction SilentlyContinue
            if ($null -eq $running) { continue }
            try {
                # Revalida la identidad antes de detenerlo por si el proceso anterior ya salió.
                $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($previous.ProcessId)" -ErrorAction Stop
                if ($null -eq $current -or $current.CreationDate -ne $previous.CreationDate -or
                    $current.CommandLine -cne $previous.CommandLine) { continue }
                Write-Host "Cerrando la documentacion anterior (proceso $($previous.ProcessId), puerto $Port)..."
                Stop-Process -InputObject $running -ErrorAction Stop
                if (-not $running.WaitForExit(3000)) {
                    throw 'El proceso anterior no ha terminado a tiempo.'
                }
            } finally {
                $running.Dispose()
            }
        }
    }
}
