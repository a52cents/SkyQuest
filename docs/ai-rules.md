# Règles pour les agents IA

## Documents à lire

Avant une modification importante :

1. [`../AGENTS.md`](../AGENTS.md) pour les règles obligatoires ;
2. [`../PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md) pour la vision globale ;
3. le document spécialisé de ce dossier ;
4. [`../UI_SOURCE_OF_TRUTH.md`](../UI_SOURCE_OF_TRUTH.md) pour tout changement visuel.

En cas de contradiction, `AGENTS.md` prévaut pour le produit et la technique. `UI_SOURCE_OF_TRUTH.md` définit la hiérarchie des références UI.

## Avant de coder

- inspecter le flux existant et les types partagés ;
- rechercher les usages avant de renommer ou supprimer ;
- préserver les modifications locales sans rapport avec la tâche ;
- vérifier si le besoin appartient au MVP ;
- identifier les permissions, données sensibles et services externes concernés.

## Invariants produit

- toujours fournir un fallback utile ;
- classer les quêtes par pertinence et garder leur présentation facile à parcourir ;
- utiliser `FreeObservation` si aucune cible n'est fiable ;
- ne jamais promettre une observation certaine ;
- ne pas transformer l'app en carte du ciel complète ;
- garder le parcours principal court et compréhensible.

## Invariants techniques

- conserver TypeScript strict ;
- favoriser les fonctions pures dans `lib/` ;
- réserver les Client Components aux API navigateur et à l'interactivité ;
- traiter les erreurs par des états UI ;
- éviter les nouvelles dépendances sans bénéfice net ;
- arrêter capteurs, timers et pistes média au démontage ;
- garder les coordonnées astronomiques, unités et conventions explicitement documentées.

## Confidentialité et permissions

- ne pas demander GPS, caméra ou orientation au chargement ;
- ne jamais envoyer les photos à un serveur ;
- arrondir une position avant stockage local ;
- documenter toute nouvelle API et les données qu'elle reçoit ;
- ne pas ajouter de compte, tracking ou stockage distant sans décision produit explicite.

## Interface

- réutiliser `AppButton` et `AppCard` avant de créer un équivalent ;
- suivre les tokens de `app/globals.css` ;
- rester dark, calme et lisible dehors la nuit ;
- ne pas introduire de beige, crème, rose, pêche ou orange comme ambiance ;
- respecter `prefers-reduced-motion` et les tailles tactiles mobiles.

## Fin de tâche

Exécuter selon le risque :

```bash
npm run format
npm run format:check
npm run lint
npm test
npm run build
```

Signaler clairement ce qui a changé, les validations effectuées et toute limite non testable localement.
