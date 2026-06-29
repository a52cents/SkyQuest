# SkyQuest Design Contract

## Direction artistique

SkyQuest est une PWA mobile-first pour observer le ciel sans surcharge scientifique. La direction visuelle v0 est `spatial colore`, sombre, lisible dehors la nuit, avec une sensation d'exploration accessible. L'interface doit guider l'utilisateur rapidement vers une action : appuyer sur `Maintenant`, choisir une quete, ouvrir le guidage camera, noter le resultat.

Le design ne doit pas ressembler a Stellarium, a une carte du ciel complete, ni a un tableau scientifique. Il doit ressembler a un compagnon mobile simple, calme et lumineux.

## Palette

- Fond principal : `#070816`, bleu nuit presque noir.
- Fond secondaire : `#0E1026`, surface nocturne profonde.
- Surface glass : `rgba(20, 24, 54, 0.68)` avec `backdrop-filter: blur(18px)` si disponible.
- Surface glass solide fallback : `#161A35`.
- Texte principal : `#F7F7FF`.
- Texte secondaire : `#B8BDE6`.
- Texte muted : `#7D84B8`.
- Accent principal : `#7C5CFF`, bleu-violet.
- Accent secondaire : `#38D5FF`, cyan stellaire pour les signaux de guidage.
- Succes : `#63E6A4`.
- Warning : `#FFD166`.
- Erreur : `#FF6B8A`.

Regle : utiliser le bleu-violet comme accent dominant. Le cyan sert uniquement aux details d'orientation, focus rings, petits halos et valeurs actives. Eviter les gradients generiques trop satures.

## Typographie

- Police principale : `Outfit` via `next/font/google`, sans-serif arrondie et lisible.
- Police mono optionnelle : `Geist Mono` ou stack monospace pour valeurs techniques courtes.
- Titres mobiles : 32-44px, line-height serre mais non coupe.
- Corps : 16-18px minimum pour lisibilite nocturne.
- Labels et meta : 12-14px, uppercase seulement avec parcimonie.

## Radius

- Cards principales : `28px`.
- Cards compactes et badges : `18px`.
- Boutons : `999px` pour une affordance tactile claire.
- Overlay camera : `22px`.

## Spacing

- Grille mobile : padding horizontal 20px.
- Espacement sections : 28-40px.
- Gap entre cards : 14-18px.
- Boutons tactiles : hauteur minimum 52px.
- Zones critiques camera : garder les actions principales dans les zones atteignables au pouce.

## Style des cards

- Glassmorphism leger, pas de verre trop flou ou illisible.
- Bordure : `1px solid rgba(255,255,255,0.10)`.
- Highlight interne discret : `inset 0 1px 0 rgba(255,255,255,0.08)`.
- Ombre : halo bleu-violet tres subtil, jamais noir dur.
- Les cards doivent rester lisibles avec `prefers-reduced-transparency` ou si `backdrop-filter` n'est pas supporte.

## Style des boutons

- Bouton primaire `Maintenant` : grand, pill, fond bleu-violet, contraste fort, feedback tactile `scale(0.98)`.
- Bouton secondaire : glass sombre, bordure fine, texte clair.
- Actions `Je l'ai vu` et `Pas trouve` : boutons distincts, respectivement succes discret et surface sombre.
- Focus visible : outline cyan ou bleu-violet, 3px, offset 3px.

## Etats loading, empty, error

- Loading : skeletons glass proches de la forme finale, texte court `On lit le ciel actuel...`.
- Empty : message utile et non culpabilisant, avec action de retour.
- Error : formulation claire, permission ou reseau expliquee simplement, toujours proposer une alternative.
- Ne jamais bloquer l'utilisateur sur un spinner indefini.

## Mode camera

- Plein ecran mobile, video en `object-fit: cover`.
- Overlay 2D uniquement : titre, direction, altitude, hint textuel, repere central simple.
- Ne jamais promettre une precision parfaite. Utiliser des formulations comme `orientation approximative`, `tu es proche`, `regarde bien le ciel`.
- Bouton explicite `Activer l'orientation` pour iOS/Safari.
- Fallback lisible si camera ou boussole indisponible : direction cardinale et hauteur en degres.

## Mobile-first

- L'app doit etre confortable dehors la nuit, a une main, avec gros boutons.
- Eviter les longs paragraphes. Le texte doit etre actionnable.
- Utiliser `min-height: 100dvh`, jamais `100vh` seul.
- Layout principal optimise 360-430px de large, puis s'etend proprement sur desktop.
- Les controles importants doivent rester visibles sans scroll excessif.

## Accessibilite

- Contraste WCAG AA minimum, viser AAA pour texte principal.
- Boutons en vrais `button` ou liens semantiques.
- Labels visibles, focus states visibles, aria-live pour resultats dynamiques.
- Respecter `prefers-reduced-motion`.
- Ne pas utiliser uniquement la couleur pour communiquer un etat.
- Les permissions navigateur doivent etre expliquees avant ou pendant la demande.

## Ton general

- Clair, encourageant, prudent.
- Pas trop scientifique, pas infantilisant.
- Ne jamais dire `tu verras X a coup sur`.
- Favoriser : `bonne chance`, `a tenter`, `conditions favorables`, `pas ideal maintenant`.

## Exemples de microcopy

- `Decouvre quoi observer dans le ciel maintenant.`
- `On utilise ta position, la meteo et le ciel actuel pour proposer 1 a 3 mini-quetes.`
- `Bonne chance de visibilite.`
- `Tends le bras : un poing ferme represente environ 10 degres.`
- `La boussole peut etre imprecise. Utilise cette indication comme un guide, pas comme une cible parfaite.`
- `Le ciel n'est pas ideal maintenant. Tu peux quand meme observer deux minutes et noter ce que tu vois.`
