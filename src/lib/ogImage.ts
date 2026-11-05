import type { Metadata } from 'next'

interface SharedStage {
  name: string
  time?: string
}

// Métadonnées de partage d'une spéciale ou d'un temps, à renvoyer par generateMetadata (epic 6).
export const stageShareMetadata = ({ name, time }: SharedStage): Metadata => {
  const params = new URLSearchParams({ name, ...(time ? { time } : {}) })
  const title = time ? `${name} en ${time}, bats ce temps` : `${name}, une spéciale à rouler`
  const image = { url: `/og/stage?${params}`, width: 1200, height: 630, alt: title }
  return {
    title,
    openGraph: { title, images: [image] },
    twitter: { card: 'summary_large_image', title, images: [image] },
  }
}
