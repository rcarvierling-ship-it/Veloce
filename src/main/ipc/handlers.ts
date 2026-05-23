import { IpcMain, dialog, shell, app } from 'electron'
import { readdirSync, statSync, existsSync } from 'fs'
import { join, extname, basename } from 'path'
import { createHash } from 'crypto'
import {
  getDb, upsertPhoto, upsertExif, upsertIptc, upsertAIScore,
  updatePhotoRating, updatePhotoFlag, updatePhotoColor, updatePhotoThumbnail,
  getSetting, setSetting, getFullPhoto, getPhotosByFolder
} from '../db'
import { generateThumbnail, getImageDimensions } from '../services/ThumbnailService'
import { readMetadata } from '../services/MetadataService'
import { analyzePhoto, checkOllamaStatus } from '../services/OllamaService'

const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', '.heic', '.heif', '.cr2', '.cr3', '.nef', '.arw', '.orf', '.rw2', '.dng', '.raf', '.pef', '.srw'])

function isPhotoFile(filePath: string): boolean {
  return PHOTO_EXTENSIONS.has(extname(filePath).toLowerCase())
}

function makePhotoId(filePath: string): string {
  return createHash('md5').update(filePath).digest('hex')
}

export function registerAllHandlers(ipcMain: IpcMain): void {
  // Open folder dialog
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  // Scan folder for photos
  ipcMain.handle('folder:scan', async (_, folderPath: string) => {
    const files: string[] = []

    const scan = (dir: string): void => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            // Don't recurse by default - only top level
          } else if (isPhotoFile(entry.name)) {
            files.push(fullPath)
          }
        }
      } catch {}
    }

    scan(folderPath)

    const photos = []
    for (const filePath of files) {
      const id = makePhotoId(filePath)
      let stat: any = null
      try { stat = statSync(filePath) } catch { continue }

      const photo = {
        id,
        path: filePath,
        filename: basename(filePath),
        thumbnail_path: null,
        width: 0,
        height: 0,
        file_size: stat.size,
        date_created: stat.birthtime?.toISOString() || stat.mtime.toISOString(),
        date_modified: stat.mtime.toISOString(),
        rating: 0,
        flag: 'unflagged',
        color_tag: null,
        folder_path: folderPath
      }

      upsertPhoto(photo)

      // Get existing data from DB (preserves user ratings etc.)
      const existing = getFullPhoto(id)
      photos.push(existing || photo)
    }

    return photos.sort((a, b) => a.filename.localeCompare(b.filename))
  })

  // Get folder tree for sidebar
  ipcMain.handle('folder:getFolderTree', async (_, rootPath: string) => {
    const buildTree = (dir: string, depth = 0): any => {
      if (depth > 3) return null
      try {
        const stat = statSync(dir)
        if (!stat.isDirectory()) return null

        const name = basename(dir)
        if (name.startsWith('.')) return null

        let photoCount = 0
        const children: any[] = []

        try {
          const entries = readdirSync(dir, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.name.startsWith('.')) continue
            const fullPath = join(dir, entry.name)
            if (entry.isDirectory() && depth < 2) {
              const child = buildTree(fullPath, depth + 1)
              if (child) children.push(child)
            } else if (isPhotoFile(entry.name)) {
              photoCount++
            }
          }
        } catch {}

        return { path: dir, name, photoCount, children }
      } catch {
        return null
      }
    }

    return buildTree(rootPath)
  })

  // Generate thumbnail for a single photo
  ipcMain.handle('thumbnail:generate', async (_, photoPath: string, size: number = 320) => {
    try {
      const result = await generateThumbnail(photoPath, size)
      const id = makePhotoId(photoPath)
      updatePhotoThumbnail(id, result.thumbnailPath, result.width, result.height)
      return result
    } catch (err) {
      return null
    }
  })

  // Generate thumbnails for a batch
  ipcMain.handle('thumbnail:generateBatch', async (event, photoPaths: string[], size: number = 320) => {
    const results: any[] = []
    for (const photoPath of photoPaths) {
      try {
        const result = await generateThumbnail(photoPath, size)
        const id = makePhotoId(photoPath)
        updatePhotoThumbnail(id, result.thumbnailPath, result.width, result.height)
        results.push({ photoPath, ...result })
        // Send progress
        event.sender.send('thumbnail:progress', { photoPath, ...result })
      } catch {
        results.push({ photoPath, thumbnailPath: null })
      }
    }
    return results
  })

  // Get photo metadata (EXIF + IPTC)
  ipcMain.handle('photo:getMetadata', async (_, photoPath: string) => {
    const id = makePhotoId(photoPath)
    try {
      const { exif, iptc } = await readMetadata(photoPath)
      upsertExif(id, {
        make: exif.make,
        model: exif.model,
        lens: exif.lens,
        iso: exif.iso,
        aperture: exif.aperture,
        shutter_speed: exif.shutterSpeed,
        focal_length: exif.focalLength,
        exposure_bias: exif.exposureBias,
        exposure_mode: exif.exposureMode,
        metering_mode: exif.meteringMode,
        flash: exif.flash,
        white_balance: exif.whiteBalance,
        gps_lat: exif.gpsLat,
        gps_lon: exif.gpsLon,
        gps_alt: exif.gpsAlt,
        orientation: exif.orientation
      })
      upsertIptc(id, {
        title: iptc.title,
        caption: iptc.caption,
        keywords: JSON.stringify(iptc.keywords),
        creator: iptc.creator,
        copyright: iptc.copyright,
        credit: iptc.credit,
        source: iptc.source,
        headline: iptc.headline,
        instructions: iptc.instructions,
        location: iptc.location,
        city: iptc.city,
        state: iptc.state,
        country: iptc.country,
        country_code: iptc.countryCode,
        category: iptc.category,
        urgency: iptc.urgency
      })
      return { exif, iptc }
    } catch {
      return { exif: {}, iptc: {} }
    }
  })

  // Update photo rating
  ipcMain.handle('photo:updateRating', async (_, photoId: string, rating: number) => {
    updatePhotoRating(photoId, rating)
    return true
  })

  // Update photo flag
  ipcMain.handle('photo:updateFlag', async (_, photoId: string, flag: string) => {
    updatePhotoFlag(photoId, flag)
    return true
  })

  // Update photo color tag
  ipcMain.handle('photo:updateColor', async (_, photoId: string, color: string | null) => {
    updatePhotoColor(photoId, color)
    return true
  })

  // Update IPTC data
  ipcMain.handle('photo:updateIptc', async (_, photoId: string, iptc: any) => {
    upsertIptc(photoId, {
      title: iptc.title || '',
      caption: iptc.caption || '',
      keywords: JSON.stringify(Array.isArray(iptc.keywords) ? iptc.keywords : []),
      creator: iptc.creator || '',
      copyright: iptc.copyright || '',
      credit: iptc.credit || '',
      source: iptc.source || '',
      headline: iptc.headline || '',
      instructions: iptc.instructions || '',
      location: iptc.location || '',
      city: iptc.city || '',
      state: iptc.state || '',
      country: iptc.country || '',
      country_code: iptc.countryCode || '',
      category: iptc.category || '',
      urgency: iptc.urgency || 0
    })
    return true
  })

  // AI: Check Ollama status
  ipcMain.handle('ai:getStatus', async () => {
    const url = getSetting('ollamaUrl', 'http://localhost:11434')
    return checkOllamaStatus(url)
  })

  // AI: Analyze single photo
  ipcMain.handle('ai:analyzePhoto', async (_, photoPath: string) => {
    const url = getSetting('ollamaUrl', 'http://localhost:11434')
    const model = getSetting('ollamaModel', '')
    const id = makePhotoId(photoPath)

    try {
      const score = await analyzePhoto(photoPath, { url, model })
      upsertAIScore(id, {
        overall: score.overall,
        sharpness: score.sharpness,
        exposure: score.exposure,
        composition: score.composition,
        subject: score.subject,
        faces: score.faces,
        eyes_open: score.eyesOpen === null ? null : (score.eyesOpen ? 1 : 0),
        recommendation: score.recommendation,
        reasoning: score.reasoning,
        tags: JSON.stringify(score.tags),
        analysis_time: score.analysisTime,
        analyzed_at: new Date().toISOString()
      })
      // Mark photo as analyzed
      getDb().prepare('UPDATE photos SET ai_analyzed = 1 WHERE id = ?').run(id)
      return score
    } catch (err: any) {
      throw new Error(`AI analysis failed: ${err.message}`)
    }
  })

  // AI: Analyze batch of photos
  ipcMain.handle('ai:analyzeBatch', async (event, photoPaths: string[]) => {
    const url = getSetting('ollamaUrl', 'http://localhost:11434')
    const model = getSetting('ollamaModel', '')
    const results: any[] = []

    for (let i = 0; i < photoPaths.length; i++) {
      const photoPath = photoPaths[i]
      const id = makePhotoId(photoPath)

      try {
        const score = await analyzePhoto(photoPath, { url, model })
        upsertAIScore(id, {
          overall: score.overall,
          sharpness: score.sharpness,
          exposure: score.exposure,
          composition: score.composition,
          subject: score.subject,
          faces: score.faces,
          eyes_open: score.eyesOpen === null ? null : (score.eyesOpen ? 1 : 0),
          recommendation: score.recommendation,
          reasoning: score.reasoning,
          tags: JSON.stringify(score.tags),
          analysis_time: score.analysisTime,
          analyzed_at: new Date().toISOString()
        })

        event.sender.send('ai:progress', {
          photoPath,
          score,
          progress: i + 1,
          total: photoPaths.length
        })

        results.push({ photoPath, score })
      } catch (err: any) {
        results.push({ photoPath, error: err.message })
        event.sender.send('ai:progress', {
          photoPath,
          error: err.message,
          progress: i + 1,
          total: photoPaths.length
        })
      }
    }

    return results
  })

  // Settings
  ipcMain.handle('settings:get', async (_, key: string, defaultValue: string = '') => {
    return getSetting(key, defaultValue)
  })

  ipcMain.handle('settings:set', async (_, key: string, value: string) => {
    setSetting(key, value)
    return true
  })

  // Open in finder/explorer
  ipcMain.handle('app:openInFinder', async (_, filePath: string) => {
    shell.showItemInFolder(filePath)
    return true
  })
}
