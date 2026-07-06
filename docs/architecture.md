# Architecture

## Vue générale

SkyQuest utilise Next.js App Router, React, TypeScript strict et Tailwind CSS. L'application ne
possède ni compte ni authentification. Le journal et la progression restent dans le navigateur ;
les tables Supabase optionnelles conservent uniquement les données techniques nécessaires au Web
Push.

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
  ├─ /api/nasa/highlights → NASA : sélection éditoriale mise en cache
  ├─ /api/push/* → abonnements, rappels et surveillances Web Push
  └─ /api/cron/sky-alerts ← crons Cloudflare et Vercel protégés par secret
```

## Routes

| Route                    | Responsabilité                                 |
| ------------------------ | ---------------------------------------------- |
| `/`                      | vitrine web ou dashboard en mode PWA installé  |
| `/quest/[id]`            | guidage de la quête active                     |
| `/journal`               | observations stockées localement               |
| `/explore`               | catalogue pédagogique                          |
| `/profile`               | progression locale et réglages d’alertes       |
| `/tonight`               | créneaux d'observation et événements à venir   |
| `/atlas`                 | découvertes confirmées et progression locale   |
| `/glossary`              | définitions pédagogiques                       |
| `/support`               | soutien volontaire hors parcours principal     |
| `/offline`               | état de secours sans réseau                    |
| `/api/iss-pass`          | calcul serveur d'un passage ISS via CelesTrak  |
| `/api/satellite-passes`  | passages brillants et trains Starlink prudents |
| `/api/light-pollution`   | estimation de qualité du ciel et fallback      |
| `/api/lighting-practice` | commune française et pratique d'éclairage      |
| `/api/nasa/highlights`   | contenus NASA normalisés et mis en cache       |
| `/api/push/subscribe`    | création ou mise à jour d'une subscription     |
| `/api/push/unsubscribe`  | désactivation idempotente d'une subscription   |
| `/api/push/test`         | notification de test protégée et limitée       |
| `/api/push/reminder`     | programmation d'un rappel de meilleur créneau  |
| `/api/push/target-watch` | gestion des cibles à surveiller                |
| `/api/cron/sky-alerts`   | évaluation et envoi planifiés des alertes      |
| `/api/debug/open-meteo`  | diagnostic serveur Open-Meteo                  |

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

`storage-parsers.ts` est la source unique de validation runtime pour la quête active, la dernière
position, le cache d'analyse du tableau de bord et le meilleur créneau. Les objets imbriqués sont
validés avant usage ; une valeur corrompue est ignorée et supprimée du stockage lorsqu'il est
disponible.

L'enregistrement d'une observation et de ses éventuelles photos forme une seule transaction
IndexedDB. La progression et la quête du soir ne sont mises à jour qu'après son commit. En cas
d'échec, l'interface doit indiquer que ni le journal ni la progression n'ont changé et permettre de
réessayer.

Le journal conserve strictement les 50 observations les plus récentes. La suppression des entrées
plus anciennes et de leurs photos appartient à la même transaction que l'ajout ou la migration.
L'interface ne doit afficher un journal vide qu'après confirmation de l'effacement IndexedDB.

## Réseau et sécurité

- Open-Meteo est appelé directement par le navigateur ;
- Open-Meteo Air Quality reçoit des coordonnées arrondies à `0,01°` et son échec reste non bloquant ;
- CelesTrak est appelé côté serveur au maximum toutes les deux heures ; la position reste sur le serveur ;
- le provider de qualité du ciel est appelé côté serveur uniquement si `LIGHT_POLLUTION_API_URL` existe ;
- l'API Geo reçoit côté serveur des coordonnées arrondies à `0,01°` et renvoie seulement la commune ;
- les alertes sont activées uniquement après un clic explicite dans le Profil ; les thèmes et une
  position arrondie à `0,1°` sont synchronisés avec la subscription push ;
- les routes de gestion push utilisent un jeton aléatoire conservé dans le navigateur ; Supabase
  stocke uniquement son hash SHA-256 et l'endpoint n'apparaît jamais dans une query string ;
- le middleware définit CSP, Permissions Policy, HSTS en production et protections anti-frame ;
- GPS, caméra et orientation exigent HTTPS hors `localhost`.

## Validation

Les changements transversaux doivent passer `npm run format:check`, `npm run lint`, `npm test` et `npm run build`. Les comportements de caméra et de capteurs doivent aussi être vérifiés sur un vrai téléphone.
