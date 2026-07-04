# Project Context

Ce document donne une vue d'ensemble de SkyQuest aux personnes et agents qui interviennent sur le projet. Il complète :

- [`AGENTS.md`](./AGENTS.md), qui contient les règles de contribution à respecter ;
- [`README.md`](./README.md), qui explique comment installer, lancer et tester le projet ;
- [`UI_SOURCE_OF_TRUTH.md`](./UI_SOURCE_OF_TRUTH.md), qui définit la hiérarchie des références UI ;
- [`DESIGN.md`](./DESIGN.md), qui décrit l'intention visuelle ;
- [`docs/`](./docs/), qui rassemble les guides spécialisés produit, architecture, caméra, PWA et design.

En cas de contradiction, `AGENTS.md` reste la source de vérité pour les règles produit et techniques. Pour l'interface, suivre l'ordre défini dans `UI_SOURCE_OF_TRUTH.md`.

## Produit

SkyQuest est une application mobile-first d'observation du ciel destinée aux débutants et aux curieux. Elle répond à une question simple :

> Qu'est-ce que je peux essayer d'observer dans le ciel maintenant, depuis l'endroit où je me trouve ?

L'application transforme les conditions du moment en courtes missions guidées. Elle utilise la position de l'utilisateur, la date, l'heure, la météo et des calculs astronomiques pour proposer des cibles adaptées.

SkyQuest ne doit pas devenir une carte du ciel complète, un logiciel d'astronomie professionnel ou un tableau de bord scientifique. Sa valeur vient de la sélection, de la simplicité et de l'accompagnement.

### Promesse

- donner une réponse rapidement ;
- proposer des actions compréhensibles sans connaissances en astronomie ;
- guider sans prétendre garantir une observation ;
- continuer à fonctionner de manière utile lorsque certaines données ou permissions manquent ;
- conserver une trace personnelle sans imposer de compte.

### Public principal

- personnes qui commencent à observer le ciel ;
- utilisateurs mobiles qui veulent une activité immédiate et courte ;
- curieux qui ne connaissent pas les coordonnées astronomiques ;
- observateurs occasionnels sans matériel spécialisé.

Le vocabulaire doit rester concret. Préférer « regarde vers le nord-est, à deux poings au-dessus de l'horizon » à une présentation centrée sur l'azimut, l'ascension droite ou la déclinaison.

## Parcours principal

Le parcours de référence est :

```text
Découvrir ou installer l'app
          ↓
Appuyer sur « Maintenant »
          ↓
Autoriser la position
          ↓
Analyser ciel + météo
          ↓
Choisir une quête
          ↓
Ouvrir le guidage 2D
          ↓
Noter « vue » ou « non trouvée »
          ↓
Enregistrer dans le journal et la progression
```

### 1. Accès à l'application

Dans un onglet classique, la route `/` présente la vitrine de SkyQuest. En mode PWA installé (`standalone`), elle affiche le tableau de bord de l'application.

La vitrine doit expliquer la proposition de valeur, les permissions et la confidentialité avec des mots simples. Le tableau de bord doit rendre l'action **Maintenant** immédiatement visible.

### 2. Analyse « Maintenant »

La position GPS est demandée uniquement après une action explicite. Une fois obtenue, SkyQuest :

1. récupère la météo actuelle auprès d'Open-Meteo ;
2. calcule la hauteur du Soleil, de la Lune et des planètes ;
3. évalue les objets du catalogue adaptés à la date et au lieu ;
4. vérifie les pluies de météores actives ;
5. ajoute éventuellement un passage de l'ISS ;
6. attribue un score de visibilité à chaque candidat ;
7. trie et sélectionne les quêtes les plus pertinentes ;
8. calcule quelques suggestions futures distinctes des cibles actuelles.

L'analyse courante est mise en cache localement. Une analyse précédente peut être affichée, mais son guidage reste verrouillé jusqu'à une nouvelle action **Maintenant** afin d'éviter de guider avec des coordonnées périmées.

### 3. Choix d'une quête

Une quête doit indiquer au minimum :

- une cible et un titre compréhensibles ;
- un score et un libellé de visibilité ;
- une direction cardinale lorsque celle-ci est pertinente ;
- une altitude approximative ;
- une courte explication ;
- un conseil d'observation ;
- le matériel conseillé ;
- un avertissement si la cible nécessite des précautions particulières.

L'interface montre d'abord un petit nombre de propositions. La quantité ne doit jamais prendre le pas sur la clarté.

### 4. Guidage

La quête choisie est stockée localement avant l'ouverture de `/quest/[id]`. La page de guidage relit cette quête ; une URL isolée sans quête active doit afficher un état d'erreur utile et un retour vers l'accueil.

Le guidage combine :

- le flux de la caméra arrière ;
- l'orientation du téléphone lorsqu'elle est disponible ;
- une projection 2D approximative de la cible ;
- des indications textuelles de rotation et d'altitude ;
- des contrôles de calibration, de zoom ou de torche selon les capacités du téléphone.

La caméra n'est pas une preuve d'observation et le repère n'est pas une AR scientifique. Les formulations doivent rester prudentes : « cherche dans cette zone », jamais « l'objet est exactement ici ».

Le parcours doit rester utilisable sans caméra ou sans orientation grâce aux directions cardinales, à l'altitude et aux conseils textuels.

### 5. Validation et journal

L'utilisateur termine une quête avec l'un des deux états :

- `seen` : cible déclarée vue ;
- `missed` : cible non trouvée.

Une photo peut être capturée ou choisie, mais elle reste facultative. L'observation est ensuite ajoutée au journal local et la progression est recalculée.

Le journal conserve au maximum les 50 observations les plus récentes. Il peut être vidé indépendamment de la progression. La progression peut également être réinitialisée sans effacer le journal.

## Types de quêtes

Les types de cibles actuels sont :

- Lune ;
- planètes : Vénus, Jupiter, Saturne et Mars ;
- étoiles accessibles ;
- astérismes ;
- constellations ;
- amas d'étoiles ;
- galaxies accessibles ;
- pluies de météores ;
- ISS ;
- observation libre de secours.

Les objets ne sont pas tous traités de la même manière. La Lune et les planètes viennent de calculs `astronomy-engine`. Les objets du ciel profond et les repères utilisent un catalogue de coordonnées. Les météores dépendent d'une période annuelle. L'ISS dépend d'un service externe optionnel.

## Règles de génération et de visibilité

La génération est centralisée dans `lib/quest-generator.ts` et le scoring dans `lib/visibility.ts`.

Principes à préserver :

- privilégier les candidats ayant un score d'au moins 50 ;
- ne pas présenter comme fiable une cible sous l'horizon ;
- pénaliser le jour, le crépuscule, les nuages, une faible altitude et les cibles difficiles ;
- favoriser une sélection diversifiée plutôt qu'une liste de cibles presque identiques ;
- retourner une `FreeObservation` lorsqu'aucune quête assez fiable n'existe ;
- ne jamais promettre qu'une cible sera visible ;
- continuer à retourner un résultat même si le calcul d'une famille de cibles échoue.

Les libellés de visibilité sont des indications éditoriales, pas des probabilités scientifiques :

- 80 et plus : excellente chance ;
- 60 à 79 : bonne chance ;
- 40 à 59 : tentable ;
- moins de 40 : pas conseillé.

Une modification des seuils doit être cohérente dans le scoring, les libellés, la génération et les textes d'interface.

## Comportements de secours

SkyQuest doit toujours offrir une suite utile au parcours.

| Échec                                | Comportement attendu                                                       |
| ------------------------------------ | -------------------------------------------------------------------------- |
| GPS refusé ou indisponible           | expliquer le problème et proposer une observation libre                    |
| Open-Meteo indisponible              | utiliser une météo prudente de secours et prévenir l'utilisateur           |
| CelesTrak indisponible et cache vide | omettre silencieusement les quêtes satellite                               |
| caméra indisponible                  | conserver le guidage textuel et directionnel                               |
| orientation indisponible             | afficher les repères cardinaux et d'altitude                               |
| stockage local bloqué                | garder l'expérience utilisable en mémoire pour la session lorsque possible |
| quête active absente                 | afficher une erreur actionnable et inviter à relancer « Maintenant »       |
| aucune cible fiable                  | générer une `FreeObservation`                                              |

Un échec de service externe ne doit pas provoquer un écran blanc, une exception non gérée ou bloquer les autres familles de quêtes.

## Progression

La progression sert à encourager l'observation, pas à transformer SkyQuest en jeu complexe.

Elle comprend actuellement :

- des points d'expérience ;
- des rangs ;
- les premières découvertes ;
- des accomplissements ;
- une série de nuits d'observation ;
- un historique de récompenses évitant certains doublons.

Les récompenses sont calculées localement. Le modèle doit rester explicable et stable. Une observation ratée peut être conservée dans le journal sans être présentée comme une découverte confirmée.

## Événements et suggestions futures

Le tableau de bord affiche également une chronologie à court terme :

- phases principales de la Lune ;
- éclipses calculées ;
- superlunes liées à une distance calculée ;
- pics approximatifs de pluies de météores ;
- suggestions de quêtes futures.

Il faut distinguer les horaires calculés précisément des dates ou pics approximatifs. Si une source ne fournit qu'un jour de calendrier, l'interface ne doit pas inventer une heure exacte.

## Données et confidentialité

SkyQuest n'utilise ni compte ni authentification. Le journal, la progression et les préférences
restent locaux. Une table Supabase optionnelle conserve uniquement les subscriptions Web Push ;
elle ne constitue pas un profil utilisateur.

### Données locales

Le navigateur peut conserver :

- la quête active ;
- la dernière position arrondie ;
- l'analyse du ciel mise en cache ;
- les observations du journal ;
- la progression ;
- les préférences de mode nuit et de retours haptiques ;
- les préférences de thèmes de notification ;
- l'état de l'onboarding ;
- le délai entre deux ouvertures publicitaires.

Les positions persistées sont arrondies à deux décimales. Ne pas introduire de stockage durable de coordonnées plus précises sans décision produit explicite.

### Photos

Les photos sont redimensionnées côté navigateur puis enregistrées dans `localStorage` sous forme de Data URL. Elles ne doivent pas être téléversées, analysées ou envoyées à un tiers. La caméra doit être arrêtée dès que le composant de guidage est démonté.

### Services externes

- Open-Meteo reçoit les coordonnées nécessaires à la météo depuis le navigateur.
- CelesTrak fournit seulement les éléments orbitaux publics de l'ISS, des satellites brillants et des lancements Starlink récents, mis en cache deux heures. La position reste dans les routes SkyQuest pour le calcul SGP4 et n'est pas transmise au fournisseur.
- Le flux **Maintenant** peut ouvrir une page publicitaire externe après consentement explicite. Un délai local de dix minutes limite les ouvertures répétées.

Toute nouvelle intégration externe doit être documentée avec les données transmises, le moment de l'appel et son comportement en cas d'échec.

## Permissions navigateur

Les permissions doivent être demandées au moment où leur utilité est évidente :

- géolocalisation après un clic sur **Maintenant** ;
- caméra après le démarrage du guidage ;
- orientation après une action explicite lorsque Safari/iOS l'exige ;
- notifications après un appui explicite sur **Activer les alertes** dans le Profil ;
- aucune permission en arrière-plan.

GPS, caméra, orientation et installation PWA nécessitent un contexte sécurisé. `localhost` convient au développement sur ordinateur ; les essais sur téléphone doivent utiliser HTTPS.

Le middleware définit une politique de sécurité comprenant CSP, Permissions Policy, protection contre l'intégration en iframe et HSTS en production. Toute nouvelle ressource distante doit être ajoutée à la CSP de manière ciblée.

## PWA et fonctionnement hors ligne

Le service worker est enregistré uniquement en production. Sa stratégie actuelle est `network-first` avec retour vers un petit cache applicatif.

Le mode hors ligne reste volontairement limité :

- la coquille et quelques routes peuvent être relues depuis le cache ;
- une ancienne analyse locale peut rester visible ;
- une nouvelle météo ou un nouveau passage ISS nécessite le réseau ;
- le cache ne doit pas être présenté comme une garantie de fonctionnement complet hors ligne.

Le numéro de cache du service worker doit changer lors d'une évolution incompatible des ressources mises en cache.

## Architecture technique

### Routes

| Route                   | Responsabilité                                                    |
| ----------------------- | ----------------------------------------------------------------- |
| `/`                     | vitrine dans le navigateur, tableau de bord dans la PWA installée |
| `/quest/[id]`           | guidage de la quête active stockée localement                     |
| `/journal`              | historique local et suppression du journal                        |
| `/explore`              | catalogue pédagogique des objets                                  |
| `/profile`              | progression locale et réglages d’alertes optionnelles             |
| `/api/iss-pass`         | calcul serveur du passage ISS à partir des GP CelesTrak           |
| `/api/satellite-passes` | satellites brillants et trains Starlink récents                   |

### Modules principaux

| Fichier ou dossier           | Responsabilité                                                   |
| ---------------------------- | ---------------------------------------------------------------- |
| `components/dashboard/`      | orchestration de l'analyse et affichage du tableau de bord       |
| `components/CameraGuide.tsx` | caméra, permissions, calibration et validation d'une observation |
| `components/SkyOverlay.tsx`  | représentation 2D de la cible et des figures                     |
| `lib/astro.ts`               | positions de la Lune, des planètes et du Soleil                  |
| `lib/quest-generator.ts`     | création, filtrage et diversité des quêtes                       |
| `lib/visibility.ts`          | calcul et libellé des scores                                     |
| `lib/orientation.ts`         | normalisation des capteurs et indications directionnelles        |
| `lib/sky-projection.ts`      | projection mathématique dans le cadre caméra                     |
| `lib/sky-catalog.ts`         | catalogue éditorial et coordonnées J2000                         |
| `lib/celestial-events.ts`    | événements astronomiques à venir                                 |
| `lib/progression.ts`         | XP, rangs, séries et accomplissements                            |
| `lib/storage.ts`             | persistance locale et validation des données relues              |
| `lib/types.ts`               | contrats de domaine partagés                                     |

### Principes de code

- conserver les calculs sous forme de fonctions pures dans `lib` lorsque possible ;
- limiter les Client Components aux API navigateur et à l'interactivité ;
- typer explicitement les objets métier ;
- traiter les erreurs comme des états d'interface ;
- éviter les dépendances qui ne réduisent pas clairement la complexité ;
- recalculer les informations dépendantes du temps au lieu de faire confiance à des données anciennes ;
- ne pas mélanger le catalogue éditorial, les calculs astronomiques et la présentation ;
- arrêter proprement les abonnements, timers, capteurs et flux média.

## Design et contenu

L'expérience doit ressembler à un compagnon nocturne calme, pas à un cockpit scientifique.

### Direction visuelle

- fond spatial sombre ;
- accents bleu, violet et cyan ;
- glassmorphism léger ;
- grandes zones tactiles ;
- contraste élevé pour une utilisation dehors ;
- mise en page mobile-first ;
- animations discrètes respectant `prefers-reduced-motion`.

### Ton rédactionnel

- phrases courtes ;
- tutoiement cohérent ;
- conseils concrets ;
- prudence sur la visibilité et la précision ;
- pas de jargon sans explication ;
- pas de longs blocs de texte dans le parcours principal.

Exemples :

- bon : « Cherche un point très lumineux vers le sud-ouest. »
- bon : « Les nuages peuvent gêner, mais la tentative reste possible. »
- à éviter : « Vénus sera certainement visible à cet emplacement exact. »
- à éviter : afficher des coordonnées techniques sans traduction pratique.

## Qualité et validation

Avant de considérer une modification terminée :

```bash
npm run format
npm run format:check
npm run lint
npm test
npm run build
```

Les tests existants couvrent les conversions astronomiques, les événements célestes et la projection caméra. Les évolutions du scoring, de la progression et du stockage devraient être accompagnées de tests unitaires ciblés.

Pour les changements d'interface, vérifier au minimum :

- mobile compact autour de 360 px ;
- mobile courant autour de 390 à 430 px ;
- tablette ;
- bureau ;
- navigation au clavier ;
- réduction des animations ;
- états sans permission et sans réseau ;
- absence de débordement horizontal.

Les essais réels de caméra et d'orientation doivent être effectués sur mobile en HTTPS. Les simulateurs de navigateur ne reproduisent pas toujours les conventions de capteurs d'iOS et d'Android.

## Hors périmètre actuel

Ne pas introduire sans décision produit explicite :

- compte utilisateur ;
- backend ou base de données obligatoire ;
- synchronisation multi-appareil ;
- paiement ;
- vraie AR 3D ou WebXR obligatoire ;
- reconnaissance automatique des photos ;
- carte du ciel complète ;
- collecte analytique invasive ;
- stockage distant des positions ou des photos.

## Évolutions envisagées

La feuille de route générale prévoit :

- v0.2 : meilleure pertinence des alertes et amélioration du crépuscule ;
- v0.3 : sauvegarde multi-appareil et compte optionnel ;
- v0.4 : module AR 3D ou intégration native si les limites de la PWA le justifient.

Ces éléments décrivent une direction, pas des fonctionnalités déjà disponibles. Une évolution future doit préserver le mode simple et local aussi longtemps que possible.

## Repères pour prendre une décision

Avant d'ajouter une fonctionnalité, se poser ces questions :

1. Aide-t-elle réellement un débutant à observer quelque chose ?
2. Simplifie-t-elle le parcours principal ou ajoute-t-elle une distraction ?
3. Fonctionne-t-elle avec des permissions refusées ou un service indisponible ?
4. Introduit-elle une nouvelle donnée sensible ou un service externe ?
5. Peut-elle rester locale et sans compte ?
6. Ses indications sont-elles honnêtes sur leur précision ?
7. Est-elle testable sur un vrai téléphone en HTTPS ?

Si la réponse à la première question est non, la fonctionnalité appartient probablement à un autre produit. SkyQuest doit rester une invitation claire à lever les yeux.
