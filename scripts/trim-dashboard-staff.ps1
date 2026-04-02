$p = Join-Path $PSScriptRoot '..\app\dashboard\page.tsx' | Resolve-Path
$a = Get-Content -LiteralPath $p -Encoding UTF8
$before = $a[0..369]
$after = $a[508..($a.Length - 1)]
($before + $after) | Set-Content -LiteralPath $p -Encoding UTF8
Write-Host "Done. Removed lines 371-508."
