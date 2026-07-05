async function runSkyAlerts(env) {
  const baseUrl = env.SKYQUEST_URL.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/cron/sky-alerts`, {
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
  if (!response.ok) {
    throw new Error(`SkyQuest cron failed with status ${response.status}`);
  }
}

const worker = {
  scheduled(_controller, env, context) {
    context.waitUntil(runSkyAlerts(env));
  },
};

export default worker;
