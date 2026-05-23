import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  return db
}

export async function initDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'veloce.db')

  mkdirSync(userDataPath, { recursive: true })

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      filename TEXT NOT NULL,
      thumbnail_path TEXT,
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0,
      file_size INTEGER DEFAULT 0,
      date_created TEXT,
      date_modified TEXT,
      rating INTEGER DEFAULT 0,
      flag TEXT DEFAULT 'unflagged',
      color_tag TEXT,
      folder_path TEXT NOT NULL,
      ai_analyzed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exif_data (
      photo_id TEXT PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
      make TEXT,
      model TEXT,
      lens TEXT,
      iso INTEGER,
      aperture REAL,
      shutter_speed TEXT,
      focal_length REAL,
      exposure_bias REAL,
      exposure_mode TEXT,
      metering_mode TEXT,
      flash TEXT,
      white_balance TEXT,
      gps_lat REAL,
      gps_lon REAL,
      gps_alt REAL,
      orientation INTEGER
    );

    CREATE TABLE IF NOT EXISTS iptc_data (
      photo_id TEXT PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
      title TEXT DEFAULT '',
      caption TEXT DEFAULT '',
      keywords TEXT DEFAULT '[]',
      creator TEXT DEFAULT '',
      copyright TEXT DEFAULT '',
      credit TEXT DEFAULT '',
      source TEXT DEFAULT '',
      headline TEXT DEFAULT '',
      instructions TEXT DEFAULT '',
      location TEXT DEFAULT '',
      city TEXT DEFAULT '',
      state TEXT DEFAULT '',
      country TEXT DEFAULT '',
      country_code TEXT DEFAULT '',
      category TEXT DEFAULT '',
      urgency INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ai_scores (
      photo_id TEXT PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
      overall INTEGER DEFAULT 0,
      sharpness INTEGER DEFAULT 0,
      exposure INTEGER DEFAULT 0,
      composition INTEGER DEFAULT 0,
      subject INTEGER DEFAULT 0,
      faces INTEGER DEFAULT 0,
      eyes_open INTEGER,
      recommendation TEXT DEFAULT 'maybe',
      reasoning TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      analysis_time INTEGER DEFAULT 0,
      analyzed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      path TEXT PRIMARY KEY,
      last_scanned TEXT,
      photo_count INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_photos_folder ON photos(folder_path);
    CREATE INDEX IF NOT EXISTS idx_photos_rating ON photos(rating);
    CREATE INDEX IF NOT EXISTS idx_photos_flag ON photos(flag);
    CREATE INDEX IF NOT EXISTS idx_photos_color ON photos(color_tag);
    CREATE INDEX IF NOT EXISTS idx_photos_date ON photos(date_created);
  `)

  // Migrations for existing databases
  try {
    db.exec('ALTER TABLE photos ADD COLUMN ai_analyzed INTEGER DEFAULT 0')
  } catch {
    // Column already exists, ignore
  }
}

export function getPhotosByFolder(folderPath: string): any[] {
  return db.prepare('SELECT * FROM photos WHERE folder_path = ? ORDER BY filename').all(folderPath)
}

export function upsertPhoto(photo: any): void {
  db.prepare(`
    INSERT INTO photos (id, path, filename, thumbnail_path, width, height, file_size, date_created, date_modified, rating, flag, color_tag, folder_path)
    VALUES (@id, @path, @filename, @thumbnail_path, @width, @height, @file_size, @date_created, @date_modified, @rating, @flag, @color_tag, @folder_path)
    ON CONFLICT(path) DO UPDATE SET
      thumbnail_path = excluded.thumbnail_path,
      width = excluded.width,
      height = excluded.height,
      file_size = excluded.file_size,
      date_created = excluded.date_created,
      date_modified = excluded.date_modified,
      folder_path = excluded.folder_path
  `).run(photo)
}

export function upsertExif(photoId: string, exif: any): void {
  db.prepare(`
    INSERT INTO exif_data (photo_id, make, model, lens, iso, aperture, shutter_speed, focal_length, exposure_bias, exposure_mode, metering_mode, flash, white_balance, gps_lat, gps_lon, gps_alt, orientation)
    VALUES (@photo_id, @make, @model, @lens, @iso, @aperture, @shutter_speed, @focal_length, @exposure_bias, @exposure_mode, @metering_mode, @flash, @white_balance, @gps_lat, @gps_lon, @gps_alt, @orientation)
    ON CONFLICT(photo_id) DO UPDATE SET
      make = excluded.make, model = excluded.model, lens = excluded.lens,
      iso = excluded.iso, aperture = excluded.aperture, shutter_speed = excluded.shutter_speed,
      focal_length = excluded.focal_length, exposure_bias = excluded.exposure_bias,
      exposure_mode = excluded.exposure_mode, metering_mode = excluded.metering_mode,
      flash = excluded.flash, white_balance = excluded.white_balance,
      gps_lat = excluded.gps_lat, gps_lon = excluded.gps_lon, gps_alt = excluded.gps_alt,
      orientation = excluded.orientation
  `).run({ photo_id: photoId, ...exif })
}

export function upsertIptc(photoId: string, iptc: any): void {
  db.prepare(`
    INSERT INTO iptc_data (photo_id, title, caption, keywords, creator, copyright, credit, source, headline, instructions, location, city, state, country, country_code, category, urgency)
    VALUES (@photo_id, @title, @caption, @keywords, @creator, @copyright, @credit, @source, @headline, @instructions, @location, @city, @state, @country, @country_code, @category, @urgency)
    ON CONFLICT(photo_id) DO UPDATE SET
      title = excluded.title, caption = excluded.caption, keywords = excluded.keywords,
      creator = excluded.creator, copyright = excluded.copyright, credit = excluded.credit,
      source = excluded.source, headline = excluded.headline, instructions = excluded.instructions,
      location = excluded.location, city = excluded.city, state = excluded.state,
      country = excluded.country, country_code = excluded.country_code,
      category = excluded.category, urgency = excluded.urgency
  `).run({ photo_id: photoId, ...iptc })
}

export function upsertAIScore(photoId: string, score: any): void {
  db.prepare(`
    INSERT INTO ai_scores (photo_id, overall, sharpness, exposure, composition, subject, faces, eyes_open, recommendation, reasoning, tags, analysis_time, analyzed_at)
    VALUES (@photo_id, @overall, @sharpness, @exposure, @composition, @subject, @faces, @eyes_open, @recommendation, @reasoning, @tags, @analysis_time, @analyzed_at)
    ON CONFLICT(photo_id) DO UPDATE SET
      overall = excluded.overall, sharpness = excluded.sharpness, exposure = excluded.exposure,
      composition = excluded.composition, subject = excluded.subject, faces = excluded.faces,
      eyes_open = excluded.eyes_open, recommendation = excluded.recommendation,
      reasoning = excluded.reasoning, tags = excluded.tags, analysis_time = excluded.analysis_time,
      analyzed_at = excluded.analyzed_at
  `).run({ photo_id: photoId, ...score })
}

export function updatePhotoRating(photoId: string, rating: number): void {
  db.prepare('UPDATE photos SET rating = ? WHERE id = ?').run(rating, photoId)
}

export function updatePhotoFlag(photoId: string, flag: string): void {
  db.prepare('UPDATE photos SET flag = ? WHERE id = ?').run(flag, photoId)
}

export function updatePhotoColor(photoId: string, color: string | null): void {
  db.prepare('UPDATE photos SET color_tag = ? WHERE id = ?').run(color, photoId)
}

export function updatePhotoThumbnail(photoId: string, thumbnailPath: string, width: number, height: number): void {
  db.prepare('UPDATE photos SET thumbnail_path = ?, width = ?, height = ? WHERE id = ?').run(thumbnailPath, width, height, photoId)
}

export function getSetting(key: string, defaultValue: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any
  return row ? row.value : defaultValue
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

export function getFullPhoto(photoId: string): any {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as any
  if (!photo) return null
  const exif = db.prepare('SELECT * FROM exif_data WHERE photo_id = ?').get(photoId) as any
  const iptc = db.prepare('SELECT * FROM iptc_data WHERE photo_id = ?').get(photoId) as any
  const ai = db.prepare('SELECT * FROM ai_scores WHERE photo_id = ?').get(photoId) as any
  return { ...photo, exif: exif || {}, iptc: iptc || {}, ai: ai || null }
}
