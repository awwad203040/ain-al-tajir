param(
    [Parameter(Mandatory=$true, HelpMessage="Enter your GitHub repository URL (e.g. https://github.com/username/repo.git)")]
    [string]$RepoUrl
)

Write-Host "🔗 Connecting remote repository: $RepoUrl" -ForegroundColor Cyan
git remote remove origin 2>$null
git remote add origin $RepoUrl

Write-Host "🚀 Pushing code to main branch..." -ForegroundColor Cyan
git branch -M main
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host "🤖 GitHub Actions will now automatically build your Android APK." -ForegroundColor Green
    Write-Host "👉 Go to your repository > Actions tab to download the APK once complete." -ForegroundColor Yellow
} else {
    Write-Host "❌ Push failed. Please check your repository URL and credentials." -ForegroundColor Red
}
