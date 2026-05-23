export interface Photo {
  id: string
  path: string
  filename: string
  thumbnailPath: string | null
  width: number
  height: number
  fileSize: number
  dateCreated: string
  dateModified: string
  rating: number // 0-5
  flag: 'picked' | 'rejected' | 'unflagged'
  colorTag: 'red' | 'green' | 'blue' | 'yellow' | 'purple' | null
  exif: ExifData
  iptc: IptcData
  aiScore: AIScore | null
  aiAnalyzed: boolean
}

export interface ExifData {
  make: string | null
  model: string | null
  lens: string | null
  iso: number | null
  aperture: number | null
  shutterSpeed: string | null
  focalLength: number | null
  exposureBias: number | null
  exposureMode: string | null
  meteringMode: string | null
  flash: string | null
  whiteBalance: string | null
  gpsLat: number | null
  gpsLon: number | null
  gpsAlt: number | null
  orientation: number | null
}

export interface IptcData {
  title: string
  caption: string
  keywords: string[]
  creator: string
  copyright: string
  credit: string
  source: string
  headline: string
  instructions: string
  location: string
  city: string
  state: string
  country: string
  countryCode: string
  category: string
  urgency: number
}

export interface AIScore {
  overall: number // 0-100
  sharpness: number // 0-100
  exposure: number // 0-100
  composition: number // 0-100
  subject: number // 0-100
  faces: number // count
  eyesOpen: boolean | null
  recommendation: 'pick' | 'maybe' | 'reject'
  reasoning: string
  tags: string[]
  analysisTime: number
}

export interface FolderInfo {
  path: string
  name: string
  photoCount: number
  children?: FolderInfo[]
}

export interface ThumbnailResult {
  photoId: string
  thumbnailPath: string
  width: number
  height: number
}

export interface OllamaModel {
  name: string
  size: number
  digest: string
  modified_at: string
}

export interface OllamaStatus {
  connected: boolean
  version: string | null
  models: OllamaModel[]
  selectedModel: string | null
}

export interface AppSettings {
  thumbnailSize: number
  ollamaUrl: string
  ollamaModel: string
  autoAnalyze: boolean
  thumbnailCachePath: string
  showAIPanel: boolean
  showMetadataPanel: boolean
  sortBy: 'filename' | 'date' | 'rating' | 'ai-score'
  sortOrder: 'asc' | 'desc'
}

export interface FilterState {
  ratingMin: number | null
  flag: 'picked' | 'rejected' | 'unflagged' | null
  colorTag: string | null
  aiRecommendation: 'pick' | 'maybe' | 'reject' | null
  showOnlyAIAnalyzed: boolean
}

export type IpcChannel =
  | 'dialog:openFolder'
  | 'folder:scan'
  | 'folder:getFolderTree'
  | 'photo:updateRating'
  | 'photo:updateFlag'
  | 'photo:updateColor'
  | 'photo:updateIptc'
  | 'photo:getMetadata'
  | 'thumbnail:generate'
  | 'thumbnail:generateBatch'
  | 'ai:analyzePhoto'
  | 'ai:analyzeBatch'
  | 'ai:getStatus'
  | 'ai:getModels'
  | 'settings:get'
  | 'settings:set'
  | 'app:openInFinder'
  | 'app:copyToClipboard'
