# UI Source of Truth

Ce document définit la hiérarchie à suivre pour toute décision d'interface dans SkyQuest.

## Ordre de priorité

La source de vérité actuelle est :

1. [`app/globals.css`](./app/globals.css) pour les variables, thèmes et styles réellement utilisés ;
2. [`DESIGN.md`](./DESIGN.md) pour l'intention visuelle et l'ambiance recherchée ;
3. [`components/AppButton.tsx`](./components/AppButton.tsx) et [`components/AppCard.tsx`](./components/AppCard.tsx) pour les composants de base et leurs variantes.

Les styles propres aux écrans et composants complètent ces références, mais ne doivent pas créer un second système visuel concurrent.

## Règle de résolution

En cas de contradiction :

- le code réellement utilisé dans `app/globals.css` prévaut sur une description ;
- l'interface de production actuelle prévaut sur un ancien prototype ou export ;
- `DESIGN.md` guide les nouvelles décisions lorsqu'aucun comportement existant ne tranche ;
- `AppButton` et `AppCard` doivent être étendus avant de recréer localement un composant équivalent.

Ne pas suivre aveuglément un ancien export design s'il contredit l'UI actuelle.

## Principes non négociables

- l'application reste sombre ;
- l'ambiance reste calme, spatiale et lisible dehors la nuit ;
- les accents principaux restent bleu-violet et cyan ;
- le contraste et la taille des contrôles priment sur les effets décoratifs ;
- le glassmorphism reste léger ;
- les animations respectent `prefers-reduced-motion` ;
- les nouveaux écrans restent cohérents avec `AppButton` et `AppCard` ;
- ne pas introduire de beige, crème, rose, pêche ou orange comme couleur d'ambiance ou de fond.

Les couleurs chaudes ne sont acceptables que pour un état sémantique précis, comme un avertissement, ou dans le mode nuit rouge déjà prévu pour l'observation.

## Palette principale

Résumé indicatif des tokens actuels :

| Token              | Valeur actuelle |
| ------------------ | --------------- |
| `--background`     | `#0a0a0b`       |
| `--surface`        | `#131316`       |
| `--surface-strong` | `#161619`       |
| `--text`           | `#f4f4f5`       |
| `--muted`          | `#a1a1aa`       |
| `--accent`         | `#7c5cff`       |
| `--accent-cyan`    | `#38bdf8`       |

Ce tableau aide à lire le système, mais ne remplace pas les déclarations de `app/globals.css`.

## Avant d'ajouter un style

1. Vérifier si une variable existe déjà dans `app/globals.css`.
2. Vérifier si `AppButton` ou `AppCard` couvre le besoin.
3. Réutiliser les conventions de l'écran le plus proche.
4. N'ajouter un nouveau token que s'il représente un rôle réutilisable.
5. Tester le résultat sur mobile, en thème principal et en mode nuit rouge.

L'objectif n'est pas de figer l'interface, mais d'éviter que plusieurs systèmes de design concurrents réapparaissent dans le dépôt.
