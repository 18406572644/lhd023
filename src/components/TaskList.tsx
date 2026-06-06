import React from 'react'
import { List, Switch, Button, Tag, Space, Tooltip, Typography } from 'antd'
import { EditOutlined, DeleteOutlined, BellOutlined, ClockCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Task } from '../types'
import { getNextTriggerTime } from '../utils/scheduler'

const { Text, Paragraph } = Typography

interface TaskListProps {
  tasks: Task[]
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
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

export const TaskList: React.FC<TaskListProps> = ({ tasks, onEdit, onDelete, onToggle }) => {
  const getNextTimeText = (task: Task): string => {
    const nextTime = getNextTriggerTime(task)
    if (!nextTime) return '已过期'
    return nextTime.format('YYYY-MM-DD HH:mm')
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
    <List
      dataSource={tasks}
      renderItem={(task) => {
        const nextTime = getNextTriggerTime(task)
        const isExpired = !nextTime

        return (
          <List.Item
            key={task.id}
            style={{
              padding: '16px 20px',
              marginBottom: 12,
              borderRadius: 8,
              backgroundColor: '#fff',
              border: '1px solid #f0f0f0',
              opacity: isExpired ? 0.6 : 1
            }}
            actions={[
              <Tooltip title={task.enabled ? '禁用' : '启用'} key="toggle">
                <Switch
                  checked={task.enabled}
                  onChange={(checked) => onToggle(task.id, checked)}
                  size="small"
                />
              </Tooltip>,
              <Tooltip title="编辑" key="edit">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => onEdit(task)}
                  size="small"
                />
              </Tooltip>,
              <Tooltip title="删除" key="delete">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onDelete(task.id)}
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
                    backgroundColor: task.enabled ? '#1677ff' : '#d9d9d9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff'
                  }}
                >
                  <BellOutlined style={{ fontSize: 20 }} />
                </div>
              }
              title={
                <Space>
                  <Text strong style={{ fontSize: 15 }}>
                    {task.title}
                  </Text>
                  <Tag color={repeatTypeColors[task.repeatType]}>
                    {repeatTypeLabels[task.repeatType]}
                  </Tag>
                  {task.soundEnabled && <Tag color="gold">声音</Tag>}
                  {isExpired && <Tag color="red">已过期</Tag>}
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
                  </Space>
                </div>
              }
            />
          </List.Item>
        )
      }}
    />
  )
}
