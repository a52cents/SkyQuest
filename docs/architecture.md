# Architecture

## Vue générale

SkyQuest utilise Next.js App Router, React, TypeScript strict et Tailwind CSS. L'application ne
possède ni compte ni authentification. Le journal et la progression restent dans `localStorage` ;
une table Supabase optionnelle conserve uniquement les abonnements Web Push.

```text
UI client
  ├─ permissions navigateur : GPS, caméra, orientation
  ├─ calculs locaux : astronomie, scoring, projection, progression
  ├─ Open-Meteo : météo actuelle
  ├─ Open-Meteo Air Quality / CAMS : voile atmosphérique actuel
  ├─ /api/iss-pass → CelesTrak : éléments orbitaux ISS mis en cache 2 h
  ├─ /api/satellite-passes → CelesTrak : satellites brillants et Starlink récents
  ├─ /api/light-pollution → provider optionnel : qualité du ciel
  ├─ /api/lighting-practice → API Geo + index communal Cerema
  └─ /api/push/* → abonnement Web Push optionnel
```

## Routes

| Route                    | Responsabilité                                 |
| ------------------------ | ---------------------------------------------- |
| `/`                      | vitrine web ou dashboard en mode PWA installé  |
| `/quest/[id]`            | guidage de la quête active                     |
| `/journal`               | observations stockées localement               |
| `/explore`               | catalogue pédagogique                          |
| `/profile`               | progression locale et réglages d’alertes       |
| `/api/iss-pass`          | calcul serveur d'un passage ISS via CelesTrak  |
| `/api/satellite-passes`  | passages brillants et trains Starlink prudents |
| `/api/light-pollution`   | estimation de qualité du ciel et fallback      |
| `/api/lighting-practice` | commune française et pratique d'éclairage      |

## Flux « Maintenant »

1. `Dashboard` demande la position après un clic.
2. `weather.ts` interroge Open-Meteo et fournit un fallback prudent en cas d'échec.
3. `air-quality.ts` récupère l'épaisseur optique des aérosols et les particules actuelles auprès d'Open-Meteo/CAMS.
4. Le client interroge `/api/light-pollution` avec des coordonnées arrondies et relit son cache local si possible.
5. En France, `/api/lighting-practice` associe la position arrondie à une commune via API Geo puis consulte l'index Cerema embarqué.
6. `astro.ts` calcule le Soleil, la Lune et les planètes.
7. `quest-generator.ts` rassemble les candidats du catalogue, des météores et de l'ISS.
8. `visibility.ts` attribue les scores, avec un impact plus fort sur les objets faibles.
9. Le dashboard conserve l'analyse en cache et affiche les quêtes dans l'ordre de pertinence.
10. `storage.ts` sauvegarde la quête choisie avant la navigation vers `/quest/[id]`.

## Séparation des responsabilités

- `app/` contient les routes et leur composition ;
- `components/` contient l'interface et les interactions ;
- `hooks/` encapsule les capteurs et événements navigateur ;
- `lib/` contient les calculs, types, services et accès au stockage ;
- `public/` contient le manifest et le service worker.

Les fonctions de `lib/` doivent rester pures lorsqu'elles n'ont pas besoin d'une API navigateur. Les Client Components sont réservés aux permissions, capteurs, stockage et interactions.

## Données locales

`storage.ts` centralise la quête active, la position arrondie, les 50 dernières observations et la progression. Les préférences d'onboarding, de mode nuit, de retours haptiques et de thèmes de notification utilisent également `localStorage`.

Les lectures doivent tolérer un stockage indisponible, corrompu ou provenant d'une ancienne version. Aucun module de stockage ne doit transmettre ces données à un serveur.

## Réseau et sécurité

- Open-Meteo est appelé directement par le navigateur ;
- Open-Meteo Air Quality reçoit des coordonnées arrondies à `0,01°` et son échec reste non bloquant ;
- CelesTrak est appelé côté serveur au maximum toutes les deux heures ; la position reste sur le serveur ;
- le provider de qualité du ciel est appelé côté serveur uniquement si `LIGHT_POLLUTION_API_URL` existe ;
- l'API Geo reçoit côté serveur des coordonnées arrondies à `0,01°` et renvoie seulement la commune ;
- les alertes sont activées uniquement après un clic explicite dans le Profil ; les thèmes et une
  position arrondie à `0,1°` sont synchronisés avec la subscription push ;
- le middleware définit CSP, Permissions Policy, HSTS en production et protections anti-frame ;
- GPS, caméra et orientation exigent HTTPS hors `localhost`.

## Validation

Les changements transversaux doivent passer `npm run format:check`, `npm run lint`, `npm test` et `npm run build`. Les comportements de caméra et de capteurs doivent aussi être vérifiés sur un vrai téléphone.
