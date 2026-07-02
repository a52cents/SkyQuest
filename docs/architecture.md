# Architecture

## Vue générale

SkyQuest utilise Next.js App Router, React, TypeScript strict et Tailwind CSS. L'application ne possède ni base de données ni authentification. Les données utilisateur sont persistées dans `localStorage`.

```text
UI client
  ├─ permissions navigateur : GPS, caméra, orientation
  ├─ calculs locaux : astronomie, scoring, projection, progression
  ├─ Open-Meteo : météo actuelle
  └─ /api/iss-pass → N2YO : passage ISS facultatif
```

## Routes

| Route           | Responsabilité                                |
| --------------- | --------------------------------------------- |
| `/`             | vitrine web ou dashboard en mode PWA installé |
| `/quest/[id]`   | guidage de la quête active                    |
| `/journal`      | observations stockées localement              |
| `/explore`      | catalogue pédagogique                         |
| `/profile`      | XP, rangs, séries et accomplissements         |
| `/api/iss-pass` | proxy facultatif vers N2YO                    |

## Flux « Maintenant »

1. `Dashboard` demande la position après un clic.
2. `weather.ts` interroge Open-Meteo et fournit un fallback prudent en cas d'échec.
3. `astro.ts` calcule le Soleil, la Lune et les planètes.
4. `quest-generator.ts` rassemble les candidats du catalogue, des météores et de l'ISS.
5. `visibility.ts` attribue les scores.
6. Le dashboard conserve l'analyse en cache et affiche les quêtes dans l'ordre de pertinence.
7. `storage.ts` sauvegarde la quête choisie avant la navigation vers `/quest/[id]`.

## Séparation des responsabilités

- `app/` contient les routes et leur composition ;
- `components/` contient l'interface et les interactions ;
- `hooks/` encapsule les capteurs et événements navigateur ;
- `lib/` contient les calculs, types, services et accès au stockage ;
- `public/` contient le manifest et le service worker.

Les fonctions de `lib/` doivent rester pures lorsqu'elles n'ont pas besoin d'une API navigateur. Les Client Components sont réservés aux permissions, capteurs, stockage et interactions.

## Données locales

`storage.ts` centralise la quête active, la position arrondie, les 50 dernières observations et la progression. Les préférences d'onboarding, de mode nuit et de retours haptiques utilisent également `localStorage`.

Les lectures doivent tolérer un stockage indisponible, corrompu ou provenant d'une ancienne version. Aucun module de stockage ne doit transmettre ces données à un serveur.

## Réseau et sécurité

- Open-Meteo est appelé directement par le navigateur ;
- N2YO est appelé côté serveur uniquement si `N2YO_API_KEY` existe ;
- le middleware définit CSP, Permissions Policy, HSTS en production et protections anti-frame ;
- GPS, caméra et orientation exigent HTTPS hors `localhost`.

## Validation

Les changements transversaux doivent passer `npm run format:check`, `npm run lint`, `npm test` et `npm run build`. Les comportements de caméra et de capteurs doivent aussi être vérifiés sur un vrai téléphone.
