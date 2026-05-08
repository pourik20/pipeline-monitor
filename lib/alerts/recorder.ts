import type mongoose from "mongoose";
import type { AlertRuleDoc } from "../models/alert-rule";
import { alertRepository } from "../repositories/alert-repository";

export interface NotifyRunInput {
  _id: mongoose.Types.ObjectId;
  status: string;
}

export const notifier = {
  async notify(matches: AlertRuleDoc[], run: NotifyRunInput): Promise<void> {
    for (const rule of matches) {
      const message = `Alert "${rule.name}" triggered: run ${run._id} finished with status ${run.status}`;
      await alertRepository.upsertByRuleRun(rule._id as mongoose.Types.ObjectId, run._id, message);
    }
  },
};
