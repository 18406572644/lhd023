import React, { useEffect, useState, useCallback } from 'react'
import { Modal, Form, Input, DatePicker, Select, Switch, InputNumber, Row, Col, Checkbox, Button, Space, Tooltip, Tag, message, Typography, Tabs, Badge, Alert, List } from 'antd'
import { 
  PlayCircleOutlined, PauseCircleOutlined, SoundOutlined, FileTextOutlined, 
  LinkOutlined, PaperClipOutlined, EditTwoTone, InfoCircleOutlined,
  CalendarOutlined, SyncOutlined, WarningOutlined, BulbOutlined,
  VideoCameraOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Task, SoundOption, TaskPriority, TaskTag, TaskTemplate, TaskLink, TaskAttachment, Calendar, CalendarConflict, TaskCalendarSyncInfo } from '../types'
import { soundManager } from '../utils/soundManager'
import { storage } from '../utils/storage'
import { priorityColors, priorityLabels, tagColors, tagLabels, categoryColors, categoryLabels } from '../utils/constants'
import { RichTextEditor } from './RichTextEditor'
import { LinkManager } from './LinkManager'
import { AttachmentManager } from './AttachmentManager'
import { calendarManager } from '../utils/calendarManager'

const { Text } = Typography
const { TextArea } = Input
const { Option } = Select

interface TaskFormProps {
  open: boolean
  task: Task | null
  defaultTime?: dayjs.Dayjs | null
  templateData?: Omit<Task, 'id' | 'createdAt'> | null
  onCancel: () => void
  onSubmit: (task: Omit<Task, 'id' | 'createdAt'>) => void
  onTemplateDataApplied?: () => void
}

const weekDays = [
  { label: '周日', value: 0 },
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 }
]

export const TaskForm: React.FC<TaskFormProps> = ({ open, task, defaultTime, templateData, onCancel, onSubmit, onTemplateDataApplied }) => {
  const [form] = Form.useForm()
  const [sounds, setSounds] = useState<SoundOption[]>([])
  const [defaultSoundId, setDefaultSoundId] = useState<string>('')
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [links, setLinks] = useState<TaskLink[]>([])
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [activeTab, setActiveTab] = useState('basic')
  const [isPinned, setIsPinned] = useState(false)
  const [pinnedAt, setPinnedAt] = useState<string | undefined>(undefined)
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('')
  const [autoSyncToCalendar, setAutoSyncToCalendar] = useState(false)
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([])
  const [showConflictAlert, setShowConflictAlert] = useState(false)
  const [freeTimeSuggestions, setFreeTimeSuggestions] = useState<Array<{ start: string; end: string; score: number }>>([])
  const [showFreeTimeSuggestions, setShowFreeTimeSuggestions] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [calendarSync, setCalendarSync] = useState<TaskCalendarSyncInfo | undefined>(undefined)
  const [isMeeting, setIsMeeting] = useState(false)
  const repeatType = Form.useWatch('repeatType', form)
  const soundEnabled = Form.useWatch('soundEnabled', form)
  const targetTime = Form.useWatch('targetTime', form)
  const duration = Form.useWatch('duration', form)
  const title = Form.useWatch('title', form)

  const loadCalendarData = useCallback(async () => {
    const [loadedCalendars, syncConfig] = await Promise.all([
      calendarManager.getCalendars(),
      storage.getCalendarSyncConfig()
    ])
    setCalendars(loadedCalendars.filter(c => c.canWrite))
    setSelectedCalendarId(syncConfig.defaultCalendarId || loadedCalendars.find(c => c.isDefault)?.id || '')
    setAutoSyncToCalendar(syncConfig.autoSync)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      const [loadedSounds, loadedDefault, loadedTemplates] = await Promise.all([
        soundManager.getAllSounds(),
        soundManager.getDefaultSoundId(),
        storage.getTemplates()
      ])
      setSounds(loadedSounds)
      setDefaultSoundId(loadedDefault)
      setTemplates(loadedTemplates)
      await loadCalendarData()
    }
    loadData()
  }, [loadCalendarData])

  const checkConflicts = useCallback(async () => {
    if (!targetTime || !duration) return

    try {
      const taskStartTime = targetTime.toISOString()
      const taskEndTime = targetTime.add(duration, 'minute').toISOString()
      
      const detectedConflicts = await storage.checkCalendarConflicts(
        taskStartTime,
        taskEndTime,
        task?.id
      )
      
      setConflicts(detectedConflicts)
      setShowConflictAlert(detectedConflicts.length > 0)

      if (detectedConflicts.length > 0) {
        const syncConfig = await storage.getCalendarSyncConfig()
        if (syncConfig.autoSuggestFreeTime) {
          const suggestions = await calendarManager.suggestFreeTime(
            targetTime.toISOString(),
            duration
          )
          setFreeTimeSuggestions(suggestions)
          setShowFreeTimeSuggestions(suggestions.length > 0)
        }
      }
    } catch (err) {
      console.error('检查冲突失败:', err)
    }
  }, [targetTime, duration, task])

  useEffect(() => {
    if (open && targetTime && duration) {
      const timer = setTimeout(() => {
        checkConflicts()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [open, targetTime, duration, checkConflicts])

  const detectMeeting = useCallback(() => {
    if (!title && !notes) return false
    const meetingKeywords = ['会议', 'meeting', '讨论', '评审', '周会', '站会', 'standup', 'review', 'sync']
    const text = (title || '') + ' ' + (notes || '')
    const lowerText = text.toLowerCase()
    return meetingKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()))
  }, [title, notes])

  useEffect(() => {
    setIsMeeting(detectMeeting())
  }, [detectMeeting])

  const handleTemplateSelect = async (templateId: string) => {
    if (!templateId) return
    try {
      const taskData = await storage.createTaskFromTemplate(templateId)
      if (taskData) {
        form.setFieldsValue({
          ...taskData,
          targetTime: dayjs(taskData.targetTime)
        })
        message.success('已应用模板配置')
      }
    } catch (err) {
      console.error('应用模板失败:', err)
      message.error('应用模板失败')
    } finally {
      setSelectedTemplateId('')
    }
  }

  useEffect(() => {
    if (open) {
      const unsubscribe = soundManager.subscribeToPlayState((soundId, isPlaying) => {
        setPlayingSoundId(isPlaying ? soundId : null)
      })
      if (task) {
        form.setFieldsValue({
          title: task.title,
          description: task.description,
          targetTime: dayjs(task.targetTime),
          repeatType: task.repeatType,
          repeatInterval: task.repeatInterval,
          repeatDays: task.repeatDays,
          enabled: task.enabled,
          soundEnabled: task.soundEnabled,
          soundId: task.soundId,
          priority: task.priority,
          tag: task.tag,
          duration: task.duration
        })
        setNotes(task.notes || '')
        setLinks(task.links || [])
        setAttachments(task.attachments || [])
        setIsPinned(task.isPinned || false)
        setPinnedAt(task.pinnedAt)
        setCalendarSync(task.calendarSync)
        setIsMeeting(task.isMeeting || false)
        setAutoSyncToCalendar(task.calendarSync?.autoSyncToCalendar || false)
        if (task.calendarSync?.calendarId) {
          setSelectedCalendarId(task.calendarSync.calendarId)
        }
      } else if (templateData) {
        form.setFieldsValue({
          title: templateData.title,
          description: templateData.description,
          targetTime: dayjs(templateData.targetTime),
          repeatType: templateData.repeatType,
          repeatInterval: templateData.repeatInterval,
          repeatDays: templateData.repeatDays,
          enabled: templateData.enabled,
          soundEnabled: templateData.soundEnabled,
          soundId: templateData.soundId,
          priority: templateData.priority,
          tag: templateData.tag,
          duration: templateData.duration
        })
        setNotes('')
        setLinks([])
        setAttachments([])
        if (onTemplateDataApplied) {
          onTemplateDataApplied()
        }
      } else {
        form.resetFields()
        form.setFieldsValue({
          repeatType: 'none',
          enabled: true,
          soundEnabled: true,
          targetTime: defaultTime || dayjs().add(1, 'hour'),
          priority: 'medium',
          tag: 'work',
          duration: 30
        })
        setNotes('')
        setLinks([])
        setAttachments([])
      }
      return () => {
        unsubscribe()
        soundManager.stopSound()
      }
    }
  }, [open, task, templateData, form, onTemplateDataApplied])

  const syncTaskToCalendar = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt'> & { id?: string }) => {
    if (!autoSyncToCalendar || !selectedCalendarId) return { success: true }

    setIsSyncing(true)
    try {
      const fullTask: Task = {
        ...taskData,
        id: taskData.id || 'temp-id',
        createdAt: new Date().toISOString(),
        calendarSync: {
          ...calendarSync,
          autoSyncToCalendar: true,
          calendarId: selectedCalendarId,
          calendarEventId: calendarSync?.calendarEventId,
          syncedAt: new Date().toISOString()
        }
      }
      const result = await calendarManager.syncTaskToCalendar(fullTask)
      if (result.success && result.eventId) {
        fullTask.calendarSync!.calendarEventId = result.eventId
        message.success('已同步到系统日历')
      } else if (!result.success) {
        message.warning(result.message || '同步到日历失败')
      }
      return result
    } catch (error) {
      console.error('同步到日历失败:', error)
      return { success: false }
    } finally {
      setIsSyncing(false)
    }
  }, [autoSyncToCalendar, selectedCalendarId, calendarSync])

  const handleOk = async () => {
    soundManager.stopSound()
    try {
      const values = await form.validateFields()
      
      const taskData: Omit<Task, 'id' | 'createdAt'> = {
        title: values.title,
        description: values.description || '',
        targetTime: values.targetTime.toISOString(),
        repeatType: values.repeatType,
        repeatInterval: values.repeatInterval,
        repeatDays: values.repeatDays,
        enabled: values.enabled,
        soundEnabled: values.soundEnabled,
        soundId: values.soundId,
        priority: values.priority,
        tag: values.tag,
        duration: values.duration,
        notes: notes,
        links: links,
        attachments: attachments,
        isPinned: task ? isPinned : false,
        pinnedAt: task ? pinnedAt : undefined,
        isMeeting: isMeeting,
        calendarSync: autoSyncToCalendar ? {
          autoSyncToCalendar: true,
          calendarId: selectedCalendarId,
          calendarEventId: calendarSync?.calendarEventId,
          syncedAt: calendarSync?.syncedAt
        } : calendarSync,
        meetingPrepReminded: false
      }

      if (task && task.id) {
        await syncTaskToCalendar({ ...taskData, id: task.id })
      }

      onSubmit(taskData)
      form.resetFields()
    } catch (error) {
      console.error('保存失败:', error)
    }
  }

  const handleCancel = () => {
    soundManager.stopSound()
    onCancel()
  }

  const handleTogglePlaySound = (soundId: string) => {
    const sound = sounds.find(s => s.id === soundId)
    if (sound) {
      soundManager.toggleSound(sound)
    }
  }

  const handleSyncToCalendar = async () => {
    try {
      const values = await form.validateFields()
      
      const taskData: Omit<Task, 'id' | 'createdAt'> = {
        title: values.title,
        description: values.description || '',
        targetTime: values.targetTime.toISOString(),
        repeatType: values.repeatType,
        repeatInterval: values.repeatInterval,
        repeatDays: values.repeatDays,
        enabled: values.enabled,
        soundEnabled: values.soundEnabled,
        soundId: values.soundId,
        priority: values.priority,
        tag: values.tag,
        duration: values.duration,
        notes: notes,
        links: links,
        attachments: attachments,
        isPinned: task ? isPinned : false,
        pinnedAt: task ? pinnedAt : undefined,
        isMeeting: isMeeting,
        calendarSync: {
          autoSyncToCalendar: true,
          calendarId: selectedCalendarId,
          calendarEventId: calendarSync?.calendarEventId,
          syncedAt: calendarSync?.syncedAt
        },
        meetingPrepReminded: false
      }

      const result = await syncTaskToCalendar(task ? { ...taskData, id: task.id } : taskData)
      if (result.success) {
        setCalendarSync({
          autoSyncToCalendar: true,
          calendarId: selectedCalendarId,
          calendarEventId: result.eventId,
          syncedAt: new Date().toISOString()
        })
        setAutoSyncToCalendar(true)
      }
    } catch (error) {
      console.error('发布到日历失败:', error)
    }
  }

  const handleApplySuggestion = (suggestion: { start: string; end: string }) => {
    form.setFieldsValue({
      targetTime: dayjs(suggestion.start)
    })
    setShowFreeTimeSuggestions(false)
  }

  const tabItems = [
    {
      key: 'basic',
      label: (
        <Space>
          <InfoCircleOutlined />
          基本信息
        </Space>
      ),
      children: (
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {!task && (
            <Form.Item
              label={
                <Space>
                  <FileTextOutlined />
                  从模板创建
                </Space>
              }
              tooltip="选择一个模板快速填充任务配置"
            >
              <Select
                value={selectedTemplateId}
                onChange={(value) => {
                  setSelectedTemplateId(value)
                  handleTemplateSelect(value)
                }}
                placeholder="选择模板快速创建..."
                allowClear
                style={{ width: '100%' }}
                optionLabelProp="label"
              >
                {templates.map((template) => (
                  <Option key={template.id} value={template.id} label={template.name}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Tag color={categoryColors[template.category]} style={{ margin: 0 }}>
                          {categoryLabels[template.category]}
                        </Tag>
                        <span>{template.name}</span>
                        {template.isBuiltIn && <Tag color="blue" style={{ margin: 0 }}>内置</Tag>}
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {template.taskTitle}
                      </Text>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="title"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="例如：每日晨会提醒" maxLength={50} showCount />
          </Form.Item>

          <Form.Item name="description" label="任务描述">
            <TextArea placeholder="输入任务详细描述..." rows={2} maxLength={200} showCount />
          </Form.Item>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="targetTime"
                label="开始时间"
                rules={[{ required: true, message: '请选择开始时间' }]}
              >
                <DatePicker
                  showTime
                  style={{ width: '100%' }}
                  placeholder="选择日期和时间"
                  format="YYYY-MM-DD HH:mm"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="duration"
                label="持续时间（分钟）"
              >
                <InputNumber min={5} max={1440} style={{ width: '100%' }} placeholder="例如：30" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="优先级"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                <Select>
                  {(Object.keys(priorityLabels) as TaskPriority[]).map((priority) => (
                    <Option key={priority} value={priority}>
                      <Space>
                        <Tag color={priorityColors[priority]} style={{ margin: 0 }} />
                        {priorityLabels[priority]}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tag"
                label="标签"
                rules={[{ required: true, message: '请选择标签' }]}
              >
                <Select>
                  {(Object.keys(tagLabels) as TaskTag[]).map((tag) => (
                    <Option key={tag} value={tag}>
                      <Space>
                        <Tag color={tagColors[tag]} style={{ margin: 0 }} />
                        {tagLabels[tag]}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="repeatType" label="重复方式">
            <Select>
              <Option value="none">不重复</Option>
              <Option value="daily">每天</Option>
              <Option value="weekly">每周</Option>
              <Option value="monthly">每月</Option>
              <Option value="custom">自定义间隔</Option>
            </Select>
          </Form.Item>

          {repeatType === 'weekly' && (
            <Form.Item name="repeatDays" label="选择星期">
              <Checkbox.Group>
                <Row>
                  {weekDays.map((day) => (
                    <Col span={8} key={day.value}>
                      <Checkbox value={day.value}>{day.label}</Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
            </Form.Item>
          )}

          {repeatType === 'custom' && (
            <Form.Item
              name="repeatInterval"
              label="重复间隔（分钟）"
              rules={[{ required: true, message: '请输入间隔时间' }]}
            >
              <InputNumber min={1} max={10080} style={{ width: '100%' }} placeholder="例如：60" />
            </Form.Item>
          )}

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="enabled" label="启用任务" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="soundEnabled" label="声音提醒" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          {showConflictAlert && (
            <Alert
              message="日程冲突警告"
              description={
                <div>
                  <p>检测到与以下日历事件存在时间重叠：</p>
                  <List
                    size="small"
                    dataSource={conflicts}
                    renderItem={(conflict) => (
                      <List.Item>
                        <Space>
                          <WarningOutlined style={{ color: conflict.severity === 'conflict' ? '#ff4d4f' : '#faad14' }} />
                          <span>
                            <Text strong>{conflict.eventTitle}</Text>
                            <Text type="secondary" style={{ marginLeft: 8 }}>
                              {dayjs(conflict.overlappingStart).format('HH:mm')} - {dayjs(conflict.overlappingEnd).format('HH:mm')}
                            </Text>
                            <Tag color={conflict.severity === 'conflict' ? 'red' : 'orange'} style={{ marginLeft: 8 }}>
                              {conflict.severity === 'conflict' ? '严重冲突' : '轻微重叠'}
                            </Tag>
                          </span>
                        </Space>
                      </List.Item>
                    )}
                  />
                </div>
              }
              type="warning"
              showIcon
              closable
              onClose={() => setShowConflictAlert(false)}
              style={{ marginBottom: 16 }}
              action={
                showFreeTimeSuggestions && (
                  <Button size="small" type="link" onClick={() => setShowFreeTimeSuggestions(true)}>
                    查看空闲时间建议
                  </Button>
                )
              }
            />
          )}

          {showFreeTimeSuggestions && freeTimeSuggestions.length > 0 && (
            <Alert
              message="空闲时间建议"
              description={
                <div>
                  <p>以下时段可用，点击快速选择：</p>
                  <List
                    size="small"
                    dataSource={freeTimeSuggestions}
                    renderItem={(suggestion, index) => (
                      <List.Item
                        actions={[
                          <Button size="small" type="primary" onClick={() => handleApplySuggestion(suggestion)}>
                            选择
                          </Button>
                        ]}
                      >
                        <Space>
                          <BulbOutlined style={{ color: '#1890ff' }} />
                          <span>
                            <Text strong>建议 {index + 1}：</Text>
                            <Text>
                              {dayjs(suggestion.start).format('MM-DD HH:mm')} - {dayjs(suggestion.end).format('HH:mm')}
                            </Text>
                            <Tag color="green" style={{ marginLeft: 8 }}>
                              匹配度 {suggestion.score}%
                            </Tag>
                          </span>
                        </Space>
                      </List.Item>
                    )}
                  />
                </div>
              }
              type="info"
              showIcon
              closable
              onClose={() => setShowFreeTimeSuggestions(false)}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            label={
              <Space>
                <CalendarOutlined />
                日历同步
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Row gutter={24}>
                <Col span={12}>
                  <Space>
                    <Switch
                      checked={autoSyncToCalendar}
                      onChange={setAutoSyncToCalendar}
                    />
                    <Text>保存时自动同步到日历</Text>
                  </Space>
                </Col>
                <Col span={12}>
                  <Space>
                    {isMeeting && (
                      <Tag color="blue" icon={<VideoCameraOutlined />}>
                        自动识别为会议
                      </Tag>
                    )}
                  </Space>
                </Col>
              </Row>

              {autoSyncToCalendar && (
                <Select
                  value={selectedCalendarId}
                  onChange={setSelectedCalendarId}
                  placeholder="选择要同步到的日历"
                  style={{ width: '100%' }}
                >
                  {calendars.map((calendar) => (
                    <Option key={calendar.id} value={calendar.id}>
                      <Space>
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: calendar.color,
                            display: 'inline-block'
                          }}
                        />
                        <span>{calendar.name}</span>
                        {calendar.isDefault && <Tag color="blue">默认</Tag>}
                      </Space>
                    </Option>
                  ))}
                </Select>
              )}

              {calendarSync && calendarSync.syncedAt && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <SyncOutlined spin={isSyncing} /> 上次同步：{dayjs(calendarSync.syncedAt).format('YYYY-MM-DD HH:mm')}
                </Text>
              )}

              <Button
                type="dashed"
                icon={<CalendarOutlined />}
                onClick={handleSyncToCalendar}
                loading={isSyncing}
                disabled={!selectedCalendarId}
              >
                {calendarSync?.calendarEventId ? '更新到日历' : '一键发布到日历'}
              </Button>
            </Space>
          </Form.Item>

          {soundEnabled && (
            <Form.Item
              name="soundId"
              label={
                <Space>
                  <SoundOutlined />
                  提醒铃声
                </Space>
              }
              tooltip="选择该任务的提醒铃声，不选则使用全局默认铃声"
            >
              <Select
                placeholder="使用全局默认铃声"
                allowClear
                optionLabelProp="label"
                style={{ width: '100%' }}
              >
                <Option value="" label={`默认 (${sounds.find(s => s.id === defaultSoundId)?.name || '轻柔'})`}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <span>使用全局默认铃声</span>
                    <Tooltip title={playingSoundId === defaultSoundId ? '暂停' : '播放'}>
                      <Button
                        type="text"
                        size="small"
                        icon={playingSoundId === defaultSoundId ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        style={{
                          color: playingSoundId === defaultSoundId ? '#1677ff' : undefined
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTogglePlaySound(defaultSoundId)
                        }}
                      />
                    </Tooltip>
                  </Space>
                </Option>
                {sounds.map((sound) => (
                  <Option key={sound.id} value={sound.id} label={sound.name}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <span>{sound.name}</span>
                        {!sound.isBuiltIn && (
                          <span style={{ color: '#9254de', fontSize: 12 }}>自定义</span>
                        )}
                      </Space>
                      <Tooltip title={playingSoundId === sound.id ? '暂停' : '播放'}>
                        <Button
                          type="text"
                          size="small"
                          icon={playingSoundId === sound.id ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                          style={{
                            color: playingSoundId === sound.id ? '#1677ff' : undefined
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTogglePlaySound(sound.id)
                          }}
                        />
                      </Tooltip>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      )
    },
    {
      key: 'notes',
      label: (
        <Space>
          <EditTwoTone />
          备注
          {notes && <Badge dot color="#1677ff" />}
        </Space>
      ),
      children: (
        <div style={{ marginTop: 16 }}>
          <RichTextEditor
            value={notes}
            onChange={setNotes}
            placeholder="在此输入任务备注，可以添加详细说明、会议记录、待办事项等内容..."
            minHeight={200}
          />
        </div>
      )
    },
    {
      key: 'links',
      label: (
        <Space>
          <LinkOutlined />
          外部链接
          {links.length > 0 && <Badge count={links.length} size="small" />}
        </Space>
      ),
      children: (
        <div style={{ marginTop: 16 }}>
          <LinkManager
            links={links}
            onChange={setLinks}
          />
        </div>
      )
    },
    {
      key: 'attachments',
      label: (
        <Space>
          <PaperClipOutlined />
          附件
          {attachments.length > 0 && <Badge count={attachments.length} size="small" />}
        </Space>
      ),
      children: (
        <div style={{ marginTop: 16 }}>
          <AttachmentManager
            attachments={attachments}
            onChange={setAttachments}
          />
        </div>
      )
    }
  ]

  return (
    <Modal
      title={task ? '编辑任务' : '新建任务'}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="保存"
      cancelText="取消"
      width={600}
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />
    </Modal>
  )
}
