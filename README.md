# SkyQuest

SkyQuest est une PWA mobile-first qui transforme le ciel visible en quêtes d'observation courtes et accessibles. À partir de la position, de l'heure, de la météo et de calculs astronomiques locaux, l'application suggère quoi regarder maintenant puis accompagne l'utilisateur avec un guidage caméra 2D prudent.

Le projet privilégie un parcours simple — **Maintenant → quoi regarder → guidage → journal** — plutôt qu'une carte du ciel scientifique complète.

## Fonctionnalités

- génération de quêtes selon la position GPS, l'heure et la couverture nuageuse ;
- calcul local de la Lune, du Soleil et des planètes avec `astronomy-engine` ;
- catalogue de repères accessibles : étoiles, constellations, astérismes, Pléiades et Andromède ;
- pluies de météores, événements célestes à venir et passages visibles de l'ISS en option ;
- score de visibilité et sélection prioritaire des cibles ayant un score d'au moins 50 ;
- observation libre de secours lorsque les données ou les conditions sont insuffisantes ;
- guidage caméra 2D avec orientation, indications directionnelles et mode dégradé ;
- capture facultative d'une photo, conservée uniquement dans le navigateur ;
- journal, XP, rangs, séries et accomplissements stockés localement ;
- mode nuit, retours haptiques, onboarding et prise en compte de la réduction des animations ;
- manifest PWA et cache hors ligne simple de la coquille applicative.

La racine `/` affiche la page de présentation dans un navigateur classique et le tableau de bord lorsque l'application est lancée en mode installé (`standalone`).

## Stack

- Next.js 15 avec App Router
- React 19 et TypeScript strict
- Tailwind CSS 4
- Framer Motion
- `astronomy-engine`
- Open-Meteo
- API N2YO facultative pour l'ISS
- `localStorage` pour les données utilisateur

Il n'y a ni compte, ni base de données, ni authentification. La seule route serveur métier est le proxy optionnel utilisé pour interroger N2YO sans exposer sa clé API.

## Installation

Prérequis : Node.js 22 recommandé et npm.

```bash
git clone https://github.com/a52cents/SkyQuest.git
cd SkyQuest
npm install
```

Créez éventuellement un fichier `.env.local` pour activer les quêtes ISS :

```dotenv
N2YO_API_KEY=votre_cle_n2yo
```

Sans cette variable, l'application continue normalement et omet simplement les passages ISS.

Lancez le serveur de développement :

```bash
npm run dev
```

Puis ouvrez [http://localhost:3000](http://localhost:3000).

Pour tester le GPS, la caméra et l'orientation depuis un téléphone sur le réseau local, utilisez le serveur HTTPS :

```bash
npm run dev:https
```

Le certificat de développement est auto-signé. Le navigateur peut demander une validation manuelle avant d'autoriser les API sensibles.

## Commandes

| Commande               | Rôle                                                    |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | démarre Next.js en développement                        |
| `npm run dev:https`    | démarre le serveur HTTPS accessible sur le réseau local |
| `npm run build`        | crée la version de production                           |
| `npm run start`        | sert la version de production                           |
| `npm run lint`         | lance ESLint                                            |
| `npm run format`       | reformate les fichiers avec Prettier                    |
| `npm run format:check` | vérifie le formatage sans modifier les fichiers         |
| `npm test`             | exécute les tests Node                                  |

## Parcours utilisateur

1. L'utilisateur installe ou ajoute SkyQuest à son écran d'accueil.
2. Il appuie sur **Maintenant** pour demander sa position.
3. SkyQuest récupère la météo, calcule les objets visibles et classe les quêtes.
4. Une quête est enregistrée localement avant l'ouverture de son guidage.
5. La caméra et l'orientation ne sont demandées qu'au démarrage du guidage.
6. L'utilisateur note la cible comme vue ou non trouvée, avec une photo facultative.
7. L'observation alimente le journal et la progression locale.

Les échecs de géolocalisation, météo, caméra ou orientation sont traités par des états dégradés. Une observation libre reste disponible si aucune quête fiable ne peut être produite.

## Architecture

```text
app/
├── page.tsx                 # vitrine web ou tableau de bord PWA
├── quest/[id]/page.tsx      # guidage de la quête active
├── journal/page.tsx         # observations locales
├── explore/page.tsx         # catalogue du ciel
├── profile/page.tsx         # progression locale
└── api/iss-pass/route.ts    # proxy N2YO optionnel
components/
├── dashboard/               # écran principal installé
├── marketing/               # page de présentation
└── CameraGuide.tsx          # caméra, orientation et guidage 2D
hooks/                       # capteurs, installation et haptique
lib/
├── astro.ts                 # positions astronomiques
├── weather.ts               # météo Open-Meteo
├── visibility.ts            # scores de visibilité
├── quest-generator.ts       # sélection des quêtes
├── orientation.ts           # boussole et altitude du téléphone
├── sky-projection.ts        # projection de la cible sur la caméra
├── storage.ts               # journal, quête et progression
└── types.ts                 # types de domaine partagés
public/
├── manifest.webmanifest
└── sw.js                    # service worker minimal
```

Les fonctions de calcul sont regroupées dans `lib/`. Les composants client sont réservés aux interactions et aux API du navigateur.

## Documentation

- [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) : vue d'ensemble du projet ;
- [`docs/product.md`](./docs/product.md) : mission et parcours produit ;
- [`docs/architecture.md`](./docs/architecture.md) : routes, modules et flux de données ;
- [`docs/ai-rules.md`](./docs/ai-rules.md) : repères de contribution pour les agents IA ;
- [`docs/camera-guide.md`](./docs/camera-guide.md) : fonctionnement et fallbacks du guidage ;
- [`docs/pwa-ios-limitations.md`](./docs/pwa-ios-limitations.md) : contraintes PWA, Safari et iOS ;
- [`docs/design-principles.md`](./docs/design-principles.md) : principes d'interface ;
- [`docs/roadmap.md`](./docs/roadmap.md) : évolutions envisagées.

## Données, permissions et services externes

- **Position** : demandée après action sur **Maintenant**. La dernière position et l'analyse mise en cache sont arrondies à deux décimales avant stockage local.
- **Météo** : les coordonnées sont envoyées directement depuis le navigateur à Open-Meteo.
- **ISS** : si `N2YO_API_KEY` est définie, les coordonnées transitent par `/api/iss-pass` puis sont envoyées à N2YO.
- **Caméra et orientation** : demandées au lancement du guidage. Les pistes caméra sont arrêtées au démontage du composant.
- **Photos** : redimensionnées et stockées sous forme de données locales ; elles ne sont ni analysées ni téléversées par SkyQuest.
- **Journal et progression** : conservés dans `localStorage`, limités aux 50 observations les plus récentes et effaçables depuis l'interface.
- **Publicité** : après consentement explicite, l'analyse peut ouvrir une page publicitaire externe. Un délai de dix minutes est mémorisé localement entre deux ouvertures.

En production, servez obligatoirement l'application en HTTPS pour rendre disponibles la géolocalisation, la caméra, les capteurs d'orientation et l'installation PWA.

## PWA et hors ligne

Le service worker est enregistré uniquement en production. Il met en cache une coquille minimale (`/`, `/journal`, le manifest et l'icône SVG) et utilise le réseau en priorité. Les nouvelles analyses nécessitent toujours un accès réseau pour Open-Meteo et, le cas échéant, N2YO.

## Tests

La suite actuelle couvre notamment :

- la conversion des coordonnées équatoriales J2000 vers l'horizon local ;
- l'ordre et la cohérence des événements célestes ;
- la projection caméra, le lissage au passage du nord, le zoom et la calibration.

Avant une contribution :

```bash
npm test
npm run lint
npm run format:check
npm run build
```

## Limites actuelles

- le guidage caméra est une aide 2D approximative, pas une réalité augmentée certifiée ;
- une visibilité calculée reste une estimation et ne garantit jamais l'observation ;
- le fonctionnement hors ligne est limité aux ressources déjà mises en cache ;
- les données sont propres au navigateur et ne sont pas synchronisées entre appareils ;
- aucune reconnaissance automatique de photo, notification push ou carte du ciel complète n'est incluse.

## Design

La hiérarchie des références UI est définie dans [`UI_SOURCE_OF_TRUTH.md`](./UI_SOURCE_OF_TRUTH.md). L'intention visuelle reste décrite dans [`DESIGN.md`](./DESIGN.md) : ambiance nocturne premium, accents bleu-violet, contraste élevé, contrôles généreux et contenu adapté aux débutants.

## Licence

Aucune licence n'est actuellement déclarée dans ce dépôt.
