import cron from "node-cron";
import { syncAll, syncContests, lastSyncAt } from "./sync";
import { tickNotifications } from "./notify";
import { ensureSeeded } from "./seed";
import { rebuildPlan } from "./training";

const g = globalThis as unknown as { __cpCron?: boolean };

export function startCron() {
  if (g.__cpCron || process.env.CP_DISABLE_CRON) return;
  g.__cpCron = true;
  ensureSeeded();

  // Problems + solves every 6 h, contests every hour, notifications every minute.
  cron.schedule("7 */6 * * *", () => void syncAll("problems").then(() => syncAll("solves")).then(() => rebuildPlan()));
  cron.schedule("17 * * * *", () => void syncContests());
  cron.schedule("* * * * *", () => void tickNotifications().catch((e) => console.error("[notify]", e)));

  // Catch up on start if data is stale.
  setTimeout(async () => {
    try {
      const sixH = 6 * 3600e3;
      if (!lastSyncAt("contests") || Date.now() - lastSyncAt("contests")! > 3600e3) await syncContests();
      if (!lastSyncAt("problems:") || Date.now() - lastSyncAt("problems:")! > sixH) {
        await syncAll("problems");
        await syncAll("solves");
        rebuildPlan();
      }
    } catch (e) {
      console.error("[cron] startup sync failed", e);
    }
  }, 3000);
}
