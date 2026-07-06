# Notifications push PWA avec Supabase

SkyQuest utilise le Service Worker, la Push API, des clés VAPID et une table Postgres Supabase.
La permission n’est jamais demandée au chargement : dans **Profil → Notifications**, seul le bouton
**Activer les alertes** lance la demande du navigateur. Le même écran affiche l’état de support,
permet de choisir les cinq thèmes existants et de désactiver la subscription.

Le précédent store mémoire a été remplacé parce qu’une fonction Vercel peut redémarrer à tout
moment et que plusieurs instances ne partagent pas leur mémoire. Les subscriptions sont désormais
persistantes et dédupliquées par leur `endpoint` unique. Cet endpoint n'est toutefois jamais une
preuve d'autorité : le navigateur génère un jeton de gestion aléatoire de 256 bits et Supabase n'en
conserve que le hash SHA-256.

## 1. Préparer Supabase

1. Ouvrir le projet Supabase puis **SQL Editor**.
2. Copier et exécuter tout le fichier [`supabase-push-subscriptions.sql`](./supabase-push-subscriptions.sql).
3. Dans **Project Settings → API Keys**, récupérer l’URL du projet, la clé publique/anon et la clé
   `service_role`.

Les tables ont la RLS activée et aucune policy `anon` ou `authenticated`. C’est volontaire : le
client web ne lit et n’écrit jamais `push_subscriptions` ni `push_notification_claims`. Toutes les
opérations passent par les routes Next.js avec la clé `service_role`, strictement serveur. La
lecture ou la modification d'un abonnement depuis le navigateur exige le jeton de gestion dans le
header `Authorization`; il n'est jamais placé dans une URL ni stocké en clair dans Supabase. La
fonction SQL `claim_push_notification_slot` verrouille atomiquement l’abonnement, applique le
cooldown éditorial de 12 heures et enregistre une clé stable dans `push_notification_claims`. Deux
crons concurrents ne peuvent donc réclamer la même occasion. Le serveur ne retient un créneau futur que si son indice
atteint 75/100 et qu’il commence dans 10 minutes au maximum ; un ciel générique doit avoir au plus
15 % de nuages.

La fonction `claim_due_sky_window_reminder` réserve et efface atomiquement le rappel « Me prévenir »
créé depuis l’écran **Plus tard**. Un rappel est donc envoyé une seule fois. Réexécuter le fichier SQL
sur une installation existante pour ajouter les colonnes `reminder_*` et cette fonction.

Si la table existait déjà, réexécuter le fichier SQL : il ajoute `management_token_hash` sans
supprimer les subscriptions. Au prochain contact, un ancien abonnement est rattaché au jeton
seulement si ses clés Web Push `p256dh` et `auth` correspondent déjà à la ligne stockée.

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

1. Ouvrir SkyQuest puis le Profil sans cliquer et confirmer qu’aucune permission n’est demandée.
2. Dans **Notifications**, cliquer sur **Activer les alertes** et accepter la permission.
3. Dans Supabase **Table Editor**, ouvrir `push_subscriptions` et vérifier la nouvelle ligne.
4. Confirmer que les coordonnées ont un seul chiffre après la virgule.
5. Modifier une préférence et vérifier que la même ligne est mise à jour, sans doublon d’endpoint.
6. Envoyer une notification de test et vérifier le clic vers SkyQuest.
7. Désactiver les alertes et vérifier que `enabled` passe à `false`.

Le bouton de l'application s'authentifie avec le jeton de gestion. Pour un test administratif par
endpoint, la production exige `Authorization: Bearer <PUSH_TEST_SECRET>`. La route utilise un
limiteur séparé d’une heure et ne consomme jamais le cooldown éditorial de 12 heures.

## 5. Déployer sur Vercel

Dans **Project Settings → Environment Variables**, ajouter toutes les variables de la section 3 aux
environnements concernés, puis redéployer. Les secrets ne doivent pas être cochés comme exposés au
navigateur.

`vercel.json` conserve un appel de secours une fois par jour à `18:00 UTC`, compatible avec Vercel
Hobby. Il ne suffit pas pour les rappels précis. Le Worker reproductible se trouve dans
[`workers/sky-alerts-cron`](../workers/sky-alerts-cron/) et utilise le Cron Trigger suivant :

```text
*/5 * * * *
```

Le passage toutes les cinq minutes permet d’envoyer les rappels intentionnels près du début du
créneau. Le code serveur vérifie lui-même l’heure locale de chaque subscription pour les alertes
éditoriales et ne les traite pas hors de la plage 19 h–3 h 59.

Configurer `SKYQUEST_URL`, puis ajouter `CRON_SECRET` comme secret chiffré Cloudflare avec exactement
la même valeur que dans Vercel. Les commandes vérifiables figurent dans le README du Worker. Le
déclencheur Vercel quotidien peut rester comme secours : les claims SQL et le cooldown de 12 heures
empêchent un double envoi s’il chevauche Cloudflare.

Vercel envoie automatiquement `Authorization: Bearer <CRON_SECRET>` lorsque la variable
`CRON_SECRET` existe dans le projet ; l’endpoint reste donc privé.

Le plan Vercel Hobby ne peut pas lancer ce contrôle chaque heure ; Cloudflare joue donc uniquement
le rôle d’ordonnanceur et aucun serveur permanent n’est nécessaire.

Test de production :

1. Ouvrir le domaine HTTPS déployé et installer la PWA.
2. Activer les alertes après une action explicite.
3. Vérifier la row dans Supabase et l’absence de doublon après une nouvelle activation.
4. Appeler `/api/push/test` avec son Bearer token depuis un terminal sécurisé.
5. Vérifier les exécutions dans les logs du Worker Cloudflare et les réponses JSON de la fonction
   Vercel.
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

- `POST /api/push/subscribe` crée ou rattache le hash du jeton après preuve par les clés Web Push ;
- `POST /api/push/unsubscribe` désactive la row identifiée par le hash du jeton ;
- `POST /api/push/test` accepte le jeton du navigateur ou le secret administratif de production ;
- `POST /api/push/reminder` programme un rappel pour l'abonnement identifié par le jeton ;
- `/api/push/target-watch` ne reçoit jamais l'endpoint dans sa query string ;
- `GET /api/cron/sky-alerts` lit seulement les rows actives et exige `CRON_SECRET` ;
- une réponse Web Push 404/410 désactive la subscription expirée ;
- les coordonnées sont réarrondies à `0.1°` côté route et côté store ;
- aucun endpoint connu ne permet à lui seul de lire ou modifier un abonnement ;
- la fonction SQL atomique impose 12 heures entre alertes éditoriales et déduplique chaque occasion ;
- les rappels volontaires restent one-shot, prioritaires et repoussent ensuite les alertes éditoriales ;
- les notifications de test ont leur propre limite d’une heure ;
- aucune opportunité n’est envoyée hors de la plage locale 19 h–3 h 59.

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
