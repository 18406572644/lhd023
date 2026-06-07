import React, { useState } from 'react'
import { Drawer, Tabs, Tag, Space, Typography, Button, Divider, Row, Col, Switch, Tooltip, Badge } from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  BellOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  SoundOutlined,
  FileTextOutlined,
  LinkOutlined,
  PaperClipOutlined,
  EditTwoTone
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Task } from '../types'
import { RichTextEditor } from './RichTextEditor'
import { LinkManager } from './LinkManager'
import { AttachmentManager } from './AttachmentManager'
import { getNextTriggerTime } from '../utils/scheduler'
import { priorityColors, priorityLabels, tagColors, tagLabels } from '../utils/constants'

const { Title, Text, Paragraph } = Typography

interface TaskDetailPanelProps {
  open: boolean
  task: Task | null
  onClose: () => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
  onUpdate: (task: Task) => void
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

export const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  open,
  task,
  onClose,
  onEdit,
  onDelete,
  onToggle,
  onUpdate
}) => {
  const [notes, setNotes] = useState('')
  const [links, setLinks] = useState<Task['links']>([])
  const [attachments, setAttachments] = useState<Task['attachments']>([])

  const handleNotesChange = (value: string) => {
    setNotes(value)
    if (task) {
      onUpdate({ ...task, notes: value })
    }
  }

  const handleLinksChange = (newLinks: Task['links']) => {
    setLinks(newLinks)
    if (task) {
      onUpdate({ ...task, links: newLinks })
    }
  }

  const handleAttachmentsChange = (newAttachments: Task['attachments']) => {
    setAttachments(newAttachments)
    if (task) {
      onUpdate({ ...task, attachments: newAttachments })
    }
  }

  React.useEffect(() => {
    if (task) {
      setNotes(task.notes || '')
      setLinks(task.links || [])
      setAttachments(task.attachments || [])
    }
  }, [task])

  if (!task) return null

  const nextTime = getNextTriggerTime(task)
  const isExpired = !nextTime

  const getNextTimeText = (): string => {
    if (!nextTime) return '已过期'
    return nextTime.format('YYYY-MM-DD HH:mm')
  }

  const getRepeatDescription = (): string => {
    switch (task.repeatType) {
      case 'none':
        return '不重复'
      case 'daily':
        return '每天重复'
      case 'weekly':
        if (task.repeatDays && task.repeatDays.length > 0) {
          const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
          return `每周 ${task.repeatDays.map(d => weekDays[d]).join('、')} 重复`
        }
        return '每周重复'
      case 'monthly':
        return '每月重复'
      case 'custom':
        if (task.repeatInterval) {
          return `每 ${task.repeatInterval} 分钟重复`
        }
        return '自定义间隔重复'
      default:
        return ''
    }
  }

  const tabItems = [
    {
      key: 'overview',
      label: (
        <Space>
          <FileTextOutlined />
          基本信息
        </Space>
      ),
      children: (
        <div style={{ padding: '16px 0' }}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>任务描述</Text>
                <Paragraph style={{ marginTop: 4, fontSize: 14, lineHeight: 1.6 }}>
                  {task.description || '暂无描述'}
                </Paragraph>
              </div>
            </Col>

            <Col span={12}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>下次提醒</Text>
                <div style={{ marginTop: 4 }}>
                  <Space>
                    <ClockCircleOutlined style={{ color: isExpired ? '#ff4d4f' : '#1677ff' }} />
                    <Text strong style={{ color: isExpired ? '#ff4d4f' : undefined }}>
                      {getNextTimeText()}
                    </Text>
                  </Space>
                </div>
              </div>
            </Col>

            <Col span={12}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>开始时间</Text>
                <div style={{ marginTop: 4 }}>
                  <Space>
                    <CalendarOutlined />
                    <Text>
                      {dayjs(task.targetTime).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  </Space>
                </div>
              </div>
            </Col>

            <Col span={12}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>重复方式</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={repeatTypeColors[task.repeatType]}>
                    {repeatTypeLabels[task.repeatType]}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    {getRepeatDescription()}
                  </Text>
                </div>
              </div>
            </Col>

            <Col span={12}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>持续时间</Text>
                <div style={{ marginTop: 4 }}>
                  <Text>{task.duration ? `${task.duration} 分钟` : '未设置'}</Text>
                </div>
              </div>
            </Col>

            <Col span={12}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>优先级</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={priorityColors[task.priority]}>
                    {priorityLabels[task.priority]}优先级
                  </Tag>
                </div>
              </div>
            </Col>

            <Col span={12}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>标签</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={tagColors[task.tag]}>
                    {tagLabels[task.tag]}
                  </Tag>
                </div>
              </div>
            </Col>

            <Col span={12}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>声音提醒</Text>
                <div style={{ marginTop: 4 }}>
                  {task.soundEnabled ? (
                    <Space>
                      <SoundOutlined style={{ color: '#faad14' }} />
                      <Text>已开启</Text>
                    </Space>
                  ) : (
                    <Text type="secondary">已关闭</Text>
                  )}
                </div>
              </div>
            </Col>

            <Col span={12}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>任务状态</Text>
                <div style={{ marginTop: 4 }}>
                  <Space>
                    <Badge status={task.enabled ? 'success' : 'default'} />
                    <Text>{task.enabled ? '运行中' : '已禁用'}</Text>
                    {isExpired && task.enabled && (
                      <Tag color="red">已过期</Tag>
                    )}
                  </Space>
                </div>
              </div>
            </Col>
          </Row>

          <Divider style={{ margin: '24px 0 16px 0' }} />

          <Row gutter={[16, 8]}>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>创建时间</Text>
              <div style={{ marginTop: 4 }}>
                <Text>{dayjs(task.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
              </div>
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>任务ID</Text>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" copyable={{ text: task.id }}>
                  {task.id.slice(0, 8)}...
                </Text>
              </div>
            </Col>
          </Row>
        </div>
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
        <div style={{ padding: '16px 0' }}>
          <RichTextEditor
            value={notes}
            onChange={handleNotesChange}
            placeholder="在此输入任务备注，可以添加详细说明、会议记录、待办事项等内容..."
            minHeight={300}
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
        <div style={{ padding: '16px 0' }}>
          <LinkManager
            links={links}
            onChange={handleLinksChange}
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
        <div style={{ padding: '16px 0' }}>
          <AttachmentManager
            attachments={attachments}
            onChange={handleAttachmentsChange}
          />
        </div>
      )
    }
  ]

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: task.enabled
                ? priorityColors[task.priority]
                : '#d9d9d9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}
          >
            <BellOutlined style={{ fontSize: 18 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Title level={5} style={{ margin: 0, fontSize: 16 }} ellipsis>
              {task.title}
            </Title>
            <Space wrap size={4} style={{ marginTop: 2 }}>
              <Tag color={repeatTypeColors[task.repeatType]} style={{ margin: 0 }}>
                {repeatTypeLabels[task.repeatType]}
              </Tag>
              <Tag color={tagColors[task.tag]} style={{ margin: 0 }}>
                {tagLabels[task.tag]}
              </Tag>
              <Tag color={priorityColors[task.priority]} style={{ margin: 0 }}>
                {priorityLabels[task.priority]}
              </Tag>
            </Space>
          </div>
        </div>
      }
      placement="right"
      width={640}
      open={open}
      onClose={onClose}
      extra={
        <Space>
          <Tooltip title={task.enabled ? '禁用任务' : '启用任务'}>
            <Switch
              checked={task.enabled}
              onChange={(checked) => onToggle(task.id, checked)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="编辑任务">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(task)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="删除任务">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                onDelete(task.id)
                onClose()
              }}
              size="small"
            />
          </Tooltip>
        </Space>
      }
    >
      <Tabs
        defaultActiveKey="overview"
        items={tabItems}
        size="large"
        style={{ marginTop: 16 }}
      />
    </Drawer>
  )
}
