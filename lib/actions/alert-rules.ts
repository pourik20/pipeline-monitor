'use server'

import { revalidatePath } from 'next/cache'
import { authContext } from '@/lib/shared/auth-context'
import { alertRules } from '@/lib/alerts/rules'
import { createAlertRuleSchema, type CreateAlertRuleInput, type AlertRuleDto } from '@/lib/alerts/alert-rule-schema'
import { logger } from '@/lib/shared/logger'
import { toActionResult, type ActionResult } from './_result'

export async function createAlertRule(
  input: CreateAlertRuleInput,
): Promise<ActionResult<AlertRuleDto>> {
  return toActionResult(async () => {
    const parsed = createAlertRuleSchema.parse(input)
    const user = await authContext.currentUser()
    const rule = await alertRules.create(parsed, user)
    logger.info({ ruleId: rule.id, pipelineId: rule.pipelineId }, 'alert rule created (action)')
    revalidatePath(`/pipelines/${rule.pipelineId}`)
    return rule
  })
}

export async function setAlertRuleEnabled(
  id: string,
  enabled: boolean,
  pipelineId?: string,
): Promise<ActionResult<{ id: string; enabled: boolean }>> {
  return toActionResult(async () => {
    const result = await alertRules.setEnabled(id, enabled)
    if (pipelineId) revalidatePath(`/pipelines/${pipelineId}`)
    return result
  })
}

export async function deleteAlertRule(
  id: string,
  pipelineId?: string,
): Promise<ActionResult<{ id: string }>> {
  return toActionResult(async () => {
    await alertRules.deleteById(id)
    if (pipelineId) revalidatePath(`/pipelines/${pipelineId}`)
    return { id }
  })
}
