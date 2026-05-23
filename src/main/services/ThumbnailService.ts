import sharp from 'sharp'
import { app } from 'electron'
import { join, basename } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { createHash } from 'crypto'

const THUMBNAIL_DIR = join(app.getPath('userData'), 'thumbnails')

export function ensureThumbnailDir(): void {
  mkdirSync(THUMBNAIL_DIR, { recursive: true })
}

export function getThumbnailPath(photoPath: string, size: number = 320): string {
  const hash = createHash('md5').update(photoPath + size).digest('hex')
  return join(THUMBNAIL_DIR, `${hash}.jpg`)
}

export async function generateThumbnail(
  photoPath: string,
  size: number = 320
): Promise<{ thumbnailPath: string; width: number; height: number }> {
  ensureThumbnailDir()
  const thumbnailPath = getThumbnailPath(photoPath, size)

  if (existsSync(thumbnailPath)) {
    const meta = await sharp(thumbnailPath).metadata()
    return { thumbnailPath, width: meta.width || size, height: meta.height || size }
  }

  const image = sharp(photoPath, { failOnError: false })
  const meta = await image.metadata()

  const orientation = meta.orientation || 1
  let width = meta.width || size
  let height = meta.height || size

  // Fix EXIF orientation
  if (orientation >= 5 && orientation <= 8) {
    [width, height] = [height, width]
  }

  const aspectRatio = width / height
  let targetWidth = size
  let targetHeight = size

  if (aspectRatio > 1) {
    targetHeight = Math.round(size / aspectRatio)
  } else {
    targetWidth = Math.round(size * aspectRatio)
  }

  await image
    .rotate() // Auto-rotate based on EXIF
    .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toFile(thumbnailPath)

  return { thumbnailPath, width: targetWidth, height: targetHeight }
}

export async function getImageDimensions(
  photoPath: string
): Promise<{ width: number; height: number }> {
  try {
    const meta = await sharp(photoPath, { failOnError: false }).metadata()
    let width = meta.width || 0
    let height = meta.height || 0
    const orientation = meta.orientation || 1
    if (orientation >= 5 && orientation <= 8) {
      [width, height] = [height, width]
    }
    return { width, height }
  } catch {
    return { width: 0, height: 0 }
  }
}

export async function analyzeSharpness(photoPath: string): Promise<number> {
  try {
    // Use Laplacian variance as sharpness metric
    const { data, info } = await sharp(photoPath, { failOnError: false })
      .resize(512, 512, { fit: 'inside' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const width = info.width
    const height = info.height
    let laplacianSum = 0
    let count = 0

    // Simple Laplacian kernel for edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x
        const laplacian = Math.abs(
          -data[idx - width - 1] - data[idx - width] - data[idx - width + 1] -
          data[idx - 1] + 8 * data[idx] - data[idx + 1] -
          data[idx + width - 1] - data[idx + width] - data[idx + width + 1]
        )
        laplacianSum += laplacian
        count++
      }
    }

    const variance = laplacianSum / count
    // Normalize to 0-100 scale (empirically calibrated)
    return Math.min(100, Math.round((variance / 15) * 100))
  } catch {
    return 50
  }
}

export async function analyzeExposure(photoPath: string): Promise<number> {
  try {
    const { data } = await sharp(photoPath, { failOnError: false })
      .resize(256, 256, { fit: 'inside' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    let sum = 0
    let underexposed = 0
    let overexposed = 0
    const total = data.length

    for (let i = 0; i < total; i++) {
      sum += data[i]
      if (data[i] < 30) underexposed++
      if (data[i] > 225) overexposed++
    }

    const meanBrightness = sum / total
    const underPct = underexposed / total
    const overPct = overexposed / total

    // Ideal mean brightness is around 100-150
    const brightnessDiff = Math.abs(meanBrightness - 128) / 128
    const clippingPenalty = (underPct + overPct) * 100

    const score = Math.max(0, Math.min(100, 100 - brightnessDiff * 40 - clippingPenalty * 30))
    return Math.round(score)
  } catch {
    return 50
  }
}
