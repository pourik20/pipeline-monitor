"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface AlertRule {
  _id: string;
  name: string;
  condition: string;
  enabled: boolean;
  createdAt?: Date | null;
}

export function AlertRulesTable({ rules: initial }: { rules: AlertRule[] }) {
  const router = useRouter();
  const [rules, setRules] = useState(initial);

  async function toggleEnabled(id: string, enabled: boolean) {
    setRules((prev) => prev.map((r) => (r._id === id ? { ...r, enabled } : r)));
    await fetch(`/api/alert-rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  }

  async function deleteRule(id: string) {
    setRules((prev) => prev.filter((r) => r._id !== id));
    await fetch(`/api/alert-rules/${id}`, { method: "DELETE" });
    router.refresh();
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
                onClick={() => void toggleEnabled(rule._id, !rule.enabled)}
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
                onClick={() => void deleteRule(rule._id)}
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
