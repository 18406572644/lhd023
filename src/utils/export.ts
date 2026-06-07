import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import type { TaskHistory } from '../types'

const statusLabels: Record<string, string> = {
  completed: '已提醒',
  skipped: '已跳过',
  failed: '失败'
}

export type ExportFormat = 'csv' | 'excel'
export type TimeRange = 'all' | '7days' | '30days' | 'custom'

export interface ExportOptions {
  format: ExportFormat
  timeRange: TimeRange
  customStart?: string
  customEnd?: string
}

export const filterHistoryByTimeRange = (
  history: TaskHistory[],
  timeRange: TimeRange,
  customStart?: string,
  customEnd?: string
): TaskHistory[] => {
  const now = dayjs()

  switch (timeRange) {
    case '7days':
      return history.filter(h => dayjs(h.triggeredAt).isAfter(now.subtract(7, 'day')))
    case '30days':
      return history.filter(h => dayjs(h.triggeredAt).isAfter(now.subtract(30, 'day')))
    case 'custom':
      if (!customStart || !customEnd) return history
      return history.filter(h => {
        const triggeredAt = dayjs(h.triggeredAt)
        return triggeredAt.isAfter(dayjs(customStart).startOf('day')) &&
               triggeredAt.isBefore(dayjs(customEnd).endOf('day'))
      })
    case 'all':
    default:
      return history
  }
}

export const exportToCSV = (history: TaskHistory[]): string => {
  const headers = ['任务名称', '触发时间', '状态']
  const rows = history.map(h => [
    h.taskTitle,
    dayjs(h.triggeredAt).format('YYYY-MM-DD HH:mm:ss'),
    statusLabels[h.status] || h.status
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return '\uFEFF' + csvContent
}

export const exportToExcel = (history: TaskHistory[]): Blob => {
  const data = history.map(h => ({
    '任务名称': h.taskTitle,
    '触发时间': dayjs(h.triggeredAt).format('YYYY-MM-DD HH:mm:ss'),
    '状态': statusLabels[h.status] || h.status
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '历史记录')

  worksheet['!cols'] = [
    { wch: 30 },
    { wch: 20 },
    { wch: 10 }
  ]

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([excelBuffer], { type: 'application/octet-stream' })
}

export const downloadFile = (content: string | Blob, filename: string, format: ExportFormat): void => {
  const mimeTypes: Record<ExportFormat, string> = {
    csv: 'text/csv;charset=utf-8;',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }

  const extensions: Record<ExportFormat, string> = {
    csv: 'csv',
    excel: 'xlsx'
  }

  const blob = content instanceof Blob
    ? content
    : new Blob([content], { type: mimeTypes[format] })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.${extensions[format]}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const exportHistory = (history: TaskHistory[], options: ExportOptions): void => {
  const filtered = filterHistoryByTimeRange(
    history,
    options.timeRange,
    options.customStart,
    options.customEnd
  )

  if (filtered.length === 0) {
    return
  }

  const timestamp = dayjs().format('YYYYMMDD_HHmmss')
  const filename = `任务历史记录_${timestamp}`

  if (options.format === 'csv') {
    const csvContent = exportToCSV(filtered)
    downloadFile(csvContent, filename, 'csv')
  } else {
    const excelBlob = exportToExcel(filtered)
    downloadFile(excelBlob, filename, 'excel')
  }
}
