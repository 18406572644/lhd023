import React, { useState, useEffect } from 'react'
import { List, Switch, Button, Tag, Space, Tooltip, Typography, Modal, Form, Input, Select, message } from 'antd'
import { EditOutlined, DeleteOutlined, BellOutlined, ClockCircleOutlined, SoundOutlined, FileTextOutlined, LinkOutlined, PaperClipOutlined, EditTwoTone } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Task, SoundOption, TemplateCategory } from '../types'
import { getNextTriggerTime } from '../utils/scheduler'
import { soundManager } from '../utils/soundManager'
import { storage } from '../utils/storage'
import { priorityColors, priorityLabels, tagColors, tagLabels, getTaskColor, categoryColors, categoryLabels } from '../utils/constants'

const { Text, Paragraph } = Typography

interface TaskListProps {
  tasks: Task[]
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
  onViewDetail: (task: Task) => void
}

const repeatTypeLabels: Record<string, string> = {
  none: '单次',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  custom: '自定义'
}

const repeatTypeColors: Record<string, string> = {
  none: 'default',
  daily: 'blue',
  weekly: 'cyan',
  monthly: 'geekblue',
  custom: 'purple'
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, onEdit, onDelete, onToggle, onViewDetail }) => {
  const [sounds, setSounds] = useState<SoundOption[]>([])
  const [defaultSoundId, setDefaultSoundId] = useState<string>('')
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [templateForm] = Form.useForm()

  useEffect(() => {
    const loadSounds = async () => {
      const [loadedSounds, loadedDefault] = await Promise.all([
        soundManager.getAllSounds(),
        soundManager.getDefaultSoundId()
      ])
      setSounds(loadedSounds)
      setDefaultSoundId(loadedDefault)
    }
    loadSounds()
  }, [])

  const handleSaveAsTemplate = (task: Task) => {
    setSelectedTask(task)
    templateForm.resetFields()
    templateForm.setFieldsValue({
      name: task.title,
      description: task.description,
      category: 'other'
    })
    setSaveTemplateModalOpen(true)
  }

  const handleSaveTemplateSubmit = async () => {
    if (!selectedTask) return
    try {
      const values = await templateForm.validateFields()
      const targetTime = dayjs(selectedTask.targetTime).format('HH:mm')
      await storage.addTemplate({
        name: values.name,
        description: values.description || '',
        category: values.category,
        taskTitle: selectedTask.title,
        taskDescription: selectedTask.description,
        targetTime: targetTime,
        repeatType: selectedTask.repeatType,
        repeatInterval: selectedTask.repeatInterval,
        repeatDays: selectedTask.repeatDays,
        soundEnabled: selectedTask.soundEnabled,
        soundId: selectedTask.soundId,
        priority: selectedTask.priority,
        tag: selectedTask.tag,
        duration: selectedTask.duration
      })
      message.success('已保存为模板')
      setSaveTemplateModalOpen(false)
      setSelectedTask(null)
    } catch (err) {
      console.error('保存模板失败:', err)
      message.error('保存模板失败')
    }
  }

  const getNextTimeText = (task: Task): string => {
    const nextTime = getNextTriggerTime(task)
    if (!nextTime) return '已过期'
    return nextTime.format('YYYY-MM-DD HH:mm')
  }

  const getSoundName = (task: Task): string => {
    if (!task.soundEnabled) return ''
    const soundId = task.soundId || defaultSoundId
    const sound = sounds.find(s => s.id === soundId)
    return sound?.name || '未知'
  }

  if (tasks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
        <ClockCircleOutlined style={{ fontSize: 48, marginBottom: 16 }} />
        <Paragraph type="secondary">暂无任务，点击右上角按钮添加</Paragraph>
      </div>
    )
  }

  return (
    <>
      <List
        dataSource={tasks}
        renderItem={(task) => {
          const nextTime = getNextTriggerTime(task)
          const isExpired = !nextTime
          const hasNotes = !!task.notes && task.notes.length > 0
          const hasLinks = task.links && task.links.length > 0
          const hasAttachments = task.attachments && task.attachments.length > 0

        return (
          <List.Item
            key={task.id}
            style={{
              padding: '16px 20px',
              marginBottom: 12,
              borderRadius: 8,
              backgroundColor: '#fff',
              border: '1px solid #f0f0f0',
              opacity: isExpired ? 0.6 : 1,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            className="task-list-item"
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('button, .ant-switch, .ant-tag')) {
                onViewDetail(task)
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
              e.currentTarget.style.borderColor = '#d9d9d9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderColor = '#f0f0f0'
            }}
            actions={[
              <Tooltip title={task.enabled ? '禁用' : '启用'} key="toggle">
                <Switch
                  checked={task.enabled}
                  onChange={(checked, e) => {
                    e.stopPropagation()
                    onToggle(task.id, checked)
                  }}
                  size="small"
                />
              </Tooltip>,
              <Tooltip title="保存为模板" key="save-template">
                <Button
                  type="text"
                  icon={<FileTextOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSaveAsTemplate(task)
                  }}
                  size="small"
                />
              </Tooltip>,
              <Tooltip title="编辑" key="edit">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(task)
                  }}
                  size="small"
                />
              </Tooltip>,
              <Tooltip title="删除" key="delete">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(task.id)
                  }}
                  size="small"
                />
              </Tooltip>
            ]}
          >
            <List.Item.Meta
                avatar={
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      backgroundColor: task.enabled ? getTaskColor(task.priority || 'medium', task.tag || 'other') : '#d9d9d9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      position: 'relative'
                    }}
                  >
                    <BellOutlined style={{ fontSize: 20 }} />
                    {(hasNotes || hasLinks || hasAttachments) && (
                      <div
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: '#1677ff'
                        }}
                      />
                    )}
                  </div>
                }
                title={
                  <Space wrap>
                    <Text strong style={{ fontSize: 15 }}>
                      {task.title}
                    </Text>
                    <Tag color={repeatTypeColors[task.repeatType]}>
                      {repeatTypeLabels[task.repeatType]}
                    </Tag>
                    {task.tag && (
                      <Tag color={tagColors[task.tag]}>
                        {tagLabels[task.tag]}
                      </Tag>
                    )}
                    {task.priority && (
                      <Tag color={priorityColors[task.priority]}>
                        {priorityLabels[task.priority]}优先级
                      </Tag>
                    )}
                    {task.soundEnabled && (
                      <Tag color="gold">
                        <SoundOutlined style={{ marginRight: 4 }} />
                        {getSoundName(task)}
                      </Tag>
                    )}
                    {isExpired && <Tag color="red">已过期</Tag>}
                    <Space size={4} style={{ marginLeft: 8 }}>
                      {hasNotes && (
                        <Tooltip title="有备注">
                          <EditTwoTone style={{ fontSize: 14 }} />
                        </Tooltip>
                      )}
                      {hasLinks && (
                        <Tooltip title={`${task.links.length} 个链接`}>
                          <LinkOutlined style={{ fontSize: 14, color: '#1677ff' }} />
                        </Tooltip>
                      )}
                      {hasAttachments && (
                        <Tooltip title={`${task.attachments.length} 个附件`}>
                          <PaperClipOutlined style={{ fontSize: 14, color: '#722ed1' }} />
                        </Tooltip>
                      )}
                    </Space>
                  </Space>
                }
              description={
                <div>
                  {task.description && (
                    <Paragraph
                      type="secondary"
                      style={{ margin: '4px 0 8px 0', fontSize: 13 }}
                      ellipsis={{ rows: 1 }}
                    >
                      {task.description}
                    </Paragraph>
                  )}
                  <Space size={24} style={{ fontSize: 12 }}>
                    <Text type="secondary">
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      下次提醒: {getNextTimeText(task)}
                    </Text>
                    <Text type="secondary">
                      创建时间: {dayjs(task.createdAt).format('YYYY-MM-DD HH:mm')}
                    </Text>
                    <Text type="secondary" style={{ marginLeft: 'auto' }}>
                      点击查看详情 →
                    </Text>
                  </Space>
                </div>
              }
            />
          </List.Item>
        )
      }}
    />

    <Modal
      title="保存为模板"
      open={saveTemplateModalOpen}
      onOk={handleSaveTemplateSubmit}
      onCancel={() => {
        setSaveTemplateModalOpen(false)
        setSelectedTask(null)
      }}
      okText="保存"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={templateForm} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        >
          <Input placeholder="例如：每日晨会模板" maxLength={50} showCount />
        </Form.Item>

        <Form.Item name="description" label="模板描述">
          <Input.TextArea placeholder="输入模板描述..." rows={2} maxLength={200} showCount />
        </Form.Item>

        <Form.Item
          name="category"
          label="模板分类"
          rules={[{ required: true, message: '请选择模板分类' }]}
        >
          <Select>
            {(Object.keys(categoryLabels) as TemplateCategory[]).map((category) => (
              <Select.Option key={category} value={category}>
                <Space>
                  <Tag color={categoryColors[category]} style={{ margin: 0 }} />
                  {categoryLabels[category]}
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {selectedTask && (
          <div style={{ padding: 12, backgroundColor: '#f5f7fa', borderRadius: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>将保存以下任务配置：</Text>
            <Space wrap style={{ marginTop: 8 }}>
              <Tag color={priorityColors[selectedTask.priority]}>
                {priorityLabels[selectedTask.priority]}
              </Tag>
              <Tag color={tagColors[selectedTask.tag]}>
                {tagLabels[selectedTask.tag]}
              </Tag>
              <Tag color={repeatTypeColors[selectedTask.repeatType]}>
                {repeatTypeLabels[selectedTask.repeatType]}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                时间: {dayjs(selectedTask.targetTime).format('HH:mm')}
              </Text>
              {selectedTask.duration && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  时长: {selectedTask.duration}分钟
                </Text>
              )}
            </Space>
          </div>
        )}
      </Form>
    </Modal>
    </>
  )
}
