# 将图片复制到 website/images/
# 用法：把 瓜面前.jpg、瓜开.jpg 放到 D:\bao\ 后运行此脚本

$src = "D:\bao"
$dst = "$PSScriptRoot\images"

@("瓜面前.jpg", "瓜开.jpg") | ForEach-Object {
    $from = Join-Path $src $_
    if (Test-Path $from) {
        Copy-Item $from $dst -Force
        Write-Host "已复制: $_"
    } else {
        Write-Host "未找到: $from"
    }
}