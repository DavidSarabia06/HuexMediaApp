param(
    [ValidateSet('serve', 'build')]
    [string]$Action = 'serve',
    [ValidateRange(1024, 65535)]
    [int]$Port = 8000,
    [string]$PythonExecutable = 'python'
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$env:PYTHONUTF8 = '1'
# Aviso sobre una versión futura: este proyecto fija MkDocs 1.6.1.
$env:NO_MKDOCS_2_WARNING = 'true'
$projectRoot = Split-Path -Parent $PSScriptRoot
$docsPython = Join-Path $projectRoot '.venv-docs/Scripts/python.exe'
$requirements = Join-Path $projectRoot 'requirements-docs.txt'
$config = Join-Path $projectRoot 'mkdocs.yml'

if (-not (Test-Path -LiteralPath $docsPython)) {
    & $PythonExecutable -m venv (Join-Path $projectRoot '.venv-docs')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el entorno de documentación. Usa Python 3.10 o posterior.' }
    & $docsPython -m pip install -r $requirements
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias de documentación.' }
}

& $docsPython -c 'import mkdocs, material' 2>$null
if ($LASTEXITCODE -ne 0) {
    & $docsPython -m pip install -r $requirements
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias de documentación.' }
}

if ($Action -eq 'build') {
    & $docsPython -m mkdocs build --strict --config-file $config
} else {
    Write-Host "Documentación disponible en http://127.0.0.1:$Port (Ctrl+C para detener)."
    & $docsPython -m mkdocs serve --open --config-file $config --dev-addr "127.0.0.1:$Port"
}
exit $LASTEXITCODE
