/* eslint-disable @next/next/no-img-element -- Satori (next/og) ne rend que des <img>, pas next/image */
import { type OgAssets, ogColors } from './assets'

interface ShareCardProps {
  assets: OgAssets
  // Absent : partage du jeu, l'accroche s'affiche. Présent : nom de la spéciale, suivi du temps pour un défi.
  title?: string
}

// D'après les templates @ogimagecn/logo et /photo : scène low-poly, grand logo, une ligne qui dit ce qui est partagé.
export const ShareCard = ({ assets, title }: ShareCardProps) => (
  <div
    style={{
      alignItems: 'center',
      color: ogColors.foreground,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Manrope',
      height: '100%',
      justifyContent: 'center',
      position: 'relative',
      width: '100%',
    }}
  >
    <img src={assets.scene} width={1200} height={630} alt="" style={{ left: 0, position: 'absolute', top: 0 }} />
    <img src={assets.icon} width={104} height={104} alt="" style={{ borderRadius: 24, boxShadow: '0 20px 70px rgba(255,210,63,0.25)' }} />
    <img src={assets.wordmark} width={420} height={202} alt="Road to Rally" style={{ marginTop: 12 }} />
    {title ? (
      <div style={{ color: '#ffffff', display: 'flex', fontFamily: 'Michroma', fontSize: 46, marginTop: 18, textShadow: '0 2px 24px rgba(0,0,0,0.5)' }}>
        {title}
      </div>
    ) : (
      <div style={{ color: '#c3ccd8', display: 'flex', fontSize: 32, marginTop: 18 }}>Trace ta spéciale, roule au chrono, partage le lien</div>
    )}
  </div>
)
