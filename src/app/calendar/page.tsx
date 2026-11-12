import CalendarClient from "./CalendarClient";
import { calendarEvents } from "@/lib/server/calendar";
import { getSettings } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  const tz = getSettings().timezone;
  const now = Date.now();
  return <CalendarClient tz={tz} initial={calendarEvents(now - 45 * 86400e3, now + 60 * 86400e3)} initialRange={[now - 45 * 86400e3, now + 60 * 86400e3]} />;
}
