# Notifications push PWA avec Supabase

SkyQuest utilise le Service Worker, la Push API, des clés VAPID et une table Postgres Supabase.
La permission n’est jamais demandée au chargement : seul le bouton **Activer les alertes** lance la
demande du navigateur.

Le précédent store mémoire a été remplacé parce qu’une fonction Vercel peut redémarrer à tout
moment et que plusieurs instances ne partagent pas leur mémoire. Les subscriptions sont désormais
persistantes et dédupliquées par leur `endpoint` unique.

## 1. Préparer Supabase

1. Ouvrir le projet Supabase puis **SQL Editor**.
2. Copier et exécuter tout le fichier [`supabase-push-subscriptions.sql`](./supabase-push-subscriptions.sql).
3. Dans **Project Settings → API Keys**, récupérer l’URL du projet, la clé publique/anon et la clé
   `service_role`.

La table a la RLS activée et aucune policy `anon` ou `authenticated`. C’est volontaire : le client
web ne lit et n’écrit jamais `push_subscriptions`. Toutes les opérations passent par les routes
Next.js avec la clé `service_role`, strictement serveur. La fonction SQL
`claim_push_notification_slot` réserve atomiquement la fenêtre de 24 heures afin que deux crons
concurrents ne puissent pas envoyer deux alertes.

Les topics SQL utilisent les identifiants réels du code : `clear_sky_evening`, `moon_visible`,
`planet_visible`, `celestial_event` et `daily_mission`.

## 2. Générer les clés VAPID

```bash
npx web-push generate-vapid-keys
```

La clé publique et la clé privée doivent venir de la même paire. Ne jamais publier la clé privée.
Après un changement de paire, les anciennes subscriptions navigateur doivent être recréées.

## 3. Variables d’environnement locales

Copier `.env.example` vers `.env.local` et renseigner :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-publique-ou-anon
SUPABASE_SERVICE_ROLE_KEY=votre-cle-service-role

NEXT_PUBLIC_VAPID_PUBLIC_KEY=votre-cle-vapid-publique
VAPID_PRIVATE_KEY=votre-cle-vapid-privee
VAPID_SUBJECT=mailto:contact@skyquest.app

CRON_SECRET=une-valeur-aleatoire-d-au-moins-16-caracteres
PUSH_TEST_SECRET=une-autre-valeur-aleatoire
```

Variables publiques :

- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` peuvent être intégrées au bundle
  client. SkyQuest n’utilise actuellement pas la clé anon pour les subscriptions ; elle est
  renseignée pour la configuration générale du projet.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` doit être publique pour créer une subscription Push API.

Secrets strictement serveur :

- `SUPABASE_SERVICE_ROLE_KEY` ;
- `VAPID_PRIVATE_KEY` ;
- `CRON_SECRET` ;
- `PUSH_TEST_SECRET`.

Ne jamais ajouter `NEXT_PUBLIC_` à un secret et ne jamais les placer dans un composant client.

## 4. Tester localement

Vérifier d’abord le projet :

```bash
npm install
npm run build
npm run start
```

`localhost` est considéré comme un contexte sécurisé par les navigateurs de bureau. Pour le bouton
de test visible dans l’interface, `npm run dev` est plus pratique. Pour tester le build de
production, appeler la route protégée avec l’endpoint stocké dans Supabase :

```bash
curl -X POST http://localhost:3000/api/push/test \
  -H "Authorization: Bearer $PUSH_TEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"ENDPOINT_COPIE_DEPUIS_SUPABASE"}'
```

Parcours local :

1. Ouvrir SkyQuest sans cliquer et confirmer qu’aucune permission n’est demandée.
2. Cliquer sur **Activer les alertes** et accepter la permission.
3. Dans Supabase **Table Editor**, ouvrir `push_subscriptions` et vérifier la nouvelle ligne.
4. Confirmer que les coordonnées ont un seul chiffre après la virgule.
5. Modifier une préférence et vérifier que la même ligne est mise à jour, sans doublon d’endpoint.
6. Envoyer une notification de test et vérifier le clic vers SkyQuest.
7. Désactiver les alertes et vérifier que `enabled` passe à `false`.

La route test est libre uniquement en développement. En production, elle exige toujours
`Authorization: Bearer <PUSH_TEST_SECRET>`. Elle respecte également la limite globale de 24 heures
et répond `429` si une notification a déjà été réservée pour cet abonnement.

## 5. Déployer sur Vercel

Dans **Project Settings → Environment Variables**, ajouter toutes les variables de la section 3 aux
environnements concernés, puis redéployer. Les secrets ne doivent pas être cochés comme exposés au
navigateur.

`vercel.json` appelle `/api/cron/sky-alerts` une fois par jour à `17:00 UTC`. Cela correspond à
`18:00` en France métropolitaine l’hiver et `19:00` l’été, donc à la fenêtre locale 17 h–23 h déjà
contrôlée par le code. Cette fréquence est compatible avec le plan Vercel Hobby et convient au MVP
France.

Vercel envoie automatiquement `Authorization: Bearer <CRON_SECRET>` lorsque la variable
`CRON_SECRET` existe dans le projet ; l’endpoint reste donc privé. Une future prise en charge
mondiale des fuseaux nécessitera un cron horaire sur un plan Pro, ou un ordonnanceur externe capable
d’envoyer le même header `Authorization`.

Test de production :

1. Ouvrir le domaine HTTPS déployé et installer la PWA.
2. Activer les alertes après une action explicite.
3. Vérifier la row dans Supabase et l’absence de doublon après une nouvelle activation.
4. Appeler `/api/push/test` avec son Bearer token depuis un terminal sécurisé.
5. Vérifier les exécutions dans **Vercel → Cron Jobs** et les réponses JSON de la fonction.
6. Confirmer qu’une subscription désactivée ne reçoit rien.
7. Pour simuler un endpoint expiré, supprimer la subscription dans le navigateur puis lancer un
   envoi : une réponse fournisseur 404/410 doit faire passer `enabled` à `false`.

## 6. iPhone et iPad

Le Web Push nécessite iOS/iPadOS 16.4 ou plus récent et SkyQuest doit être ajoutée à l’écran
d’accueil. Safari ouvert comme simple onglet ne suffit pas.

1. Ouvrir le domaine HTTPS dans Safari.
2. Choisir **Partager → Sur l’écran d’accueil**.
3. Lancer SkyQuest depuis son icône.
4. Cliquer sur **Activer les alertes** et accepter.
5. Fermer la PWA, envoyer une notification de test et vérifier son ouverture au toucher.

Tester aussi le refus de permission : SkyQuest doit rester utilisable et expliquer comment modifier
le réglage, sans redemander automatiquement la permission.

## 7. Endpoints et garanties

- `POST /api/push/subscribe` valide puis fait un upsert Supabase sur `endpoint` ;
- `POST /api/push/unsubscribe` désactive la row de façon idempotente ;
- `POST /api/push/test` relit une subscription Supabase active et est protégé en production ;
- `GET /api/cron/sky-alerts` lit seulement les rows actives et exige `CRON_SECRET` ;
- une réponse Web Push 404/410 désactive la subscription expirée ;
- les coordonnées sont réarrondies à `0.1°` côté route et côté store ;
- la fonction SQL atomique limite chaque subscription à une notification par période de 24 heures.

## Checklist complète

1. Créer le projet Supabase.
2. Exécuter le SQL dans Supabase SQL Editor.
3. Copier les variables Supabase dans `.env.local`.
4. Générer les clés VAPID.
5. Ajouter les clés VAPID dans `.env.local`.
6. Lancer `npm run build` puis `npm run start`.
7. Activer les alertes depuis l’UI.
8. Vérifier la ligne dans `push_subscriptions`.
9. Envoyer une notification de test.
10. Déployer sur Vercel.
11. Ajouter les mêmes variables dans Vercel.
12. Tester sur le domaine HTTPS.
13. Tester sur une PWA iPhone installée.
