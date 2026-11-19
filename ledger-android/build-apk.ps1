param(
  [string]$VersionName = "1.0",
  [int]$VersionCode = 1
)

$ErrorActionPreference = "Stop"

$proj = $PSScriptRoot
$ledger = Join-Path (Split-Path $proj -Parent) "ledger"
$sdk = Join-Path $env:USERPROFILE "android-sdk"

if (-not (Test-Path $sdk)) {
  throw "Android SDK not found: $sdk"
}

$buildTools = Get-ChildItem (Join-Path $sdk "build-tools") -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1
if (-not $buildTools) { throw "No build-tools found under $sdk" }
$bt = $buildTools.FullName

$platform = Get-ChildItem (Join-Path $sdk "platforms") -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1
if (-not $platform) { throw "No Android platform found under $sdk" }
$aj = Join-Path $platform.FullName "android.jar"

foreach ($required in @("index.html", "style.css", "app.js", "icon.svg")) {
  $path = Join-Path $ledger $required
  if (-not (Test-Path $path)) { throw "Missing web asset: $path" }
}

$work = Join-Path $env:TEMP "jianzhang-apk"
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Force -Path $work | Out-Null

Copy-Item (Join-Path $proj "java") (Join-Path $work "java") -Recurse
Copy-Item (Join-Path $proj "res") (Join-Path $work "res") -Recurse
Copy-Item (Join-Path $proj "AndroidManifest.xml") (Join-Path $work "AndroidManifest.xml")

$assets = Join-Path $work "assets\ledger"
New-Item -ItemType Directory -Force -Path $assets | Out-Null
foreach ($asset in @("index.html", "style.css", "app.js", "icon.svg")) {
  Copy-Item (Join-Path $ledger $asset) (Join-Path $assets $asset)
}

$manifestPath = Join-Path $work "AndroidManifest.xml"
$manifest = Get-Content $manifestPath -Raw -Encoding UTF8
$manifest = $manifest -replace 'android:versionCode="\d+"', "android:versionCode=`"$VersionCode`""
$manifest = $manifest -replace 'android:versionName="[^"]*"', "android:versionName=`"$VersionName`""
Set-Content $manifestPath -Value $manifest -Encoding UTF8 -NoNewline

$out = Join-Path $work "build"
New-Item -ItemType Directory -Force -Path (Join-Path $out "gen"), (Join-Path $out "classes"), (Join-Path $out "dex") | Out-Null

Write-Host "1/6 aapt2 compile..."
& (Join-Path $bt "aapt2.exe") compile --dir (Join-Path $work "res") -o (Join-Path $out "res.zip")
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

Write-Host "2/6 aapt2 link..."
& (Join-Path $bt "aapt2.exe") link `
  -o (Join-Path $out "base.apk") `
  -I $aj `
  --manifest $manifestPath `
  --java (Join-Path $out "gen") `
  --auto-add-overlay `
  --min-sdk-version 29 `
  --target-sdk-version 34 `
  -A (Join-Path $work "assets") `
  (Join-Path $out "res.zip")
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Write-Host "3/6 javac..."
$srcs = @(Get-ChildItem (Join-Path $work "java") -Recurse -Filter *.java | ForEach-Object { $_.FullName })
$rjava = Join-Path $out "gen\com\wuzhongdui\ledger\R.java"
if (-not (Test-Path $rjava)) { throw "R.java not generated: $rjava" }
$srcs += $rjava
& javac --release 11 -encoding UTF-8 -cp $aj -d (Join-Path $out "classes") @srcs
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

Write-Host "4/6 d8..."
$classes = @(Get-ChildItem (Join-Path $out "classes") -Recurse -Filter *.class | ForEach-Object { $_.FullName })
& (Join-Path $bt "d8.bat") --lib $aj --min-api 29 --output (Join-Path $out "dex") $classes
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

Copy-Item (Join-Path $out "base.apk") (Join-Path $out "unsigned.apk") -Force
$dexPath = (Join-Path $out "dex\classes.dex").Replace("\", "/")
$apkPath = (Join-Path $out "unsigned.apk").Replace("\", "/")
@"
import zipfile
with zipfile.ZipFile(r'$apkPath', 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(r'$dexPath', 'classes.dex')
"@ | python -
if ($LASTEXITCODE -ne 0) { throw "adding classes.dex failed" }

& (Join-Path $bt "zipalign.exe") -f 4 (Join-Path $out "unsigned.apk") (Join-Path $out "aligned.apk")
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

$keystore = Join-Path $proj "keystore\debug.keystore"
if (-not (Test-Path $keystore)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $keystore -Parent) | Out-Null
  Write-Host "creating debug keystore..."
  & keytool -genkeypair `
    -keystore $keystore `
    -storepass android `
    -keypass android `
    -alias androiddebugkey `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname "CN=Jianzhang Debug, O=Jianzhang, C=CN"
  if ($LASTEXITCODE -ne 0) { throw "keytool failed" }
}

$dist = Join-Path $proj "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$final = Join-Path $dist "jianzhang-$VersionName.apk"

Write-Host "5/6 sign..."
& (Join-Path $bt "apksigner.bat") sign `
  --ks $keystore `
  --ks-pass pass:android `
  --key-pass pass:android `
  --min-sdk-version 23 `
  --v1-signing-enabled true `
  --v2-signing-enabled true `
  --v3-signing-enabled true `
  --out $final `
  (Join-Path $out "aligned.apk")
if ($LASTEXITCODE -ne 0) { throw "sign failed" }

Write-Host "6/6 verify..."
& (Join-Path $bt "apksigner.bat") verify --print-certs $final
if ($LASTEXITCODE -ne 0) { throw "verify failed" }

Write-Host ""
Write-Host "done: $final"
Write-Host ("size: {0:N0} KB" -f ((Get-Item $final).Length / 1KB))
