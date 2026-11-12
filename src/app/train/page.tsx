import TrainClient from "./TrainClient";
import { trainView } from "@/lib/server/trainView";

export const dynamic = "force-dynamic";

export default function TrainPage() {
  return <TrainClient initial={trainView()} />;
}
