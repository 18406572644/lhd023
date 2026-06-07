import dayjs from 'dayjs'
import type { Objective, KeyResult, OKRProgress, Task } from '../types'
import { storage } from './storage'
import { MILESTONES } from './constants'

export function calculateKRProgress(kr: KeyResult): number {
  if (kr.targetValue <= 0) return 0
  const progress = (kr.currentValue / kr.targetValue) * 100
  return Math.min(Math.max(progress, 0), 100)
}

export function calculateObjectiveProgress(objective: Objective): OKRProgress {
  const now = dayjs()
  const endDate = dayjs(objective.endDate)
  
  const overdue = now.isAfter(endDate) && objective.status !== 'completed'
  const daysRemaining = endDate.diff(now, 'day')
  
  if (objective.keyResults.length === 0) {
    return {
      objectiveId: objective.id,
      progress: 0,
      completedKRs: 0,
      totalKRs: 0,
      overdue,
      daysRemaining
    }
  }
  
  const krProgresses = objective.keyResults.map(calculateKRProgress)
  const averageProgress = krProgresses.reduce((sum, p) => sum + p, 0) / krProgresses.length
  const completedKRs = krProgresses.filter(p => p >= 100).length
  
  return {
    objectiveId: objective.id,
    progress: Math.round(averageProgress),
    completedKRs,
    totalKRs: objective.keyResults.length,
    overdue,
    daysRemaining
  }
}

export function updateObjectiveStatus(objective: Objective): Objective {
  const progress = calculateObjectiveProgress(objective)
  
  let status = objective.status
  
  if (progress.progress >= 100) {
    status = 'completed'
  } else if (progress.progress > 0 && status === 'not_started') {
    status = 'in_progress'
  } else if (progress.overdue && status === 'in_progress') {
    status = 'paused'
  }
  
  return { ...objective, status }
}

export async function checkMilestoneNotifications(objective: Objective): Promise<void> {
  const progress = calculateObjectiveProgress(objective)
  
  for (const milestone of MILESTONES) {
    if (progress.progress >= milestone && !objective.notifiedMilestones.includes(milestone)) {
      await storage.addOKRNotification({
        objectiveId: objective.id,
        objectiveTitle: objective.title,
        milestone
      })
      
      const milestoneText = milestone === 100 ? '已完成' : `达到 ${milestone}%`
      await storage.notify(
        `🎯 目标${milestoneText}`,
        `目标「${objective.title}」${milestoneText}！`
      )
      
      console.log(`[OKR] 里程碑通知: ${objective.title} - ${milestone}%`)
    }
  }
}

export async function updateAllObjectivesStatus(): Promise<void> {
  const objectives = await storage.getObjectives()
  const updatedObjectives: Objective[] = []
  
  for (const objective of objectives) {
    const updated = updateObjectiveStatus(objective)
    updatedObjectives.push(updated)
    
    if (updated.status !== objective.status) {
      console.log(`[OKR] 目标状态变更: ${objective.title} ${objective.status} -> ${updated.status}`)
    }
    
    await checkMilestoneNotifications(updated)
  }
  
  await storage.saveObjectives(updatedObjectives)
}

export function getLinkedTasksForObjective(objective: Objective, tasks: Task[]): Task[] {
  const linkedTaskIds = objective.keyResults
    .filter(kr => kr.type === 'task' && kr.taskId)
    .map(kr => kr.taskId!)
  
  return tasks.filter(t => linkedTaskIds.includes(t.id))
}

export function sortObjectives(
  objectives: Objective[],
  sortBy: 'priority' | 'date' | 'progress' = 'date',
  ascending: boolean = false
): Objective[] {
  const priorityWeight: Record<string, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1
  }
  
  return [...objectives].sort((a, b) => {
    let comparison = 0
    
    switch (sortBy) {
      case 'priority':
        comparison = priorityWeight[a.priority] - priorityWeight[b.priority]
        break
      case 'date':
        comparison = dayjs(a.endDate).valueOf() - dayjs(b.endDate).valueOf()
        break
      case 'progress':
        const progressA = calculateObjectiveProgress(a).progress
        const progressB = calculateObjectiveProgress(b).progress
        comparison = progressA - progressB
        break
    }
    
    return ascending ? comparison : -comparison
  })
}

export function filterObjectives(
  objectives: Objective[],
  filters: {
    status?: string
    priority?: string
    tag?: string
    overdueOnly?: boolean
  }
): Objective[] {
  return objectives.filter(obj => {
    if (filters.status && obj.status !== filters.status) return false
    if (filters.priority && obj.priority !== filters.priority) return false
    if (filters.tag && !obj.tags.includes(filters.tag as any)) return false
    if (filters.overdueOnly) {
      const progress = calculateObjectiveProgress(obj)
      if (!progress.overdue) return false
    }
    return true
  })
}

export async function syncTaskKRsWithTasks(tasks: Task[]): Promise<void> {
  const completedTaskIds = tasks.filter(t => !t.enabled).map(t => t.id)
  
  for (const taskId of completedTaskIds) {
    await storage.syncTaskKRProgress(taskId, true)
  }
  
  const activeTaskIds = tasks.filter(t => t.enabled).map(t => t.id)
  for (const taskId of activeTaskIds) {
    await storage.syncTaskKRProgress(taskId, false)
  }
}
