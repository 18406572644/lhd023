import dayjs from 'dayjs'
import type { Task } from '../types'

export function shouldTriggerTask(task: Task, now: dayjs.Dayjs): boolean {
  if (!task.enabled) return false

  const target = dayjs(task.targetTime)

  switch (task.repeatType) {
    case 'none': {
      return now.isAfter(target) && now.diff(target, 'minute') < 2
    }
    case 'daily': {
      const targetToday = now
        .hour(target.hour())
        .minute(target.minute())
        .second(0)
      return (
        now.isAfter(targetToday) &&
        now.diff(targetToday, 'minute') < 2 &&
        now.format('YYYY-MM-DD') !== dayjs(task.createdAt).format('YYYY-MM-DD')
      )
    }
    case 'weekly': {
      const targetWeekday = target.day()
      const nowWeekday = now.day()
      if (targetWeekday !== nowWeekday) return false

      const targetToday = now
        .hour(target.hour())
        .minute(target.minute())
        .second(0)
      return (
        now.isAfter(targetToday) &&
        now.diff(targetToday, 'minute') < 2
      )
    }
    case 'monthly': {
      const targetDate = target.date()
      const nowDate = now.date()
      if (targetDate !== nowDate) return false

      const targetToday = now
        .hour(target.hour())
        .minute(target.minute())
        .second(0)
      return (
        now.isAfter(targetToday) &&
        now.diff(targetToday, 'minute') < 2
      )
    }
    case 'custom': {
      if (!task.repeatInterval) return false
      const diffMinutes = now.diff(target, 'minute')
      return diffMinutes > 0 && diffMinutes % task.repeatInterval < 2
    }
    default:
      return false
  }
}

export function getNextTriggerTime(task: Task, from?: dayjs.Dayjs): dayjs.Dayjs | null {
  if (!task.enabled) return null

  const now = from || dayjs()
  const target = dayjs(task.targetTime)

  switch (task.repeatType) {
    case 'none': {
      if (target.isAfter(now)) return target
      return null
    }
    case 'daily': {
      let next = now
        .hour(target.hour())
        .minute(target.minute())
        .second(0)
      if (next.isBefore(now)) {
        next = next.add(1, 'day')
      }
      return next
    }
    case 'weekly': {
      const targetWeekday = target.day()
      let next = now
        .hour(target.hour())
        .minute(target.minute())
        .second(0)
        .day(targetWeekday)
      if (next.isBefore(now)) {
        next = next.add(7, 'day')
      }
      return next
    }
    case 'monthly': {
      const targetDate = target.date()
      let next = now
        .date(targetDate)
        .hour(target.hour())
        .minute(target.minute())
        .second(0)
      if (next.isBefore(now)) {
        next = next.add(1, 'month')
      }
      return next
    }
    case 'custom': {
      if (!task.repeatInterval) return null
      const diffMinutes = now.diff(target, 'minute')
      if (diffMinutes < 0) return target
      const intervals = Math.ceil(diffMinutes / task.repeatInterval)
      return target.add(intervals * task.repeatInterval, 'minute')
    }
    default:
      return null
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}
