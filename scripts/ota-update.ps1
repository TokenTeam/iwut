param(
  [Parameter(Mandatory)][string]$token
)

$ErrorActionPreference = 'Stop'
$root = "$PSScriptRoot\.."
$dist = "$root\dist"
$version = (Get-Content "$root\package.json" -Raw | ConvertFrom-Json).version

if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }

bun expo export --platform ios --platform android --output-dir dist
bun expo config --type public --json | Set-Content dist\expoConfig.json

Push-Location $dist
try {
  $cargs = @(
    '-X','POST','https://expo.tokenteam.net/api/updates/019da0ce-9cda-76dc-b440-0c6a45d38292/publish',
    '-H',"Authorization: Bearer $token",
    '-F',"runtimeVersion=$version",
    '-F','metadata.json=@metadata.json',
    '-F','expoConfig.json=@expoConfig.json'
  )
  Get-ChildItem -Recurse -File _expo, assets | ForEach-Object {
    $rel = (Resolve-Path -Relative $_.FullName).TrimStart('.\').Replace('\','/')
    $cargs += '-F'; $cargs += "$rel=@$rel"
  }
  & curl.exe @cargs
} finally {
  Pop-Location
}
