$ErrorActionPreference = "Continue"

Write-Host "ZeroSeal environment check" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan

$commands = @(
    @{ Name = "git"; Args = "--version" },
    @{ Name = "rustc"; Args = "--version" },
    @{ Name = "cargo"; Args = "--version" },
    @{ Name = "rustup"; Args = "--version" },
    @{ Name = "stellar"; Args = "--version" },
    @{ Name = "nargo"; Args = "--version" },
    @{ Name = "bb"; Args = "--version" },
    @{ Name = "docker"; Args = "--version" },
    @{ Name = "node"; Args = "--version" },
    @{ Name = "npm"; Args = "--version" },
    @{ Name = "just"; Args = "--version" }
)

foreach ($item in $commands) {
    Write-Host ""
    Write-Host ("[{0}]" -f $item.Name) -ForegroundColor Yellow
    try {
        & $item.Name $item.Args
    } catch {
        Write-Host "NOT FOUND" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[Rust targets]" -ForegroundColor Yellow
try {
    rustup target list --installed
} catch {
    Write-Host "rustup NOT FOUND" -ForegroundColor Red
}

Write-Host ""
Write-Host "Do not install anything yet. Save this output for architecture review." -ForegroundColor Cyan
