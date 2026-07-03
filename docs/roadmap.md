# Roadmap

Cette roadmap décrit une direction produit. Elle ne constitue pas une promesse de livraison et ne signifie pas que les fonctionnalités sont déjà disponibles.

## MVP actuel — v0

- PWA mobile-first ;
- quêtes selon lieu, heure, météo et objets visibles ;
- Lune, planètes et catalogue de repères ;
- météores et ISS optionnelle ;
- guidage caméra 2D prudent ;
- journal et progression locale ;
- mode dégradé sans GPS, météo, caméra ou orientation ;
- alertes Web Push optionnelles et désactivables ;
- aucune authentification ; Supabase conserve seulement les subscriptions push.

## v0.2 — Pertinence du moment

- meilleure distinction jour, crépuscule et nuit ;
- estimation plus fine de la qualité du ciel ;
- meilleure pertinence des alertes « Ciel dégagé maintenant » ;
- sélection plus fine des quêtes annoncées le soir ;
- amélioration des suggestions futures.

Les notifications restent explicites, peu fréquentes et désactivables. Leur permission n’est
demandée qu’après une action volontaire dans le Profil.

## v0.3 — Continuité optionnelle

- backend facultatif ;
- sauvegarde multi-appareil ;
- compte utilisateur optionnel ;
- conservation d'un mode local utilisable sans inscription.

Cette étape nécessitera une décision explicite sur les données, la sécurité, la suppression de compte et la migration depuis `localStorage`.

## v0.4 — Guidage spatial avancé

- évaluation d'un module AR 3D remplaçant progressivement `CameraGuide` ;
- étude WebXR ou d'une intégration native si la PWA est insuffisante ;
- calibration et qualité de capteurs améliorées.

La précision ajoutée devra être mesurable. Une interface plus spectaculaire ne justifie pas à elle seule la complexité, les permissions ou une dépendance native.

## Toujours hors périmètre sans décision explicite

- carte du ciel professionnelle complète ;
- reconnaissance automatique des photos ;
- stockage distant silencieux des images ou positions ;
- paiement ;
- réseau social ;
- tracking invasif ;
- WebXR obligatoire pour utiliser l'application.

## Critères de priorité

Une évolution est prioritaire si elle améliore la probabilité qu'un débutant sorte, regarde dans la bonne direction et comprenne ce qu'il cherche, tout en gardant un fallback simple lorsque la technologie échoue.
