# 🚇 Consultation — Tunnels (B-15)

- **type** : consultation
- **date** : 2026-11-23
- **étape pipeline** : production (epics 1 à 4 validés, epic 5 au volant)
- **personas** : 🎨 DA, 🗺️ Level Designer, 💡 Lighting Artist, 🛠️ Technical Artist, 🔊 Sound Designer
- **origine** : T-6 (« je n'ai aucun tunnel »), puis la décision de Baptiste : « pas de tranchée, on va intégrer des tunnels »
- **non vérifié** : aucun tunnel n'existe en jeu, donc tout est 📖 déduit du code ; les deux GPX de T-6 ont été roulés par Baptiste (🧑)
- **visuel** : [PR-21-tunnels.html](../visuels/PR-21-tunnels.html)

## Remarques

**🛠️ Technical Artist** — Le tunnel est reconnu (`ignRoads.ts:131`, `tunnel=yes`) et le profil interpolé (`profile.ts:13`), mais le relief est raccordé à la route comme ailleurs : seuls les ponts y échappent (`terrain.ts:161`). Aux Grands Goulets, la trace OSM s'écarte jusqu'à 45 m de la BD TOPO, alors que l'appariement tolère 15 m (`OSM_MATCH_DISTANCE`) : environ 1,1 km de tunnel peut ne pas être reconnu.

- ⚠️ Reconnaissance du tunnel trouée sur les longs ouvrages · viole P14 · 🟠 · 📖
- ⚠️ Ombres limitées à 80 m (PR-14) : au-delà, l'intérieur d'un long tunnel recevrait le soleil · viole P10/P8 · 🟠 · 📖
- ✅ Les ponts ont déjà tout le chemin à copier : repérage, style choisi par la longueur (`bridges.ts`), ouverture du terrain sous le tablier (`terrain.ts`)

**🎨 DA** — Un tunnel est une signature visuelle forte d'une spéciale de montagne. La famille des ponts (pierre, treillis, béton selon la longueur) appelle la même logique pour les portails.

- ⚠️ La tranchée efface la montagne : le monde ment sur la géographie réelle · viole P1/P7 · 🔴 · 🧑

**🗺️ Level Designer** — L'entrée de tunnel est un moment de course : changement de lumière, de son et de largeur. Elle doit se voir de loin (silhouette du portail) et l'intérieur doit rester lisible en courbe.

- ⚠️ Rien n'annonce le tunnel aujourd'hui · viole P8/P12 · 🟠 · 🧑

**💡 Lighting Artist** — Dans `afternoon`, passer du plein soleil au noir aveugle. Il faut des repères lumineux qui dessinent la courbe, sans vraies lumières en série.

- ⚠️ Pas de plan lumière pour un intérieur · viole P12 · 🟠 · 📖

**🔊 Sound Designer** — Dans un tunnel, le moteur résonne : c'est la moitié de la sensation.

- ⚠️ Aucun changement d'acoustique · viole P13 · 🟡 · 📖

## Propositions

**PR-21 · Forme du tunnel** (Tech Artist + DA, P1/P7)

- A — Montagne gardée : le terrain n'est plus raboté sur le tunnel, il est percé aux portails, et un tube (voûte + parois + collisions) suit l'axe · coût L
- B — Tranchée couverte : raccord actuel et boîte béton posée dedans · coût M · la montagne reste effacée
- C — Galerie ouverte côté vide, pour les tunnels de gorge, en complément de A · coût M
- 👉 Recommandation : A, avec C en option plus tard
- Si on ne fait rien : la tranchée reste (refusée par Baptiste)
- Décision : ✅ A et C, tout de suite (2026-11-23) : « ne fait pas c plus tard. le but est d'avoir du réalisme »

**PR-22 · Portails** (DA, P8)

- A — Roc brut taillé · B — Tête béton routière avec panneau nom + longueur · C — Arche en pierre
- 👉 Recommandation : choix automatique comme les ponts : roc brut sous 80 m, béton au-delà ; pierre écartée en v0 (rien dans la BD TOPO ne date l'ouvrage)
- Décision : ✅ choix automatique (2026-11-23). Règle complétée et validée le 2026-11-23 : roc brut sous 80 m, arche en pierre sur petite route (importance 4 à 6) de 80 à 300 m, béton sur grande route ou au-delà

**PR-23 · Intérieur** (Lighting Artist, P8/P12/P10)

- A — Noir, phares seuls · B — Bandes de lampes émissives sur les parois, sortie lumineuse · C — Vraies lumières ponctuelles
- 👉 Recommandation : B, avec un intérieur exclu du soleil
- Décision : ✅ B (2026-11-23), C (vraies lumières) ⏸️ plus tard

**PR-24 · Reconnaître tout le tunnel** (Tech Artist, P14)

- A — Tolérance d'appariement élargie à ~50 m pour les ouvrages · B — Combler l'axe entre deux points de tunnel reconnus sur le même ouvrage BD TOPO
- 👉 Recommandation : B (ne déborde pas sur les routes voisines)
- Décision : ✅ B (2026-11-23), après réexplication

**PR-25 · Son dans le tunnel** (Sound Designer, P13)

- A — Réverbe courte sur le bus moteur à l'intérieur, fondue aux portails · B — Rien en v0
- 👉 Recommandation : A
- Décision : ✅ A (2026-11-23)

## Ajout de Baptiste (2026-11-23)

Annonce de tunnel par le copilote, étape à part entière du dev : un mot de voix et une icône nouvelle, dans la grammaire des icônes de virage (story 4.9).

## Références à regarder

- **Colin McRae Rally 2.0** (2000, PC) — la spéciale d'Italie : regarder comment l'entrée d'un tunnel court se lit depuis la route (silhouette du portail, contraste) · liée à PR-22/PR-23. Le studio n'est pas sûr du nom exact de la spéciale.

## Tests

- **T-7 · Grands Goulets avec tunnel** (Level Designer, après PR-21 à PR-23) — fais : roule le GPX `T-6-grands-goulets-tunnel` · observe : on voit le tunnel arriver, on lit la courbe dedans · réponds : lisible / trop sombre / trop clair

Statut : en cours
