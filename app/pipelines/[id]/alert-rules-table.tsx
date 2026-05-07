"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setAlertRuleEnabled, deleteAlertRule } from "@/lib/actions/alert-rules";
import { toast } from "sonner";

interface AlertRule {
  _id: string;
  name: string;
  condition: string;
  enabled: boolean;
  createdAt?: Date | null;
}

export function AlertRulesTable({
  rules: initial,
  pipelineId,
}: {
  rules: AlertRule[];
  pipelineId: string;
}) {
  const [rules, setRules] = useState(initial);
  const [, startTransition] = useTransition();

  function toggleEnabled(id: string, enabled: boolean) {
    setRules((prev) => prev.map((r) => (r._id === id ? { ...r, enabled } : r)));
    startTransition(async () => {
      const result = await setAlertRuleEnabled(id, enabled, pipelineId);
      if (!result.ok) {
        setRules((prev) => prev.map((r) => (r._id === id ? { ...r, enabled: !enabled } : r)));
        toast.error(result.error.message);
      }
    });
  }

  function deleteRule(id: string) {
    const previous = rules;
    setRules((prev) => prev.filter((r) => r._id !== id));
    startTransition(async () => {
      const result = await deleteAlertRule(id, pipelineId);
      if (!result.ok) {
        setRules(previous);
        toast.error(result.error.message);
      }
    });
  }

  if (rules.length === 0) {
    return <p className="mb-4 text-sm text-muted-foreground">No alert rules yet.</p>;
  }

  return (
    <table className="mb-4 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-4 font-medium">Name</th>
          <th className="py-2 pr-4 font-medium">Condition</th>
          <th className="py-2 pr-4 font-medium">Enabled</th>
          <th className="py-2 pr-4 font-medium">Created</th>
          <th className="py-2 pr-4 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {rules.map((rule) => (
          <tr key={rule._id} className="border-b last:border-0">
            <td className="py-2 pr-4 font-medium">{rule.name}</td>
            <td className="py-2 pr-4">
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {rule.condition}
              </code>
            </td>
            <td className="py-2 pr-4">
              <Button
                type="button"
                variant={rule.enabled ? "default" : "outline"}
                size="xs"
                onClick={() => toggleEnabled(rule._id, !rule.enabled)}
              >
                {rule.enabled ? "on" : "off"}
              </Button>
            </td>
            <td className="py-2 pr-4 text-muted-foreground">
              {rule.createdAt ? new Date(rule.createdAt).toLocaleString() : "—"}
            </td>
            <td className="py-2 pr-4 text-right">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteRule(rule._id)}
              >
                Delete
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
