# SkyQuest sky-alerts scheduler

Ce Worker appelle la route privée SkyQuest toutes les cinq minutes. Il ne contient aucune donnée
d’abonnement et ne connaît que l’URL publique de l’application et le secret du cron.

1. Installer ou lancer Wrangler : `npx wrangler login`.
2. Adapter `SKYQUEST_URL` dans `wrangler.toml` au domaine de production.
3. Enregistrer le même secret que dans Vercel : `npx wrangler secret put CRON_SECRET`.
4. Déployer depuis ce dossier : `npx wrangler deploy`.
5. Vérifier dans Cloudflare **Workers & Pages → Triggers** la cadence `*/5 * * * *`.

Le cron quotidien de `vercel.json` reste uniquement un secours compatible Vercel Hobby. Il ne
suffit pas à garantir l’envoi ponctuel des rappels « Me prévenir ».
