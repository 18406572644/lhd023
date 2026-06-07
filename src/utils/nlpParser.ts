import dayjs from 'dayjs'
import type { Task, TaskRepeatType, TaskPriority, TaskTag, NLPParseResult, ParsedTaskField, VocabMapping } from '../types'

const TIME_PATTERNS = [
  { regex: /今天/, type: 'offset', value: 0 },
  { regex: /明天/, type: 'offset', value: 1 },
  { regex: /后天/, type: 'offset', value: 2 },
  { regex: /大后天/, type: 'offset', value: 3 },
  { regex: /下周/, type: 'weekOffset', value: 1 },
  { regex: /下下周/, type: 'weekOffset', value: 2 },
  { regex: /上周/, type: 'weekOffset', value: -1 },
  { regex: /本周/, type: 'weekOffset', value: 0 },
]

const WEEKDAY_PATTERNS: Record<string, number> = {
  '周日': 0, '星期日': 0, '周天': 0, '礼拜天': 0, '礼拜日': 0,
  '周一': 1, '星期一': 1, '礼拜一': 1,
  '周二': 2, '星期二': 2, '礼拜二': 2,
  '周三': 3, '星期三': 3, '礼拜三': 3,
  '周四': 4, '星期四': 4, '礼拜四': 4,
  '周五': 5, '星期五': 5, '礼拜五': 5,
  '周六': 6, '星期六': 6, '礼拜六': 6,
}

const TIME_PERIOD_PATTERNS = [
  { regex: /早上|早晨|上午/, startHour: 6, endHour: 12, defaultHour: 9 },
  { regex: /中午|午间/, startHour: 12, endHour: 14, defaultHour: 12 },
  { regex: /下午/, startHour: 12, endHour: 18, defaultHour: 15 },
  { regex: /晚上|傍晚|晚间/, startHour: 18, endHour: 23, defaultHour: 20 },
  { regex: /凌晨|深夜/, startHour: 0, endHour: 6, defaultHour: 2 },
]

const PRIORITY_PATTERNS: Record<string, TaskPriority> = {
  '高优先级': 'high', '优先级高': 'high', '最高优先级': 'high',
  '紧急': 'urgent', '非常紧急': 'urgent', '立刻': 'urgent', '马上': 'urgent',
  '中优先级': 'medium', '普通': 'medium', '一般': 'medium',
  '低优先级': 'low', '优先级低': 'low', '不急': 'low', '不紧急': 'low',
}

const TAG_PATTERNS: Record<string, TaskTag> = {
  '工作': 'work', '办公': 'work', '上班': 'work',
  '个人': 'personal', '私人': 'personal',
  '家庭': 'family', '家人': 'family',
  '健康': 'health', '运动': 'health', '健身': 'health', '医疗': 'health',
  '学习': 'study', '读书': 'study', '上课': 'study', '考试': 'study',
  '其他': 'other',
}

const REPEAT_PATTERNS = [
  { regex: /每天|每日/, repeatType: 'daily' as TaskRepeatType },
  { regex: /每周|每星期/, repeatType: 'weekly' as TaskRepeatType },
  { regex: /每月/, repeatType: 'monthly' as TaskRepeatType },
  { regex: /每隔\s*(\d+)\s*天/, repeatType: 'custom' as TaskRepeatType, intervalDays: true },
  { regex: /每隔\s*(\d+)\s*小时/, repeatType: 'custom' as TaskRepeatType, intervalHours: true },
  { regex: /每隔\s*(\d+)\s*分钟/, repeatType: 'custom' as TaskRepeatType, intervalMinutes: true },
]

const REMINDER_PATTERNS = [
  { regex: /提醒我/, action: 'reminder' },
  { regex: /不要提醒|不需要提醒|关闭提醒/, soundEnabled: false },
  { regex: /需要声音|要有声音|声音提醒/, soundEnabled: true },
  { regex: /静音|无声|不要声音/, soundEnabled: false },
]

const DURATION_PATTERNS = [
  { regex: /(\d+)\s*分钟/, unit: 'minute' },
  { regex: /(\d+)\s*小时/, unit: 'hour' },
  { regex: /(\d+)\s*个?半小时/, unit: 'halfHour' },
]

const createEmptyField = <T>(): ParsedTaskField<T> => ({
  value: null,
  isAmbiguous: false,
  confidence: 0,
})

const parseTimeExpression = (text: string, vocabMappings: VocabMapping[]): { date: dayjs.Dayjs | null; isAmbiguous: boolean; confidence: number } => {
  let resultDate: dayjs.Dayjs | null = null
  let isAmbiguous = false
  let confidence = 0

  const customTimeMappings = vocabMappings.filter(v => v.category === 'time')
  let processedText = text
  customTimeMappings.forEach(mapping => {
    if (processedText.includes(mapping.word)) {
      processedText = processedText.replace(mapping.word, mapping.targetValue)
      confidence += 0.1
    }
  })

  let baseDate = dayjs()
  let dayOffset = 0
  let weekOffset = 0

  for (const pattern of TIME_PATTERNS) {
    if (pattern.regex.test(processedText)) {
      confidence += 0.2
      if (pattern.type === 'offset') {
        dayOffset = pattern.value
      } else if (pattern.type === 'weekOffset') {
        weekOffset = pattern.value
      }
    }
  }

  const dateMatch = processedText.match(/(\d{1,2})月(\d{1,2})[日号]/)
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10)
    const day = parseInt(dateMatch[2], 10)
    const year = month < baseDate.month() + 1 ? baseDate.year() + 1 : baseDate.year()
    resultDate = dayjs(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    confidence += 0.3
  }

  const weekdayMatches: number[] = []
  for (const [word, dayNum] of Object.entries(WEEKDAY_PATTERNS)) {
    if (processedText.includes(word)) {
      weekdayMatches.push(dayNum)
      confidence += 0.15
    }
  }

  baseDate = baseDate.add(weekOffset, 'week').add(dayOffset, 'day')

  if (!resultDate && weekdayMatches.length > 0) {
    const today = baseDate.day()
    const targetDay = weekdayMatches[0]
    let daysToAdd = targetDay - today
    if (daysToAdd < 0 || (daysToAdd === 0 && weekOffset === 0)) {
      daysToAdd += 7
    }
    resultDate = baseDate.add(daysToAdd, 'day')
  } else if (!resultDate) {
    resultDate = baseDate
  }

  const timeMatch = processedText.match(/(\d{1,2})[点:](\d{0,2})/)
  let hours = 9
  let minutes = 0

  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10)
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
    confidence += 0.25

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      resultDate = resultDate.hour(hours).minute(minutes).second(0)
    } else {
      isAmbiguous = true
    }
  } else {
    let foundPeriod = false
    for (const period of TIME_PERIOD_PATTERNS) {
      if (period.regex.test(processedText)) {
        hours = period.defaultHour
        resultDate = resultDate.hour(hours).minute(0).second(0)
        confidence += 0.15
        foundPeriod = true
        break
      }
    }
    if (!foundPeriod) {
      isAmbiguous = true
    }
  }

  const relativeTimeMatch = processedText.match(/(\d+)\s*分钟后/)
  if (relativeTimeMatch) {
    const minutesLater = parseInt(relativeTimeMatch[1], 10)
    resultDate = dayjs().add(minutesLater, 'minute')
    confidence += 0.3
    isAmbiguous = false
  }

  const relativeHoursMatch = processedText.match(/(\d+)\s*小时后/)
  if (relativeHoursMatch) {
    const hoursLater = parseInt(relativeHoursMatch[1], 10)
    resultDate = dayjs().add(hoursLater, 'hour')
    confidence += 0.3
    isAmbiguous = false
  }

  const relativeDaysMatch = processedText.match(/(\d+)\s*天后/)
  if (relativeDaysMatch) {
    const daysLater = parseInt(relativeDaysMatch[1], 10)
    resultDate = dayjs().add(daysLater, 'day').hour(9).minute(0).second(0)
    confidence += 0.3
    isAmbiguous = false
  }

  if (resultDate && resultDate.isBefore(dayjs()) && confidence > 0.3) {
    if (weekOffset === 0 && dayOffset === 0 && !relativeTimeMatch && !relativeHoursMatch && !relativeDaysMatch) {
      resultDate = resultDate.add(1, 'day')
    }
  }

  return {
    date: resultDate,
    isAmbiguous,
    confidence: Math.min(confidence, 1.0),
  }
}

const parseRepeatExpression = (text: string): {
  repeatType: ParsedTaskField<TaskRepeatType>
  repeatDays: ParsedTaskField<number[]>
  repeatInterval: ParsedTaskField<number>
} => {
  const result: ReturnType<typeof parseRepeatExpression> = {
    repeatType: { ...createEmptyField<TaskRepeatType>(), value: 'none' },
    repeatDays: createEmptyField<number[]>(),
    repeatInterval: createEmptyField<number>(),
  }

  for (const pattern of REPEAT_PATTERNS) {
    const match = text.match(pattern.regex)
    if (match) {
      result.repeatType.value = pattern.repeatType
      result.repeatType.confidence = 0.9
      result.repeatType.isAmbiguous = false

      if (pattern.intervalDays && match[1]) {
        result.repeatInterval.value = parseInt(match[1], 10) * 24 * 60
        result.repeatInterval.confidence = 0.9
      } else if (pattern.intervalHours && match[1]) {
        result.repeatInterval.value = parseInt(match[1], 10) * 60
        result.repeatInterval.confidence = 0.9
      } else if (pattern.intervalMinutes && match[1]) {
        result.repeatInterval.value = parseInt(match[1], 10)
        result.repeatInterval.confidence = 0.9
      }
      break
    }
  }

  const weekdayMatches: number[] = []
  for (const [word, dayNum] of Object.entries(WEEKDAY_PATTERNS)) {
    if (text.includes(word)) {
      weekdayMatches.push(dayNum)
    }
  }

  if (weekdayMatches.length > 0) {
    const uniqueDays = [...new Set(weekdayMatches)].sort()
    result.repeatDays.value = uniqueDays
    result.repeatDays.confidence = 0.85

    if (result.repeatType.value === 'none') {
      result.repeatType.value = 'weekly'
      result.repeatType.confidence = 0.7
    }

    const weekPattern = text.match(/周([一二三四五六日天1-7\s]+)/)
    if (weekPattern) {
      const dayChars = weekPattern[1].replace(/\s/g, '')
      const dayMap: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 0 }
      const days: number[] = []
      for (const char of dayChars) {
        if (dayMap[char] !== undefined) {
          days.push(dayMap[char])
        }
      }
      if (days.length > 0) {
        result.repeatDays.value = [...new Set(days)].sort()
        result.repeatDays.confidence = 0.95
      }
    }
  }

  return result
}

const parsePriority = (text: string, vocabMappings: VocabMapping[]): ParsedTaskField<TaskPriority> => {
  const result: ParsedTaskField<TaskPriority> = {
    ...createEmptyField<TaskPriority>(),
    value: 'medium',
    confidence: 0.5,
  }

  const customPriorityMappings = vocabMappings.filter(v => v.category === 'priority')
  for (const mapping of customPriorityMappings) {
    if (text.includes(mapping.word)) {
      result.value = mapping.targetValue as TaskPriority
      result.confidence = 0.9
      result.rawText = mapping.word
      return result
    }
  }

  for (const [word, priority] of Object.entries(PRIORITY_PATTERNS)) {
    if (text.includes(word)) {
      result.value = priority
      result.confidence = 0.85
      result.rawText = word
      return result
    }
  }

  return result
}

const parseTag = (text: string, vocabMappings: VocabMapping[]): ParsedTaskField<TaskTag> => {
  const result: ParsedTaskField<TaskTag> = {
    ...createEmptyField<TaskTag>(),
    value: 'other',
    confidence: 0.3,
  }

  const customTagMappings = vocabMappings.filter(v => v.category === 'tag')
  for (const mapping of customTagMappings) {
    if (text.includes(mapping.word)) {
      result.value = mapping.targetValue as TaskTag
      result.confidence = 0.9
      result.rawText = mapping.word
      return result
    }
  }

  for (const [word, tag] of Object.entries(TAG_PATTERNS)) {
    if (text.includes(word)) {
      result.value = tag
      result.confidence = 0.8
      result.rawText = word
      return result
    }
  }

  return result
}

const parseTitle = (text: string, vocabMappings: VocabMapping[]): ParsedTaskField<string> => {
  const result: ParsedTaskField<string> = {
    ...createEmptyField<string>(),
    value: '',
    confidence: 0.6,
  }

  let cleanedText = text

  const skipPatterns = [
    /^提醒我/, /^帮我/, /^请/, /^记得/, /^不要忘了/,
    /今天|明天|后天|大后天|下周|下下周|本周|上周/,
    /周[一二三四五六日天]|星期[一二三四五六日]|礼拜[一二三四五六日天]/,
    /\d{1,2}月\d{1,2}[日号]/,
    /\d{1,2}[点:]\d{0,2}/,
    /早上|早晨|上午|中午|下午|晚上|傍晚|凌晨|深夜/,
    /每天|每日|每周|每月|每隔\s*\d+\s*[天小时分钟]/,
    /高优先级|优先级高|紧急|中优先级|低优先级|普通|一般/,
    /提醒|不要提醒|需要声音|静音|无声/,
    /\d+\s*分钟后|\d+\s*小时后|\d+\s*天后/,
    /\d+\s*分钟|\d+\s*小时|\d+\s*个?半小时/,
    /工作|个人|家庭|健康|学习|其他/,
  ]

  for (const pattern of skipPatterns) {
    cleanedText = cleanedText.replace(pattern, '')
  }

  cleanedText = cleanedText.replace(/[,，。.!！?？、;；]/g, ' ').trim()

  const customTitleMappings = vocabMappings.filter(v => v.category === 'title')
  for (const mapping of customTitleMappings) {
    if (text.includes(mapping.word)) {
      result.value = mapping.targetValue
      result.confidence = 0.95
      result.rawText = mapping.word
      return result
    }
  }

  if (cleanedText.length > 0) {
    result.value = cleanedText
    result.confidence = 0.7
  } else {
    result.value = text
    result.isAmbiguous = true
    result.confidence = 0.4
  }

  return result
}

const parseSoundEnabled = (text: string): ParsedTaskField<boolean> => {
  const result: ParsedTaskField<boolean> = {
    ...createEmptyField<boolean>(),
    value: true,
    confidence: 0.5,
  }

  for (const pattern of REMINDER_PATTERNS) {
    if (pattern.regex.test(text)) {
      if (pattern.soundEnabled !== undefined) {
        result.value = pattern.soundEnabled
        result.confidence = 0.9
        break
      }
    }
  }

  return result
}

const parseDuration = (text: string): ParsedTaskField<number> => {
  const result: ParsedTaskField<number> = {
    ...createEmptyField<number>(),
    value: 30,
    confidence: 0.3,
  }

  for (const pattern of DURATION_PATTERNS) {
    const match = text.match(pattern.regex)
    if (match) {
      const value = parseInt(match[1], 10)
      if (pattern.unit === 'minute') {
        result.value = value
      } else if (pattern.unit === 'hour') {
        result.value = value * 60
      } else if (pattern.unit === 'halfHour') {
        result.value = value * 30
      }
      result.confidence = 0.85
      break
    }
  }

  return result
}

export const parseNaturalLanguage = (input: string, vocabMappings: VocabMapping[] = []): NLPParseResult => {
  const trimmedInput = input.trim()

  const timeResult = parseTimeExpression(trimmedInput, vocabMappings)
  const repeatResult = parseRepeatExpression(trimmedInput)
  const priorityResult = parsePriority(trimmedInput, vocabMappings)
  const tagResult = parseTag(trimmedInput, vocabMappings)
  const titleResult = parseTitle(trimmedInput, vocabMappings)
  const soundResult = parseSoundEnabled(trimmedInput)
  const durationResult = parseDuration(trimmedInput)

  const missingFields: string[] = []

  if (!titleResult.value || titleResult.isAmbiguous) {
    missingFields.push('title')
  }
  if (!timeResult.date || timeResult.isAmbiguous) {
    missingFields.push('targetTime')
  }

  const result: NLPParseResult = {
    title: {
      ...titleResult,
      value: titleResult.value || '',
    },
    targetTime: {
      value: timeResult.date ? timeResult.date.toISOString() : null,
      isAmbiguous: timeResult.isAmbiguous,
      confidence: timeResult.confidence,
    },
    repeatType: repeatResult.repeatType,
    repeatDays: repeatResult.repeatDays,
    repeatInterval: repeatResult.repeatInterval,
    priority: priorityResult,
    tag: tagResult,
    soundEnabled: soundResult,
    duration: durationResult,
    rawInput: trimmedInput,
    missingFields,
  }

  return result
}

export const parseResultToTaskData = (result: NLPParseResult): Omit<Task, 'id' | 'createdAt'> => {
  return {
    title: result.title.value || '未命名任务',
    description: result.rawInput,
    targetTime: result.targetTime.value || dayjs().add(1, 'hour').toISOString(),
    repeatType: result.repeatType.value || 'none',
    repeatInterval: result.repeatInterval?.value ?? undefined,
    repeatDays: result.repeatDays?.value ?? undefined,
    enabled: true,
    soundEnabled: result.soundEnabled.value ?? true,
    priority: result.priority.value || 'medium',
    tag: result.tag.value || 'other',
    duration: result.duration.value || 30,
    notes: '',
    links: [],
    attachments: [],
    isPinned: false,
  }
}

export const updateWordFrequency = (input: string, wordFrequency: Record<string, number>): Record<string, number> => {
  const newFrequency = { ...wordFrequency }
  const words = input.split(/[\s,，。.!！?？、;；]+/).filter(w => w.length > 1)

  for (const word of words) {
    newFrequency[word] = (newFrequency[word] || 0) + 1
  }

  return newFrequency
}

export const suggestVocabMapping = (word: string, category: VocabMapping['category'], wordFrequency: Record<string, number>): VocabMapping | null => {
  if ((wordFrequency[word] || 0) < 3) return null

  const suggestions: Partial<Record<VocabMapping['category'], string>> = {
    priority: 'medium',
    tag: 'other',
    time: '',
    title: word,
  }

  return {
    id: '',
    word,
    category,
    targetValue: suggestions[category] || '',
    createdAt: '',
    usageCount: wordFrequency[word] || 0,
  }
}

export const getNLPExampleInputs = (): string[] => {
  return [
    '明天下午3点开周会',
    '每周一三五早上9点打卡',
    '高优先级 下周五前完成报告',
    '提醒我10分钟后喝水',
    '每天晚上10点准备睡觉',
    '每月1号还信用卡',
    '紧急 今天下午5点前提交代码',
    '每周二四晚上7点健身 健康标签',
    '每隔90分钟提醒我喝水',
    '大后天上午10点半和客户开会',
  ]
}
