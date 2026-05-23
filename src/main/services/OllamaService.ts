import { AIScore } from '../../shared/types'
import { readFileSync } from 'fs'
import { analyzeSharpness, analyzeExposure } from './ThumbnailService'
import sharp from 'sharp'

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

export interface OllamaConfig {
  url: string
  model: string
}

async function ollamaFetch(url: string, path: string, body: any): Promise<any> {
  const response = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  })
  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export async function checkOllamaStatus(url: string = DEFAULT_OLLAMA_URL): Promise<{
  connected: boolean
  version: string | null
  models: any[]
}> {
  try {
    const response = await fetch(`${url}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) return { connected: false, version: null, models: [] }
    const data = await response.json() as any

    const versionRes = await fetch(`${url}/api/version`, {
      signal: AbortSignal.timeout(3000)
    })
    let version = null
    if (versionRes.ok) {
      const vData = await versionRes.json() as any
      version = vData.version
    }

    return {
      connected: true,
      version,
      models: data.models || []
    }
  } catch {
    return { connected: false, version: null, models: [] }
  }
}

async function resizeForAI(photoPath: string): Promise<string> {
  // Resize to 1024px max for faster AI analysis
  const resized = await sharp(photoPath, { failOnError: false })
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer()
  return resized.toString('base64')
}

export async function analyzePhoto(
  photoPath: string,
  config: OllamaConfig
): Promise<AIScore> {
  const startTime = Date.now()

  // Run local analysis first (fast, reliable)
  const [sharpness, exposure] = await Promise.all([
    analyzeSharpness(photoPath),
    analyzeExposure(photoPath)
  ])

  // If no vision model configured, return local analysis only
  if (!config.model) {
    const overall = Math.round((sharpness + exposure) / 2)
    return {
      overall,
      sharpness,
      exposure,
      composition: 50,
      subject: 50,
      faces: 0,
      eyesOpen: null,
      recommendation: overall >= 70 ? 'pick' : overall >= 40 ? 'maybe' : 'reject',
      reasoning: `Local analysis: sharpness ${sharpness}/100, exposure ${exposure}/100`,
      tags: [],
      analysisTime: Date.now() - startTime
    }
  }

  try {
    const base64Image = await resizeForAI(photoPath)

    const prompt = `Analyze this photograph and provide a structured assessment. Be concise and accurate.

Evaluate these aspects:
1. SHARPNESS: Is the main subject in sharp focus? (0-100)
2. EXPOSURE: Is the exposure correct, or over/underexposed? (0-100)
3. COMPOSITION: Does it follow good composition principles? (0-100)
4. SUBJECT: Is the main subject well-captured and interesting? (0-100)
5. FACES: How many faces are visible? Are eyes open?
6. RECOMMENDATION: Should this be picked (keep), maybe (uncertain), or rejected (discard)?
7. REASONING: Brief reason for recommendation (1-2 sentences)
8. TAGS: 3-5 descriptive tags (e.g., portrait, landscape, blurry, overexposed, sharp)

Respond ONLY with valid JSON in this exact format:
{
  "sharpness": 85,
  "exposure": 90,
  "composition": 75,
  "subject": 80,
  "faces": 1,
  "eyesOpen": true,
  "recommendation": "pick",
  "reasoning": "Sharp portrait with good exposure and pleasant background blur.",
  "tags": ["portrait", "sharp", "well-exposed"]
}`

    const response = await ollamaFetch(config.url, '/api/chat', {
      model: config.model,
      messages: [{
        role: 'user',
        content: prompt,
        images: [base64Image]
      }],
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 300
      }
    })

    const content = response.message?.content || ''

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const aiData = JSON.parse(jsonMatch[0])

    // Blend local analysis with AI analysis for accuracy
    const blendedSharpness = Math.round(sharpness * 0.4 + (aiData.sharpness || 50) * 0.6)
    const blendedExposure = Math.round(exposure * 0.4 + (aiData.exposure || 50) * 0.6)
    const composition = Math.max(0, Math.min(100, aiData.composition || 50))
    const subject = Math.max(0, Math.min(100, aiData.subject || 50))

    const overall = Math.round(
      blendedSharpness * 0.3 +
      blendedExposure * 0.25 +
      composition * 0.25 +
      subject * 0.2
    )

    return {
      overall,
      sharpness: blendedSharpness,
      exposure: blendedExposure,
      composition,
      subject,
      faces: Math.max(0, parseInt(aiData.faces) || 0),
      eyesOpen: aiData.eyesOpen !== undefined ? Boolean(aiData.eyesOpen) : null,
      recommendation: ['pick', 'maybe', 'reject'].includes(aiData.recommendation)
        ? aiData.recommendation
        : (overall >= 70 ? 'pick' : overall >= 40 ? 'maybe' : 'reject'),
      reasoning: aiData.reasoning || '',
      tags: Array.isArray(aiData.tags) ? aiData.tags.slice(0, 8) : [],
      analysisTime: Date.now() - startTime
    }
  } catch (err) {
    // Fall back to local analysis if AI fails
    const overall = Math.round((sharpness + exposure) / 2)
    return {
      overall,
      sharpness,
      exposure,
      composition: 50,
      subject: 50,
      faces: 0,
      eyesOpen: null,
      recommendation: overall >= 70 ? 'pick' : overall >= 40 ? 'maybe' : 'reject',
      reasoning: `Local analysis only (AI unavailable): sharpness ${sharpness}/100, exposure ${exposure}/100`,
      tags: [],
      analysisTime: Date.now() - startTime
    }
  }
}
