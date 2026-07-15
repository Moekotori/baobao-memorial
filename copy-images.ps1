# 将 D:\bao 下的图片复制到 website\images\
$src = "D:\bao"
$dst = "$PSScriptRoot\images"
New-Item -ItemType Directory -Force -Path $dst | Out-Null

$targets = @{
    '瓜面前' = '瓜面前.jpg'
    '瓜开'   = '瓜开.jpg'
}

$found = 0
Get-ChildItem $src -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -match '\.(jpg|jpeg|png|webp)$' -and $_.FullName -notmatch '\\website\\' } |
    ForEach-Object {
        $destName = $_.Name
        foreach ($key in $targets.Keys) {
            if ($_.Name -like "*$key*") { $destName = $targets[$key]; break }
        }
        Copy-Item $_.FullName (Join-Path $dst $destName) -Force
        Write-Host "已复制: $($_.Name) -> images\$destName"
        $found++
    }

if ($found -eq 0) {
    Write-Host "未在 D:\bao 找到图片文件。"
    Write-Host "请将 瓜面前.jpg 和 瓜开.jpg 放入 D:\bao 或 D:\bao\website\images\ 后重新运行。"
}