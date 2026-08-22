# PowerShell script to create commits until repository has ~50 commits

# Usage: In repo root, run: .\make_commits.ps1

function ExitWith($msg) {
    Write-Host $msg -ForegroundColor Yellow
    exit 1
}

# Check for git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    ExitWith "git not found in PATH. Install Git and run this script from the repository root."
}

# Get current commit count
try {
    $count = git rev-list --count HEAD 2>$null
} catch {
    ExitWith "Failed to get commit count. Are you in a git repository?"
}

if (-not [int]::TryParse($count, [ref]$currentCount)) {
    ExitWith "Unable to parse commit count: $count"
}

$target = 50
$needed = $target - $currentCount

if ($needed -le 0) {
    Write-Host "Repository already has $currentCount commits (>= $target). Nothing to do." -ForegroundColor Green
    exit 0
}

Write-Host "Current commits: $currentCount. Will create $needed additional commits to reach $target." -ForegroundColor Cyan

# Ensure the stamp file exists
$stampFile = "COMMIT_STAMPS.md"
if (-not (Test-Path $stampFile)) {
    "# Commit stamps" | Out-File -FilePath $stampFile -Encoding UTF8
}

for ($i = 1; $i -le $needed; $i++) {
    $now = Get-Date -Format o
    $line = "- Stamp $($currentCount + $i): $now"
    Add-Content -Path $stampFile -Value $line

    git add $stampFile
    $msg = "chore(stamps): add commit stamp $($currentCount + $i)"
    git commit -m $msg

    if ($LASTEXITCODE -ne 0) {
        Write-Host "git commit failed at iteration $i." -ForegroundColor Red
        exit 1
    }
}

# Final count
$final = git rev-list --count HEAD
Write-Host "Finished. New commit count: $final" -ForegroundColor Green
