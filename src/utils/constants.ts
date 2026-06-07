import type { TaskPriority, TaskTag, TemplateCategory } from '../types'

export const priorityColors: Record<TaskPriority, string> = {
  low: '#52c41a',
  medium: '#faad14',
  high: '#fa8c16',
  urgent: '#f5222d'
}

export const priorityLabels: Record<TaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急'
}

export const tagColors: Record<TaskTag, string> = {
  work: '#1677ff',
  personal: '#722ed1',
  family: '#eb2f96',
  health: '#13c2c2',
  study: '#52c41a',
  other: '#8c8c8c'
}

export const tagLabels: Record<TaskTag, string> = {
  work: '工作',
  personal: '个人',
  family: '家庭',
  health: '健康',
  study: '学习',
  other: '其他'
}

export const categoryColors: Record<TemplateCategory, string> = {
  meeting: '#1677ff',
  report: '#722ed1',
  health: '#13c2c2',
  study: '#52c41a',
  personal: '#eb2f96',
  work: '#fa8c16',
  other: '#8c8c8c'
}

export const categoryLabels: Record<TemplateCategory, string> = {
  meeting: '会议类',
  report: '报告类',
  health: '健康类',
  study: '学习类',
  personal: '个人类',
  work: '工作类',
  other: '其他'
}

export const getTaskColor = (priority: TaskPriority, tag: TaskTag): string => {
  return priorityColors[priority] || tagColors[tag]
}

export const viewTypes = ['month', 'week', 'day'] as const
export type ViewType = typeof viewTypes[number]
