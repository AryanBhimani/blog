
Add-Type -AssemblyName System.Drawing

$sourcePath = "e:\Website\Blog.in\assets\images\blog.in.png"
$destPath = "e:\Website\Blog.in\assets\images\blog-social.png"

try {
    $image = [System.Drawing.Image]::FromFile($sourcePath)
    Write-Host "Original Size: $($image.Width) x $($image.Height)"

    # Target width 600px (good for WhatsApp preview)
    $maxW = 600
    $newW = $image.Width
    $newH = $image.Height

    if ($image.Width -gt $maxW) {
        $scale = $maxW / $image.Width
        $newW = [int]($image.Width * $scale)
        $newH = [int]($image.Height * $scale)
    }

    $bitMap = New-Object System.Drawing.Bitmap($newW, $newH)
    $graph = [System.Drawing.Graphics]::FromImage($bitMap)
    $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    
    $graph.DrawImage($image, 0, 0, $newW, $newH)
    
    $bitMap.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Saved resized image to $destPath"
    
    $image.Dispose()
    $bitMap.Dispose()
    $graph.Dispose()
} catch {
    Write-Error "Failed to process image: $_"
}
