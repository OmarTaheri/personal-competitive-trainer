import SettingsClient from "./SettingsClient";
import { getDb, schema } from "@/db";
import { getSettings } from "@/lib/server/settings";
import { recentSyncLog } from "@/lib/server/sync";
import { countByPlatform } from "@/lib/server/problems";
import { ensureSeeded } from "@/lib/server/seed";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  ensureSeeded();
  const s = getSettings();
  const accounts = getDb().select().from(schema.accounts).all();
  const mask = (v: string | null) => (v ? "•".repeat(8) + v.slice(-4) : "");
  return (
    <SettingsClient
      settings={{
        displayName: s.displayName, timezone: s.timezone, dailyGoalMin: s.dailyGoalMin,
        shareNeetcode: s.shareNeetcode, shareCodeforces: s.shareCodeforces, shareCses: s.shareCses,
        hintDelayMin: s.hintDelayMin, editorialDelayMin: s.editorialDelayMin, idlePauseMin: s.idlePauseMin, resolveCap: s.resolveCap,
        showCfTags: s.showCfTags, contestDayFactor: s.contestDayFactor, weakEvery: s.weakEvery, digestHour: s.digestHour,
        telegramChatId: s.telegramChatId ?? "", clistUsername: s.clistUsername ?? "",
        atcoderTable: s.atcoderTable ?? "", codechefTable: s.codechefTable ?? "",
      }}
      secrets={{ telegramToken: mask(s.telegramToken), clistKey: mask(s.clistKey), leetcodeSession: mask(s.leetcodeSession), leetcodeCsrf: mask(s.leetcodeCsrf) }}
      accounts={accounts}
      log={recentSyncLog(25)}
      counts={countByPlatform()}
    />
  );
}
