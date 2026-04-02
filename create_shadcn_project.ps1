# shadcn 프로젝트 생성 스크립트
# My Music 폴더 권한 문제를 피하기 위해 다른 위치에서 생성

Write-Host "shadcn 프로젝트 생성" -ForegroundColor Cyan
Write-Host "=" * 50

# 프로젝트 생성 위치 선택
$projectPath = "C:\dev\my-app"

# 디렉토리 생성
if (-not (Test-Path "C:\dev")) {
    New-Item -ItemType Directory -Path "C:\dev" | Out-Null
    Write-Host "C:\dev 폴더를 생성했습니다." -ForegroundColor Green
}

# 해당 위치로 이동
Set-Location "C:\dev"

Write-Host "`n프로젝트 생성 위치: $projectPath" -ForegroundColor Yellow
Write-Host "shadcn CLI를 실행합니다...`n" -ForegroundColor Yellow

# shadcn CLI 실행
npx shadcn@latest add "https://v0.app/chat/b/b_sGueT8t39NE?token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..0Lmke563XcBG4N_3.pd0DDaHnIck80c6L07aCsl-E8Z2MQwjtWiwGX4No1lvgXL0DIP5VutC4JEA.PhkEkgHgF444L5p8NrAU7A"

Write-Host "`n완료!" -ForegroundColor Green
