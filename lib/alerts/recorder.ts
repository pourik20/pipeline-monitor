import type mongoose from "mongoose";
import type { AlertRuleDoc } from "@/lib/alerts/alert-rule-model";
import { alertRepository } from "@/lib/alerts/alert-repository";
import { bus } from "@/lib/events";

export interface RecordRunInput {
  _id: mongoose.Types.ObjectId;
  status: string;
}

export const recorder = {
  async record(matches: AlertRuleDoc[], run: RecordRunInput): Promise<void> {
    for (const rule of matches) {
      const message = `Alert "${rule.name}" triggered: run ${run._id} finished with status ${run.status}`;
      const { created } = await alertRepository.upsertByRuleRun(
        rule._id as mongoose.Types.ObjectId,
        run._id,
        message,
      );
      if (created) {
        bus.publish({
          type: "alertFired",
          runId: run._id,
          ruleId: rule._id as mongoose.Types.ObjectId,
          ruleName: rule.name,
          message,
        });
      }
    }
  },
};
