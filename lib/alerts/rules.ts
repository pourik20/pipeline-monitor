import mongoose from 'mongoose'
import jsonata from 'jsonata'
import { ValidationError, NotFoundError } from '@/lib/shared/errors'
import { alertRepository } from '@/lib/alerts/alert-repository'
import type { AlertRuleDoc } from '@/lib/alerts/alert-rule-model'
import type { UserDoc } from '@/lib/shared/user'
import type { CreateAlertRuleInput, AlertRuleDto } from '@/lib/alerts/alert-rule-schema'

function toDto(rule: AlertRuleDoc): AlertRuleDto {
  return {
    id: String(rule._id),
    pipelineId: String(rule.pipelineId),
    name: rule.name,
    condition: rule.condition,
    enabled: rule.enabled,
    createdBy: rule.createdBy,
    createdAt: rule.createdAt?.toISOString() ?? null,
    updatedAt: (rule as typeof rule & { updatedAt?: Date }).updatedAt?.toISOString() ?? null,
  }
}

export const alertRules = {
  async create(input: CreateAlertRuleInput, user: UserDoc): Promise<AlertRuleDto> {
    if (!mongoose.isValidObjectId(input.pipelineId)) {
      throw new ValidationError('Invalid pipelineId')
    }
    try {
      jsonata(input.condition)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid JSONata expression'
      throw new ValidationError('Invalid JSONata condition', message)
    }
    const rule = await alertRepository.createRule({
      pipelineId: new mongoose.Types.ObjectId(input.pipelineId),
      name: input.name,
      condition: input.condition,
      enabled: input.enabled,
      createdBy: user.id,
    })
    return toDto(rule)
  },

  async listByPipeline(pipelineId: string): Promise<AlertRuleDto[]> {
    const rules = await alertRepository.findRulesByPipelineId(pipelineId)
    return rules.map(toDto)
  },

  async getById(id: string): Promise<AlertRuleDto> {
    const rule = await alertRepository.findRuleById(id)
    if (!rule) throw new NotFoundError('Alert rule not found')
    return toDto(rule)
  },

  async setEnabled(id: string, enabled: boolean): Promise<{ id: string; enabled: boolean }> {
    const rule = await alertRepository.updateRule(id, { enabled })
    if (!rule) throw new NotFoundError('Alert rule not found')
    return { id: String(rule._id), enabled: rule.enabled }
  },

  async deleteById(id: string): Promise<void> {
    const deleted = await alertRepository.deleteRule(id)
    if (!deleted) throw new NotFoundError('Alert rule not found')
  },
}
