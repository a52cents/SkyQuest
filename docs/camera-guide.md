# Camera Guide

## Objectif

Aider l'utilisateur à viser approximativement la zone où chercher un objet céleste, sans lui demander de comprendre des coordonnées astronomiques.

Le guidage traduit l'azimut et l'altitude d'une quête en repère visuel, indications directionnelles et conseils textuels. Il doit rester utile même lorsque certains capteurs sont absents ou imprécis.

## Ce que ce n'est pas

- une vraie réalité augmentée 3D ;
- une reconnaissance d'image ;
- une preuve que la cible est visible ou trouvée ;
- une carte du ciel complète ;
- un instrument de pointage scientifique précis.

Les textes doivent parler de « zone », de « repère approximatif » ou de « direction », jamais d'une position certaine.

## Sources utilisées

- caméra arrière via `navigator.mediaDevices.getUserMedia` ;
- orientation via `AbsoluteOrientationSensor` lorsqu'il est disponible ;
- fallback via `DeviceOrientationEvent` et `deviceorientationabsolute` ;
- `webkitCompassHeading` lorsque Safari le fournit ;
- azimut et altitude de la quête ;
- position de l'observateur pour recalculer une cible pendant la session ;
- projection 2D de `lib/sky-projection.ts` ;
- figures de constellations issues du catalogue lorsque la cible le permet.

## Démarrage

Les permissions sont demandées uniquement après l'action explicite de démarrage :

1. demander l'orientation, directement dans le geste utilisateur pour rester compatible iOS ;
2. demander la caméra avec une préférence pour l'objectif arrière ;
3. ouvrir le guidage si au moins une des deux sources fonctionne ;
4. conserver les indications textuelles dans tous les cas.

Ne pas déplacer ces demandes au montage du composant ou dans un effet automatique.

## Projection

`useDeviceOrientation` lisse les lectures des capteurs. `orientation.ts` les convertit en azimut et altitude caméra. `sky-projection.ts` projette ensuite le vecteur cible dans la vidéo en tenant compte :

- de l'orientation portrait ou paysage ;
- du roll de l'appareil ;
- du recadrage vidéo `object-fit: cover` ;
- du zoom réel ou simulé ;
- des offsets de calibration ;
- de la position devant ou derrière la caméra.

L'overlay complet n'est activé que si la caméra, l'orientation, la position et un niveau de confiance suffisant sont disponibles.

## Fallbacks

| Situation                 | Comportement attendu                                          |
| ------------------------- | ------------------------------------------------------------- |
| caméra refusée ou absente | afficher fond, direction, altitude et conseils texte          |
| orientation refusée       | afficher direction cardinale et hauteur cible                 |
| orientation imprécise     | prévenir l'utilisateur et privilégier les indications texte   |
| position absente          | conserver les coordonnées enregistrées dans la quête          |
| overlay non supporté      | masquer l'overlay sans bloquer le guidage                     |
| zoom non supporté         | masquer le slider de zoom                                     |
| torche non supportée      | masquer ou désactiver le contrôle correspondant               |
| capture impossible        | proposer de choisir une image ou d'enregistrer sans photo     |
| stockage local bloqué     | ne rien créditer, expliquer l'échec et permettre de réessayer |

## Validation d'une quête

L'utilisateur peut déclarer la cible trouvée ou non trouvée. SkyQuest ne vérifie pas automatiquement cette déclaration.

Lorsqu'une cible est déclarée trouvée :

- une capture de la vidéo peut être proposée ;
- une image existante peut être choisie ;
- l'utilisateur peut continuer sans photo ;
- l'image est redimensionnée en photo et miniature avant stockage local.

Les photos ne doivent jamais être envoyées à un serveur ou analysées automatiquement.

## Cycle de vie et sécurité

- conserver le `MediaStream` dans une référence ;
- arrêter toutes les pistes au démontage ;
- arrêter les listeners et capteurs d'orientation au démontage ;
- ne pas conserver de flux caméra en arrière-plan ;
- traiter les erreurs de permissions comme des états UI ;
- ne pas ajouter une ressource distante sans mettre à jour la CSP de façon ciblée.

## Fichiers clés

| Fichier                         | Rôle                                        |
| ------------------------------- | ------------------------------------------- |
| `components/CameraGuide.tsx`    | orchestration du guidage et des permissions |
| `components/SkyOverlay.tsx`     | rendu du repère et des figures              |
| `hooks/useDeviceOrientation.ts` | lecture et lissage des capteurs             |
| `lib/orientation.ts`            | conventions d'axes et hints textuels        |
| `lib/sky-projection.ts`         | projection mathématique pure                |
| `lib/constellation-figures.ts`  | segments de figures célestes                |

## Validation manuelle

Tester sur un vrai téléphone en HTTPS : refus et acceptation de chaque permission, rotation écran, passage du nord 359°/0°, cible derrière la caméra, zoom absent, capture facultative et sortie du guidage. Vérifier que l'indicateur reste prudent lorsque la boussole dérive.
