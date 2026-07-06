# SkyQuest Agent Rules

## Objectif du MVP

Construire une PWA mobile-first qui propose une liste classée de quêtes d'observation du ciel à faire maintenant, selon la position GPS, l'heure, la météo Open-Meteo et les objets visibles calculés avec `astronomy-engine`.

Le produit doit rester une experience guidee simple : `Maintenant -> quoi regarder -> aide camera 2D -> journal`. Ne pas construire une carte du ciel complete.

## Definition officielle de la v0

La v0 est la version actuelle de SkyQuest telle qu'elle existe dans le depot. Toute fonctionnalite presente, reliee a l'interface ou a un flux operationnel, et effectivement utilisee fait partie de la v0. Une ancienne description plus restrictive du MVP ne doit pas servir a supprimer, desactiver ou reporter une fonctionnalite existante.

La v0 comprend donc aussi les routes API Next.js, les services externes, Supabase pour le Web Push, les notifications, les taches planifiees et le worker Cloudflare deja integres. Ces briques peuvent rester optionnelles ou disposer d'un fallback, mais elles ne sont pas hors perimetre.

La frontiere produit reste la suivante : aucun compte ni authentification, pas de synchronisation distante du journal ou de la progression, et pas de stockage serveur generaliste des donnees utilisateur. Supabase est limite aux donnees techniques necessaires aux notifications push.

## Stack technique

- Next.js avec App Router.
- TypeScript strict.
- Tailwind CSS.
- PWA avec manifest, theme sombre et service worker simple.
- `astronomy-engine` pour Lune et planetes.
- Open-Meteo et Open-Meteo Air Quality pour la meteo et la transparence de l'air.
- CelesTrak et `satellite.js` pour les passages de satellites.
- Stockage navigateur pour le journal, la progression, les photos et les caches locaux.
- Routes API Next.js pour les calculs serveur, les proxys et le Web Push.
- Supabase/Postgres pour les subscriptions, verrous d'envoi et surveillances de cibles Web Push.
- Web Push avec VAPID, cron protege et worker Cloudflare pour le declenchement planifie.
- Aucun compte et aucune authentification en v0.

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
- `app/tonight/page.tsx` pour les meilleurs creneaux et evenements a venir.
- `app/explore/*`, `app/atlas/page.tsx` et `app/glossary/page.tsx` pour la decouverte pedagogique.
- `app/profile/page.tsx` pour la progression locale et les reglages de notifications.
- `app/api/*` pour les integrations serveur existantes : satellites, qualite du ciel, pratiques d'eclairage, contenus NASA et Web Push.
- `app/api/cron/sky-alerts/route.ts` et `workers/sky-alerts-cron/*` pour l'evaluation planifiee des alertes.
- `components/*` pour UI reutilisable.
- `lib/astro.ts` pour calculs astronomiques.
- `lib/weather.ts` pour Open-Meteo.
- `lib/visibility.ts` pour scoring.
- `lib/orientation.ts` pour helpers boussole et altitude.
- `lib/storage.ts` pour journal et quete active.
- `lib/quest-generator.ts` pour generation des quetes.
- `lib/push-*.ts`, `lib/supabase-server.ts` et `lib/target-watch.ts` pour les notifications cote client et serveur.
- `lib/types.ts` pour types partages.

`docs/architecture.md` decrit le detail des routes et des flux. Toute nouvelle route API doit documenter les donnees recues, les services contactes, les secrets requis et son comportement de secours.

## Conventions de nommage

### Concepts métier

- `Quest` / `SkyQuest` = mission proposée à l'utilisateur. Une quête contient la cible, les indications de guidage et les conditions estimées au moment de sa génération.
- `Observation` = résultat enregistré dans le journal après une quête. Elle indique notamment si la cible a été vue ou non trouvée.
- `target` = identifiant de l'objet ou du phénomène à observer. Ne pas l'utiliser pour désigner la quête complète.
- `targetType` / `QuestTargetType` = famille fonctionnelle de la cible : Lune, planète, étoile, constellation, météores, satellite, etc.
- `SkyObject` = position astronomique calculée d'un objet à un instant donné. Ce n'est ni une quête ni une observation enregistrée.
- `catalogSkyObject` / `CatalogSkyObject` = entrée éditoriale du catalogue avec coordonnées, description et conseils d'observation.
- `candidate` / `QuestCandidate` = cible évaluée pendant la génération, avant sa sélection comme quête.
- `activeQuest` = quête sélectionnée et stockée localement pour être relue par `/quest/[id]`.
- `FreeObservation` / `free_observation` = fallback proposé quand aucune quête fiable n'est disponible ou que la position manque.

### Coordonnées et orientation

- `latitude` / `longitude` = coordonnées géographiques de l'observateur, en degrés décimaux. Toujours préciser `observer` ou `location` si une ambiguïté est possible.
- `azimuth` = direction horizontale en degrés, mesurée depuis le nord dans le sens horaire, normalisée dans `[0, 360)`.
- `altitude` = hauteur angulaire au-dessus de l'horizon en degrés. Une valeur négative désigne une cible sous l'horizon.
- `cardinalDirection` = traduction lisible de l'azimut, par exemple nord-est ou sud-ouest.
- `rightAscensionHours` = ascension droite équatoriale exprimée en heures.
- `declinationDegrees` = déclinaison équatoriale exprimée en degrés.
- `CameraPointing` = orientation estimée de la caméra sous forme d'azimut, d'altitude et de niveau de confiance.
- `orientation` = mesure ou état des capteurs du téléphone ; ne pas employer ce terme comme synonyme de direction cardinale.
- `heading` = cap horizontal brut fourni par un capteur ou Safari ; le convertir avant de l'utiliser comme azimut applicatif.

### Visibilité et météo

- `visibilityScore` = indice interne de conditions et de confort d'observation compris entre 0 et 100. Ce n'est pas une probabilité scientifique ni une garantie de visibilité.
- `visibilityLabel` = formulation utilisateur dérivée du score, comme `Bonne chance` ou `Tentable`.
- `cloudCover` = couverture nuageuse en pourcentage, comprise entre 0 et 100.
- `isDay` = état jour/nuit fourni par la météo ; les calculs astronomiques plus précis utilisent plutôt l'altitude du Soleil.
- `sunAltitude` = hauteur du Soleil en degrés, utilisée pour distinguer jour, crépuscule et nuit.
- `WeatherNow` = photographie simplifiée des conditions météo utilisées pour générer les quêtes.

### Journal et progression

- `seen` = l'utilisateur déclare avoir trouvé la cible.
- `missed` = l'utilisateur déclare ne pas avoir trouvé la cible. Préférer ce terme à `failed`, qui serait inutilement punitif.
- `discovery` = première observation confirmée d'une cible ; une observation `missed` n'est pas une découverte.
- `reward` / `ProgressReward` = résultat du calcul de progression produit par une observation.
- `profile` / `ProgressProfile` = état local cumulé de la progression.
- `localNight` / `nightKey` = nuit d'observation selon le calendrier local, pas uniquement selon la date UTC.

### Règles générales

- Utiliser les noms de domaine en anglais dans le code et les libellés français dans l'interface.
- Conserver les unités dans le nom lorsque le type seul ne suffit pas : `durationSeconds`, `horizonMinutes`, `rightAscensionHours`.
- Préférer un suffixe explicite comme `At`, `Date`, `Time`, `Seconds` ou `Minutes` pour les valeurs temporelles.
- Réserver `current` aux données du moment et `future` / `upcoming` aux suggestions ou événements à venir.
- Ne pas utiliser indifféremment `object`, `target`, `quest` et `observation` : chaque terme représente une étape différente du parcours.

## Regles de code

- Favoriser fonctions pures dans `lib`.
- Garder les Client Components uniquement pour les APIs navigateur et l'interactivite.
- Typer explicitement les objets de domaine.
- Gerer les erreurs par etats UI, pas par crash.
- Eviter les dependances inutiles.
- Ne pas introduire de compatibilite complexe sans besoin concret.
- Respecter les permissions navigateur : demander seulement sur action utilisateur.

## Regles design

- Respecter `UI_SOURCE_OF_TRUTH.md` pour la hiérarchie des sources UI et `DESIGN.md` pour l'intention visuelle.
- Dark spatial colore, accent bleu-violet, glass leger.
- Mobile-first, gros controles, contraste fort.
- Pas d'interface trop scientifique.
- Pas de longs blocs de texte dans le parcours principal.

## Regles UX

- Le bouton principal `Maintenant` doit etre evident.
- Expliquer position, camera et orientation en langage simple.
- Les etats loading, empty et error doivent etre utiles et actionnables.
- Le journal doit etre local, simple, effacable.
- Les alertes doivent etre optionnelles, personnalisables et desactivables.
- Les hints camera doivent rester approximatifs et prudents.

## Securite et permissions navigateur

- GPS via `navigator.geolocation.getCurrentPosition` uniquement apres clic utilisateur.
- Camera via `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })` uniquement apres demarrage du guidage.
- Orientation via permission explicite quand necessaire sur iOS/Safari.
- Notifications via permission explicite, uniquement apres une action utilisateur dans le Profil.
- Stopper les tracks camera au demontage du composant.
- Ne pas collecter ni envoyer de photos.
- Ne pas stocker de position precise au-dela du navigateur ; arrondir latitude/longitude avant persistance ou envoi selon le flux documente.
- Les subscriptions push, preferences d'alertes, positions arrondies, verrous d'envoi et surveillances de cibles associes sont les seules donnees persistees dans Supabase en v0.
- Ne jamais utiliser l'endpoint push comme preuve d'autorite ni le placer dans une query string ; les routes navigateur exigent le jeton de gestion dont seul le hash est stocke cote serveur.
- Garder `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` et `PUSH_TEST_SECRET` strictement cote serveur.
- Proteger les routes de cron et de test push par leurs secrets dedies.

## A ne pas faire en v0

- Pas de compte utilisateur.
- Pas d'authentification ni de profil distant.
- Pas de synchronisation distante du journal, de la progression ou des photos.
- Pas de nouvelle base generaliste de donnees utilisateur au-dela du perimetre Web Push existant sans decision produit explicite.
- Pas de paiement.
- Pas de vraie AR 3D.
- Pas de WebXR obligatoire.
- Pas de reconnaissance automatique des photos.
- Pas de carte du ciel complete.
- Ne pas retirer les API, Supabase, le cron ou les notifications au motif qu'ils auraient ete prevus pour une version ulterieure : ils appartiennent a la v0 actuelle.

## Roadmap future

- v0.2 : ameliorer la pertinence des alertes, du crepuscule et de la qualite de ciel ; les notifications existent deja en v0.
- v0.3 : evaluer un compte et une sauvegarde multi-device optionnels, avec un backend de synchronisation distinct du backend operationnel deja present.
- v0.4 : module AR 3D remplacant `CameraGuide`.
- v0.4 : WebXR ou integration native si PWA insuffisante.
