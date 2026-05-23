import { readFileSync, writeFileSync } from 'fs'
import { ExifData, IptcData } from '../../shared/types'

// We use dynamic import for exifr since it's ESM
let exifr: any = null

async function getExifr() {
  if (!exifr) {
    exifr = await import('exifr')
  }
  return exifr
}

export async function readMetadata(
  filePath: string
): Promise<{ exif: ExifData; iptc: IptcData }> {
  const lib = await getExifr()

  let rawExif: any = {}
  let rawIptc: any = {}

  try {
    rawExif = await lib.parse(filePath, {
      tiff: true,
      exif: true,
      gps: true,
      iptc: true,
      xmp: false,
      icc: false
    }) || {}
  } catch {
    // Some files may not have EXIF
  }

  try {
    rawIptc = await lib.iptc(filePath) || {}
  } catch {
    // Some files may not have IPTC
  }

  const exif: ExifData = {
    make: rawExif.Make || null,
    model: rawExif.Model || null,
    lens: rawExif.LensModel || rawExif.Lens || null,
    iso: rawExif.ISO || null,
    aperture: rawExif.FNumber || rawExif.ApertureValue || null,
    shutterSpeed: formatShutterSpeed(rawExif.ExposureTime),
    focalLength: rawExif.FocalLength || null,
    exposureBias: rawExif.ExposureBiasValue || null,
    exposureMode: rawExif.ExposureMode !== undefined ? String(rawExif.ExposureMode) : null,
    meteringMode: rawExif.MeteringMode !== undefined ? String(rawExif.MeteringMode) : null,
    flash: rawExif.Flash !== undefined ? String(rawExif.Flash) : null,
    whiteBalance: rawExif.WhiteBalance !== undefined ? String(rawExif.WhiteBalance) : null,
    gpsLat: rawExif.latitude || null,
    gpsLon: rawExif.longitude || null,
    gpsAlt: rawExif.GPSAltitude || null,
    orientation: rawExif.Orientation || null
  }

  const iptc: IptcData = {
    title: rawIptc.ObjectName || rawIptc.Headline || '',
    caption: rawIptc.Caption || rawIptc['Caption-Abstract'] || '',
    keywords: Array.isArray(rawIptc.Keywords) ? rawIptc.Keywords :
              rawIptc.Keywords ? [rawIptc.Keywords] : [],
    creator: rawIptc.Creator || rawIptc.Byline || '',
    copyright: rawIptc.CopyrightNotice || rawIptc.Copyright || '',
    credit: rawIptc.Credit || '',
    source: rawIptc.Source || '',
    headline: rawIptc.Headline || '',
    instructions: rawIptc.SpecialInstructions || '',
    location: rawIptc['Sub-location'] || rawIptc.Location || '',
    city: rawIptc.City || '',
    state: rawIptc['Province-State'] || rawIptc.State || '',
    country: rawIptc['Country-PrimaryLocationName'] || rawIptc.Country || '',
    countryCode: rawIptc['Country-PrimaryLocationCode'] || '',
    category: rawIptc.Category || '',
    urgency: parseInt(rawIptc.Urgency) || 0
  }

  return { exif, iptc }
}

function formatShutterSpeed(exposureTime: number | undefined): string | null {
  if (!exposureTime) return null
  if (exposureTime >= 1) return `${exposureTime}s`
  const denominator = Math.round(1 / exposureTime)
  return `1/${denominator}`
}

export function formatAperture(aperture: number | null): string {
  if (!aperture) return '—'
  return `f/${aperture.toFixed(1)}`
}

export function formatFocalLength(focalLength: number | null): string {
  if (!focalLength) return '—'
  return `${Math.round(focalLength)}mm`
}

export function formatISO(iso: number | null): string {
  if (!iso) return '—'
  return `ISO ${iso}`
}
