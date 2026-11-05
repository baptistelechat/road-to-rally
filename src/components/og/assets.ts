import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_ALT = 'Road to Rally'

// Palette « Nuit facettée » (docs/design/DESIGN.md)
export const ogColors = {
  foreground: '#e9edf3',
}

export interface OgAssets {
  icon: string
  wordmark: string
  scene: string
  fonts: { name: string; data: ArrayBuffer; weight: 400 | 600; style: 'normal' }[]
}

// Chemins littéraux : le traçage de build n'embarque que ces fichiers, pas tout le projet.
const svgUri = async (file: Promise<Buffer>): Promise<string> => `data:image/svg+xml;base64,${(await file).toString('base64')}`

// Satori ne lit pas le woff2 : sans User-Agent, Google Fonts renvoie du truetype.
const fetchOk = async (url: string): Promise<Response> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Chargement impossible pour l'image OG (${res.status}) : ${url}`)
  return res
}

const loadGoogleFont = async (family: string, weight: number): Promise<ArrayBuffer> => {
  const css = await (await fetchOk(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`)).text()
  const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1]
  if (!url) throw new Error(`Police introuvable pour l'image OG : ${family} ${weight}`)
  return (await fetchOk(url)).arrayBuffer()
}

export const loadOgAssets = async (): Promise<OgAssets> => {
  const [icon, wordmark, scene, michroma, manrope] = await Promise.all([
    svgUri(readFile(join(process.cwd(), 'public', 'icon.svg'))),
    svgUri(readFile(join(process.cwd(), 'public', 'brand', 'road-to-rally.svg'))),
    svgUri(readFile(join(process.cwd(), 'public', 'brand', 'og-scene.svg'))),
    loadGoogleFont('Michroma', 400),
    loadGoogleFont('Manrope', 600),
  ])
  return {
    icon,
    wordmark,
    scene,
    fonts: [
      { name: 'Michroma', data: michroma, weight: 400, style: 'normal' },
      { name: 'Manrope', data: manrope, weight: 600, style: 'normal' },
    ],
  }
}
