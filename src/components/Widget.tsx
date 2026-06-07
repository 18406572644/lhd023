import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Checkbox, Button, Dropdown, Space, Typography, Tag, Tooltip, Menu } from 'antd'
import {
  BellOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  AppstoreOutlined,
  SmallDashOutlined,
  BorderOutlined,
  ColumnWidthOutlined,
  PushpinOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Task, WidgetSize, WidgetSizeConfig } from '../types'
import { storage } from '../utils/storage'
import { getNextTriggerTime, generateId } from '../utils/scheduler'
import { priorityColors, priorityLabels, tagColors, tagLabels, getTaskColor } from '../utils/constants'

const { Text, Title } = Typography

const WIDGET_SIZE_CONFIGS: Record<WidgetSize, WidgetSizeConfig> = {
  small: { width: 280, height: 320, maxTasks: 3 },
  medium: { width: 340, height: 480, maxTasks: 6 },
  large: { width: 400, height: 600, maxTasks: 10 }
}

const SNOOZE_OPTIONS = [5, 10, 15, 30, 60]

const isElectron = () => {
  return typeof window !== 'undefined' && window.api !== undefined
}

export const Widget: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [widgetSize, setWidgetSize] = useState<WidgetSize>('medium')
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const tasksRef = useRef<Task[]>([])
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const isRightClickingRef = useRef(false)

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  const loadTasks = useCallback(async () => {
    try {
      const loadedTasks = await storage.getTasks()
      const todayTasks = loadedTasks
        .filter(task => {
          if (!task.enabled) return false
          const nextTime = getNextTriggerTime(task)
          if (!nextTime) return false
          return nextTime.isSame(dayjs(), 'day') || nextTime.isBefore(dayjs().endOf('day'))
        })
        .sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1
          if (!a.isPinned && b.isPinned) return 1
          if (a.isPinned && b.isPinned) {
            const aNext = getNextTriggerTime(a)
            const bNext = getNextTriggerTime(b)
            if (!aNext && !bNext) return 0
            if (!aNext) return 1
            if (!bNext) return -1
            return aNext.valueOf() - bNext.valueOf()
          }
          const aNext = getNextTriggerTime(a)
          const bNext = getNextTriggerTime(b)
          if (!aNext && !bNext) return 0
          if (!aNext) return 1
          if (!bNext) return -1
          return aNext.valueOf() - bNext.valueOf()
        })

      const sizeConfig = WIDGET_SIZE_CONFIGS[widgetSize]
      setTasks(todayTasks.slice(0, sizeConfig.maxTasks))
    } catch (err) {
      console.error('加载任务失败:', err)
    }
  }, [widgetSize])

  const loadWidgetConfig = useCallback(async () => {
    try {
      if (isElectron() && window.api?.widget?.getConfig) {
        const config = await window.api.widget.getConfig()
        setWidgetSize(config.size)
      }
    } catch (err) {
      console.error('加载小组件配置失败:', err)
    }
  }, [])

  useEffect(() => {
    loadWidgetConfig()
    loadTasks()

    let unsubscribe: (() => void) | null = null
    if (isElectron() && window.api?.widget?.onTaskUpdateRequested) {
      unsubscribe = window.api.widget.onTaskUpdateRequested(() => {
        loadTasks()
      })
    }

    const interval = setInterval(() => {
      loadTasks()
    }, 30000)

    return () => {
      clearInterval(interval)
      if (unsubscribe) unsubscribe()
    }
  }, [loadTasks, loadWidgetConfig])

  const handleCompleteTask = useCallback(async (task: Task) => {
    try {
      const historyRecord = {
        id: generateId(),
        taskId: task.id,
        taskTitle: task.title,
        triggeredAt: dayjs().toISOString(),
        status: 'completed' as const
      }

      const history = await storage.getHistory()
      await storage.saveHistory([historyRecord, ...history].slice(0, 500))

      let updatedTasks = tasksRef.current.map(t =>
        t.id === task.id ? { ...t, enabled: t.repeatType !== 'none' } : t
      )

      if (task.repeatType !== 'none') {
        const nextTime = getNextTriggerTime(task, dayjs().add(1, 'minute'))
        if (nextTime) {
          updatedTasks = updatedTasks.map(t =>
            t.id === task.id ? { ...t, targetTime: nextTime.toISOString() } : t
          )
        }
      }

      await storage.saveTasks(updatedTasks)
      setTasks(prev => prev.filter(t => t.id !== task.id))

      if (isElectron() && window.api?.widget?.broadcastTaskUpdate) {
        await window.api.widget.broadcastTaskUpdate()
      }
    } catch (err) {
      console.error('完成任务失败:', err)
    }
  }, [])

  const handleSnoozeTask = useCallback(async (task: Task, minutes: number) => {
    try {
      const snoozedTime = dayjs().add(minutes, 'minute').toISOString()
      const updatedTasks = tasksRef.current.map(t =>
        t.id === task.id ? { ...t, targetTime: snoozedTime } : t
      )

      await storage.saveTasks(updatedTasks)

      const historyRecord = {
        id: generateId(),
        taskId: task.id,
        taskTitle: task.title,
        triggeredAt: dayjs().toISOString(),
        status: 'skipped' as const
      }

      const history = await storage.getHistory()
      await storage.saveHistory([historyRecord, ...history].slice(0, 500))

      loadTasks()

      if (isElectron() && window.api?.widget?.broadcastTaskUpdate) {
        await window.api.widget.broadcastTaskUpdate()
      }
    } catch (err) {
      console.error('延时任务失败:', err)
    }
  }, [loadTasks])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isRightClickingRef.current = true
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setContextMenuVisible(true)
    setTimeout(() => {
      isRightClickingRef.current = false
    }, 100)
  }

  const handleDocumentClick = useCallback((e: MouseEvent) => {
    if (isRightClickingRef.current) return
    if (contextMenuRef.current && contextMenuRef.current.contains(e.target as Node)) {
      return
    }
    setContextMenuVisible(false)
  }, [])

  useEffect(() => {
    if (contextMenuVisible) {
      document.addEventListener('mousedown', handleDocumentClick)
      document.addEventListener('contextmenu', handleDocumentClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('contextmenu', handleDocumentClick)
    }
  }, [contextMenuVisible, handleDocumentClick])

  const handleChangeSize = useCallback(async (size: WidgetSize) => {
    try {
      setWidgetSize(size)
      if (isElectron() && window.api?.widget?.setSize) {
        await window.api.widget.setSize(size)
      }
    } catch (err) {
      console.error('切换尺寸失败:', err)
    }
  }, [])

  const handleOpenMainWindow = useCallback(async () => {
    try {
      if (isElectron() && window.api?.widget?.showMainWindow) {
        await window.api.widget.showMainWindow()
      }
    } catch (err) {
      console.error('打开主窗口失败:', err)
    }
  }, [])

  const handleCloseWidget = useCallback(async () => {
    try {
      if (isElectron() && window.api?.widget?.close) {
        await window.api.widget.close()
      }
    } catch (err) {
      console.error('关闭小组件失败:', err)
    }
  }, [])

  const handleMenuClick = useCallback(({ key }: { key: string }) => {
    setContextMenuVisible(false)
    setTimeout(() => {
      if (key === 'open') {
        handleOpenMainWindow()
      } else if (key === 'close') {
        handleCloseWidget()
      } else if (key === 'small' || key === 'medium' || key === 'large') {
        handleChangeSize(key as WidgetSize)
      }
    }, 50)
  }, [handleOpenMainWindow, handleCloseWidget, handleChangeSize])

  const getNextTimeText = (task: Task): string => {
    const nextTime = getNextTriggerTime(task)
    if (!nextTime) return '已过期'
    const now = dayjs()
    if (nextTime.isSame(now, 'day')) {
      return `今天 ${nextTime.format('HH:mm')}`
    }
    return nextTime.format('MM-DD HH:mm')
  }

  const renderContextMenu = () => {
    if (!contextMenuVisible || typeof document === 'undefined') return null

    const menuStyle: React.CSSProperties = {
      position: 'fixed',
      left: contextMenuPosition.x,
      top: contextMenuPosition.y,
      zIndex: 99999,
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)',
      borderRadius: 8,
      minWidth: 160,
      backgroundColor: '#fff'
    }

    const menuItems = [
      {
        key: 'size',
        label: '切换大小',
        icon: <ColumnWidthOutlined />,
        children: [
          { key: 'small', label: '小', icon: <SmallDashOutlined /> },
          { key: 'medium', label: '中', icon: <BorderOutlined /> },
          { key: 'large', label: '大', icon: <AppstoreOutlined /> }
        ]
      },
      { type: 'divider' as const },
      {
        key: 'open',
        label: '打开主程序',
        icon: <AppstoreOutlined />
      },
      {
        key: 'close',
        label: '关闭小组件',
        icon: <CloseOutlined />,
        danger: true
      }
    ]

    const menuContent = (
      <div ref={contextMenuRef} style={menuStyle}>
        <Menu
          items={menuItems}
          onClick={handleMenuClick}
          mode="vertical"
          selectable={false}
        />
      </div>
    )

    return createPortal(menuContent, document.body)
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      onContextMenu={handleContextMenu}
    >
      {renderContextMenu()}

      <div
        style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          WebkitAppRegion: 'drag'
        } as React.CSSProperties & { WebkitAppRegion: string }}
      >
        <Space>
          <BellOutlined style={{ fontSize: 16 }} />
          <Title level={5} style={{ margin: 0, color: '#fff', fontSize: 14 }}>
            今日待办
          </Title>
          <Tag color="white" style={{ margin: 0 }}>{tasks.length}</Tag>
        </Space>
        <Space size={4} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion: string }}>
          <Tooltip title="打开主程序">
            <Button
              type="text"
              size="small"
              icon={<AppstoreOutlined />}
              onClick={handleOpenMainWindow}
              style={{ color: '#fff', padding: '4px 8px' }}
            />
          </Tooltip>
          <Tooltip title="关闭">
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={handleCloseWidget}
              style={{ color: '#fff', padding: '4px 8px' }}
            />
          </Tooltip>
        </Space>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: widgetSize === 'small' ? '8px' : '12px',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties & { WebkitAppRegion: string }}
      >
        {tasks.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#999'
            }}
          >
            <ClockCircleOutlined style={{ fontSize: 32, marginBottom: 12 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              暂无今日待办任务
            </Text>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: widgetSize === 'small' ? 6 : 8 }}>
            {tasks.map(task => {
              const nextTime = getNextTriggerTime(task)
              const isExpired = nextTime ? nextTime.isBefore(dayjs()) : true
              const taskColor = getTaskColor(task.priority || 'medium', task.tag || 'other')

              return (
                <div
                  key={task.id}
                  className="task-item"
                  style={{
                    padding: widgetSize === 'small' ? '8px 10px' : '10px 12px',
                    backgroundColor: task.isPinned ? '#f0f7ff' : (isExpired ? '#fff2f0' : '#fff'),
                    borderRadius: 8,
                    border: `1px solid ${task.isPinned ? '#91caff' : (isExpired ? '#ffccc7' : '#f0f0f0')}`,
                    opacity: isExpired ? 0.7 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Checkbox
                      checked={false}
                      onChange={() => handleCompleteTask(task)}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {task.isPinned && (
                          <PushpinOutlined style={{ fontSize: 12, color: '#1677ff', transform: 'rotate(-45deg)' }} />
                        )}
                        <Text
                          strong
                          style={{
                            fontSize: widgetSize === 'small' ? 12 : 13,
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {task.title}
                        </Text>
                        {widgetSize !== 'small' && (
                          <>
                            <Tag
                              color={priorityColors[task.priority]}
                              style={{ margin: 0, fontSize: 10, padding: '0 4px' }}
                            >
                              {priorityLabels[task.priority]}
                            </Tag>
                            <Tag
                              color={tagColors[task.tag]}
                              style={{ margin: 0, fontSize: 10, padding: '0 4px' }}
                            >
                              {tagLabels[task.tag]}
                            </Tag>
                          </>
                        )}
                      </div>

                      {widgetSize !== 'small' && task.description && (
                        <Text
                          type="secondary"
                          style={{
                            fontSize: 11,
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            marginTop: 2
                          }}
                        >
                          {task.description}
                        </Text>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text
                          type={isExpired ? 'danger' : 'secondary'}
                          style={{ fontSize: 11 }}
                        >
                          <ClockCircleOutlined style={{ marginRight: 2 }} />
                          {getNextTimeText(task)}
                        </Text>

                        <Dropdown
                          menu={{
                            items: SNOOZE_OPTIONS.map(min => ({
                              key: min.toString(),
                              label: `${min}分钟后`,
                              onClick: () => handleSnoozeTask(task, min)
                            }))
                          }}
                          trigger={['click']}
                          placement="bottomRight"
                        >
                          <Button
                            type="text"
                            size="small"
                            style={{ fontSize: 11, padding: '0 4px', height: 'auto' }}
                          >
                            延时
                          </Button>
                        </Dropdown>
                      </div>
                    </div>

                    <div
                      style={{
                        width: 4,
                        height: '100%',
                        minHeight: 36,
                        borderRadius: 2,
                        backgroundColor: task.enabled ? taskColor : '#d9d9d9'
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {widgetSize !== 'small' && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #f0f0f0',
            fontSize: 11,
            color: '#999',
            textAlign: 'center'
          }}
        >
          <Text type="secondary">
            右键打开菜单 · 拖拽标题栏移动
          </Text>
        </div>
      )}
    </div>
  )
}
