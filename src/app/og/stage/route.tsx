import { ImageResponse } from 'next/og'

import { loadOgAssets, OG_SIZE } from '@/components/og/assets'
import { ShareCard } from '@/components/og/ShareCard'

// Image de partage d'une spéciale : /og/stage?name=…&time=…
// Sans temps → le nom du tracé ; avec un temps → « <nom> en <temps> ».
const clean = (value: string | null, max: number): string => (value ?? '').trim().slice(0, max)

export const GET = async (request: Request): Promise<ImageResponse> => {
  const params = new URL(request.url).searchParams
  const name = clean(params.get('name'), 48) || 'Spéciale'
  const time = clean(params.get('time'), 12)
  const assets = await loadOgAssets()
  return new ImageResponse(
    <ShareCard assets={assets} title={time ? `${name} en ${time}` : name} />,
    { ...OG_SIZE, fonts: assets.fonts },
  )
}
