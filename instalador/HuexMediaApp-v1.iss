#define MyAppName "Huex Media App v1"
#define MyAppVersion "1.0"
#define MyAppExeName "HuexMediaApp.Server.exe"
#define PublishFolder "..\Publicaciones\HuexMediaApp-v1-win-x64"

[Setup]
; Identidad de la v1 original. La v2 se registra con otro AppId.
AppId={{ACCF8F33-CAEC-4920-AB07-C72328194955}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=David Sarabia Torres
DefaultDirName={autopf}\Huex Media App\v1
UsePreviousAppDir=no
UninstallDisplayIcon={app}\HuexMediaAppIcon.ico
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
OutputDir=salida
OutputBaseFilename=HuexMediaApp-Setup-v1
SetupIconFile={#PublishFolder}\HuexMediaAppIcon.ico
SolidCompression=yes
WizardStyle=modern windows11

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#PublishFolder}\*"; DestDir: "{app}"; Excludes: "App_Data\*,*.pdb,appsettings.Development.json"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\HuexMediaAppIcon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\HuexMediaAppIcon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent runasoriginaluser
