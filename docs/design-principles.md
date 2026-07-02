# Principes de design

## Source de vérité

Suivre l'ordre défini dans [`../UI_SOURCE_OF_TRUTH.md`](../UI_SOURCE_OF_TRUTH.md) :

1. `app/globals.css` pour les tokens réellement utilisés ;
2. `DESIGN.md` pour l'intention visuelle ;
3. `AppButton.tsx` et `AppCard.tsx` pour les composants de base.

L'interface de production prévaut sur un ancien prototype ou une capture isolée.

## Ambiance

SkyQuest doit évoquer un compagnon nocturne calme : sombre, spatial, premium et accessible. L'utilisateur doit pouvoir lire l'écran dehors sans être ébloui ni submergé.

- fonds presque noirs ;
- surfaces légèrement plus claires ;
- accents violet et cyan ;
- glassmorphism discret ;
- halos modérés ;
- contraste élevé.

Ne pas introduire de beige, crème, rose, pêche ou orange comme palette d'ambiance. Le rouge est réservé au mode nuit fonctionnel et les couleurs chaudes aux états sémantiques nécessaires.

## Hiérarchie

- une action principale évidente par écran ;
- peu de texte dans le parcours principal ;
- titres lisibles et informations techniques secondaires ;
- les quêtes les plus pertinentes mises en avant, avec divulgation progressive du reste ;
- détails avancés accessibles sans encombrer le premier niveau.

## Mobile et extérieur

- conception mobile-first ;
- contrôles tactiles généreux ;
- prise en compte des zones sûres ;
- aucun débordement horizontal ;
- contrastes vérifiés en faible luminosité ;
- informations importantes compréhensibles sans survol.

## Composants

Étendre `AppButton` et `AppCard` avant d'introduire une nouvelle primitive. Une variante doit représenter un rôle réutilisable, pas corriger ponctuellement un écran.

Les états focus, pressé, désactivé, chargement, erreur et succès doivent rester perceptibles. Les couleurs seules ne doivent pas porter toute l'information.

## Mouvement

- transitions courtes et utiles ;
- pas d'animations décoratives agressives ;
- respect de `prefers-reduced-motion` ;
- éviter les mouvements continus pendant l'observation ;
- utiliser le haptique comme complément facultatif, jamais comme seul feedback.

## Ton éditorial

Tutoyer, utiliser des phrases courtes et traduire les données en gestes concrets. Dire « deux poings au-dessus de l'horizon » plutôt que d'exposer seulement une altitude en degrés.

Toujours rester prudent : « bonne chance », « tente », « cherche dans cette zone ». Ne jamais écrire qu'une observation est garantie.

## Validation

Vérifier les écrans autour de 360 px, 390–430 px, tablette et bureau, puis tester clavier, réduction des animations, mode nuit rouge et états sans permissions.
