# PWA et limites iOS

## Contexte

SkyQuest utilise des API sensibles et variables selon les navigateurs : géolocalisation, caméra, orientation, installation PWA et service worker. Les essais sur ordinateur ne suffisent pas pour valider le comportement iPhone ou iPad.

Ce document décrit les contraintes prises en compte par le projet. Les comportements de Safari pouvant évoluer, vérifier sur les versions d'iOS réellement supportées avant une livraison.

## Installation

L'application détecte le mode installé avec les media queries `display-mode` et `navigator.standalone` pour les anciens comportements iOS.

Le hook d'installation écoute `beforeinstallprompt`, mais ce mécanisme n'est pas disponible de manière uniforme sur iOS. L'interface doit donc pouvoir expliquer l'ajout manuel à l'écran d'accueil sans dépendre exclusivement d'un prompt natif.

La route `/` affiche actuellement la vitrine dans un onglet classique et le dashboard en mode installé. Tester les deux contextes après toute modification de la détection.

## HTTPS

Hors `localhost`, GPS, caméra, orientation et service worker nécessitent un contexte sécurisé. Une URL HTTP ouverte depuis un téléphone ne suffit pas, même si le serveur se trouve sur le même réseau local.

Pour tester sur iOS :

- utiliser `npm run dev:https`, un tunnel HTTPS ou un déploiement ;
- accepter le certificat de développement si nécessaire ;
- vérifier `window.isSecureContext` ;
- tester dans Safari puis depuis l'icône installée.

## Orientation

Sur iOS, `DeviceOrientationEvent.requestPermission()` doit être appelé directement depuis une interaction utilisateur. `CameraGuide` déclenche donc la demande pendant l'action de démarrage du guidage.

La permission peut être refusée, absente ou retourner des lectures imprécises. Le guidage doit continuer avec la direction cardinale, l'altitude cible et les conseils textuels.

Ne pas déplacer la demande d'orientation dans un `useEffect` automatique : Safari pourrait la bloquer et l'expérience perdrait son geste d'autorisation explicite.

## Caméra

La caméra arrière est demandée avec `facingMode: "environment"`, mais le navigateur garde le choix final du périphérique et des capacités.

- zoom matériel, torche et contraintes avancées ne sont pas garantis ;
- la lecture vidéo peut nécessiter une interaction utilisateur ;
- le changement d'orientation écran peut modifier les axes du guidage ;
- les pistes doivent être arrêtées dès la sortie du composant.

Un refus caméra ne doit pas bloquer la validation d'une quête ni imposer une photo.

## Service worker et hors ligne

Le service worker n'est enregistré qu'en production. Il utilise une stratégie réseau d'abord avec un petit cache de secours. Une nouvelle météo ou un nouveau passage ISS nécessite toujours le réseau.

Ne pas présenter SkyQuest comme entièrement hors ligne. Tester les mises à jour de cache en fermant puis rouvrant la PWA installée.

## Checklist iOS

- installation et lancement depuis l'écran d'accueil ;
- demande GPS après **Maintenant** ;
- permission d'orientation depuis le bouton de guidage ;
- caméra arrière, rotation portrait/paysage et fermeture correcte du flux ;
- fallback après refus de chaque permission ;
- visibilité des contrôles avec les zones sûres de l'écran ;
- mode nuit et couleur de la barre système ;
- reprise après mise en arrière-plan ;
- comportement avec réseau lent ou coupé.
