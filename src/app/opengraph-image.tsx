import { ImageResponse } from 'next/og'

import { loadOgAssets, OG_ALT, OG_SIZE } from '@/components/og/assets'
import { ShareCard } from '@/components/og/ShareCard'

// Image de partage du jeu entier. Une spéciale ou un temps partagé utilise /og/stage.
export const alt = OG_ALT
export const size = OG_SIZE
export const contentType = 'image/png'

const Image = async (): Promise<ImageResponse> => {
  const assets = await loadOgAssets()
  return new ImageResponse(<ShareCard assets={assets} />, { ...OG_SIZE, fonts: assets.fonts })
}

export default Image
