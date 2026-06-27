# Apply CORS configuration to Firebase Storage buckets
# Requires: Google Cloud SDK (gsutil) or firebase-tools
# Run from repo root.

param(
    [Parameter(Mandatory=$false)]
    [string]$Bucket = "thec1rcle-india.firebasestorage.app"
)

$corsFile = Join-Path $PSScriptRoot ".." "firebase-storage-cors.json"

if (-not (Test-Path $corsFile)) {
    Write-Error "CORS config not found at $corsFile"
    exit 1
}

Write-Host "Applying CORS config from $corsFile to gs://$Bucket/"

# Try gsutil first
$gsutil = Get-Command gsutil -ErrorAction SilentlyContinue
if ($gsutil) {
    & gsutil cors set $corsFile "gs://$Bucket/"
    Write-Host "Done (gsutil)"
    exit 0
}

# Try npx firebase-tools
$firebaseTools = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseTools) {
    # Check if npx can find it
    $npxResult = & npx --yes firebase-tools --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        & npx firebase-tools storage:cors set $corsFile
        Write-Host "Done (firebase-tools)"
        exit 0
    }
}

Write-Warning "Neither gsutil nor firebase-tools found."
Write-Warning "Install Google Cloud SDK (https://cloud.google.com/sdk) and run:"
Write-Warning "  gsutil cors set $corsFile gs://$Bucket/"
