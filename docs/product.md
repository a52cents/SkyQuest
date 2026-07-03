# Produit

## Mission

SkyQuest aide une personne débutante à répondre à une question immédiate : « Que puis-je essayer d'observer dans le ciel maintenant ? »

L'application utilise le lieu, l'heure, la météo et des calculs astronomiques pour transformer le ciel en quelques quêtes courtes. Elle privilégie l'action et les explications concrètes plutôt que l'exhaustivité scientifique.

## Public

- débutants sans connaissances astronomiques ;
- curieux utilisant principalement leur téléphone ;
- observateurs occasionnels, souvent sans matériel ;
- personnes qui veulent une activité guidée de quelques minutes.

## Parcours principal

```text
Maintenant → conditions du ciel → quête → guidage 2D → résultat → journal
```

1. L'utilisateur appuie sur **Maintenant**.
2. SkyQuest demande la position, récupère la météo et estime la qualité du ciel.
3. L'application calcule et classe les cibles possibles.
4. Elle affiche les quêtes fiables dans un ordre de priorité compréhensible.
5. L'utilisateur ouvre le guidage d'une quête.
6. Il note la cible comme vue ou non trouvée.
7. Le journal et la progression sont mis à jour localement.

## Promesse produit

- toujours fournir une réponse ou une alternative utile ;
- expliquer quoi faire sans jargon inutile ;
- ne jamais garantir qu'une cible sera visible ;
- demander les permissions au moment où elles deviennent utiles ;
- fonctionner sans compte et conserver les données localement ;
- proposer `FreeObservation` si aucune cible n'est assez fiable.

## Contenu d'une quête

Une quête comporte une cible, un titre, une difficulté, un score de visibilité, une direction, une altitude approximative, un conseil et le matériel recommandé. Certaines cibles peuvent aussi fournir un avertissement ou un horaire conseillé.

Les principales familles sont la Lune, les planètes, les étoiles, les constellations, les astérismes, les amas, les galaxies accessibles, les météores et l'ISS.

La qualité du ciel est présentée comme une estimation. La pollution lumineuse pénalise surtout les
galaxies, amas et météores ; elle ne doit pas masquer une planète ou la Lune lorsque les autres
conditions sont bonnes.

## Ce que SkyQuest n'est pas

- une carte du ciel complète ;
- un logiciel professionnel d'astronomie ;
- une garantie d'observation ;
- une vraie application de réalité augmentée 3D ;
- un réseau social ou un service de stockage de photos.

## Principes de décision

Une fonctionnalité doit aider directement un débutant à observer le ciel. Si elle augmente la densité d'information, exige un compte ou détourne l'attention du parcours principal sans bénéfice clair, elle n'appartient probablement pas au MVP.

Voir aussi [`../PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md) pour le contexte complet et [`roadmap.md`](./roadmap.md) pour les évolutions envisagées.
