# SkyQuest Agent Rules

## Objectif du MVP

Construire une PWA mobile-first qui propose 1 a 3 quetes d'observation du ciel a faire maintenant, selon la position GPS, l'heure, la meteo Open-Meteo et les objets visibles calcules avec `astronomy-engine`.

Le produit doit rester une experience guidee simple : `Maintenant -> quoi regarder -> aide camera 2D -> journal`. Ne pas construire une carte du ciel complete.

## Stack technique

- Next.js avec App Router.
- TypeScript strict.
- Tailwind CSS.
- PWA avec manifest, theme sombre et service worker simple.
- `astronomy-engine` pour Lune et planetes.
- Open-Meteo pour meteo actuelle ou horaire proche.
- `localStorage` pour le journal v0.
- Aucun backend, aucune base de donnees, aucune authentification en v0.

## Contraintes produit

- L'utilisateur doit toujours obtenir une reponse, meme si GPS, meteo, camera ou orientation echoue.
- Les quetes doivent etre simples, courtes, comprehensibles par un debutant.
- Afficher seulement les quetes avec score >= 50 si possible.
- Si aucune quete fiable n'existe, proposer `FreeObservation`.
- Ne jamais promettre une observation certaine.
- L'app doit fonctionner en HTTPS pour GPS, camera et orientation sur mobile.

## Architecture a respecter

- `app/page.tsx` pour l'accueil et la generation de quetes.
- `app/journal/page.tsx` pour le journal.
- `app/quest/[id]/page.tsx` pour le mode guidage d'une quete stockee localement.
- `components/*` pour UI reutilisable.
- `lib/astro.ts` pour calculs astronomiques.
- `lib/weather.ts` pour Open-Meteo.
- `lib/visibility.ts` pour scoring.
- `lib/orientation.ts` pour helpers boussole et altitude.
- `lib/storage.ts` pour journal et quete active.
- `lib/quest-generator.ts` pour generation des quetes.
- `lib/types.ts` pour types partages.

## Regles de code

- Favoriser fonctions pures dans `lib`.
- Garder les Client Components uniquement pour les APIs navigateur et l'interactivite.
- Typer explicitement les objets de domaine.
- Gerer les erreurs par etats UI, pas par crash.
- Eviter les dependances inutiles.
- Ne pas introduire de compatibilite complexe sans besoin concret.
- Respecter les permissions navigateur : demander seulement sur action utilisateur.

## Regles design

- Respecter `DESIGN.md` comme source de verite.
- Dark spatial colore, accent bleu-violet, glass leger.
- Mobile-first, gros controles, contraste fort.
- Pas d'interface trop scientifique.
- Pas de longs blocs de texte dans le parcours principal.

## Regles UX

- Le bouton principal `Maintenant` doit etre evident.
- Expliquer position, camera et orientation en langage simple.
- Les etats loading, empty et error doivent etre utiles et actionnables.
- Le journal doit etre local, simple, effacable.
- Les hints camera doivent rester approximatifs et prudents.

## Securite et permissions navigateur

- GPS via `navigator.geolocation.getCurrentPosition` uniquement apres clic utilisateur.
- Camera via `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })` uniquement apres demarrage du guidage.
- Orientation via permission explicite quand necessaire sur iOS/Safari.
- Stopper les tracks camera au demontage du composant.
- Ne pas collecter ni envoyer de photos.
- Ne pas stocker de position precise au-dela du journal local ; arrondir latitude/longitude.

## A ne pas faire en v0

- Pas de compte utilisateur.
- Pas de backend obligatoire.
- Pas de paiement.
- Pas de vraie AR 3D.
- Pas de WebXR obligatoire.
- Pas de reconnaissance automatique des photos.
- Pas de carte du ciel complete.
- Pas de notifications push.
- Pas de passage ISS en v0.

## Roadmap future

- v0.2 : notifications push `Ciel degage maintenant`, `3 quetes disponibles ce soir`.
- v0.2 : meilleure detection crepuscule/nuit et qualite de ciel.
- v0.3 : backend optionnel pour sauvegarde multi-device.
- v0.3 : compte utilisateur optionnel.
- v0.4 : module AR 3D remplacant `CameraGuide`.
- v0.4 : WebXR ou integration native si PWA insuffisante.
- v0.5 : objets supplementaires, ISS, constellations guidees, calendrier d'evenements.
