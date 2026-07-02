# SkyQuest — Intention visuelle

SkyQuest est un compagnon nocturne mobile pour les débutants et les observateurs occasionnels. L'interface doit rendre l'astronomie accessible, calme et un peu magique, sans ressembler à un outil scientifique professionnel.

Ce document décrit l'intention. Pour savoir quel fichier fait autorité lors de l'implémentation, consulter [`UI_SOURCE_OF_TRUTH.md`](./UI_SOURCE_OF_TRUTH.md).

## Sensation recherchée

> Lève les yeux. Le ciel a une quête pour toi.

L'expérience doit être :

- sombre et immersive ;
- calme plutôt que spectaculaire ;
- premium sans devenir froide ;
- lisible dehors, la nuit ;
- rassurante pour une personne qui débute ;
- simple à parcourir avec une seule main.

## Palette actuelle

Ces couleurs reflètent les variables principales de `app/globals.css`. Le CSS reste la référence exécutable.

| Rôle              | Valeur    | Usage                          |
| ----------------- | --------- | ------------------------------ |
| Arrière-plan      | `#0a0a0b` | canevas principal presque noir |
| Surface           | `#131316` | cartes et panneaux             |
| Surface forte     | `#161619` | éléments élevés et contrastés  |
| Texte             | `#f4f4f5` | titres et contenu principal    |
| Texte secondaire  | `#a1a1aa` | descriptions et métadonnées    |
| Texte discret     | `#52525b` | informations tertiaires        |
| Accent principal  | `#7c5cff` | actions et éléments actifs     |
| Accent secondaire | `#38bdf8` | liens, repères et focus        |

Le mode nuit rouge constitue une variante fonctionnelle destinée à préserver l'adaptation visuelle dans l'obscurité. Il ne remplace pas la palette principale.

Ne pas introduire de fonds beige, crème, rose, pêche ou orange. Les couleurs chaudes sont réservées aux états sémantiques nécessaires et au mode nuit rouge.

## Typographie

- corps et interface : Inter ou police système sans serif ;
- titres éditoriaux : Georgia ou serif équivalente lorsque l'interface actuelle l'utilise ;
- tailles suffisamment grandes pour une lecture mobile en extérieur ;
- hiérarchie courte, sans accumulation de petits libellés techniques.

## Formes et profondeur

- cartes arrondies ;
- bordures fines et peu contrastées ;
- glassmorphism léger, jamais au détriment de la lisibilité ;
- ombres et halos subtils bleu-violet ;
- contrôles tactiles généreux ;
- rythme spatial aéré sur une base proche de 8 px.

## Mouvement

Les animations servent à orienter l'attention et à rendre les transitions douces. Elles ne doivent pas ralentir le parcours.

- mouvements courts et calmes ;
- pas d'effets sci-fi agressifs ;
- respect obligatoire de `prefers-reduced-motion` ;
- éviter les animations continues inutiles lors d'une observation.

## Ton des écrans

L'interface traduit les données en conseils concrets. Elle montre seulement la quantité de science nécessaire pour inspirer confiance.

Préférer :

- « Regarde vers le nord-est » ;
- « Cherche environ deux poings au-dessus de l'horizon » ;
- « Bonne chance si l'horizon est dégagé ».

Éviter :

- les tableaux de coordonnées complexes ;
- les cartes du ciel surchargées ;
- les certitudes sur une observation ;
- les longs paragraphes dans le parcours principal.

## À éviter visuellement

- esthétique de cockpit scientifique ;
- néons agressifs et surcharge cyberpunk ;
- illustrations spatiales enfantines ;
- textes minuscules ou peu contrastés ;
- multiplication des cartes génériques sans hiérarchie ;
- couleurs claires chaudes qui cassent l'ambiance nocturne ;
- reprise automatique d'un ancien export design lorsqu'il contredit l'application actuelle.

## Validation

Toute évolution importante doit être vérifiée sur mobile compact, mobile standard, tablette et bureau. La priorité reste le mobile utilisé dehors : contraste, zones tactiles, absence de débordement et compréhension immédiate.
