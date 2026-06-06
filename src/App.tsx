import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Layout, Typography, Button, Tabs, Badge, ConfigProvider, message, Space, Tooltip } from 'antd'
import { PlusOutlined, HistoryOutlined, BellOutlined, LogoutOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Task, TaskHistory } from './types'
import { storage } from './utils/storage'
import { shouldTriggerTask, generateId, getNextTriggerTime } from './utils/scheduler'
import { TaskForm } from './components/TaskForm'
import { TaskList } from './components/TaskList'
import { HistoryPanel } from './components/HistoryPanel'
import { NotificationModal } from './components/NotificationModal'

const { Header, Content } = Layout
const { Title, Text } = Typography

const DEBUG = true

function log(...args: any[]) {
  if (DEBUG) {
    console.log('[TaskReminder]', ...args)
  }
}

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [history, setHistory] = useState<TaskHistory[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifyingTask, setNotifyingTask] = useState<Task | null>(null)
  const [activeTab, setActiveTab] = useState('tasks')
  const triggeredTasksRef = useRef<Set<string>>(new Set())
  const intervalRef = useRef<number | null>(null)
  const tasksRef = useRef<Task[]>([])
  const historyRef = useRef<TaskHistory[]>([])

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    historyRef.current = history
  }, [history])

  const loadData = useCallback(async () => {
    log('加载数据...')
    const [loadedTasks, loadedHistory] = await Promise.all([
      storage.getTasks(),
      storage.getHistory()
    ])
    setTasks(loadedTasks)
    setHistory(loadedHistory)
    log('加载完成，任务数:', loadedTasks.length, '历史记录数:', loadedHistory.length)
  }, [])

  const requestNotificationPermission = useCallback(async () => {
    const permission = await storage.requestNotificationPermission()
    if (permission === 'granted') {
      message.success('通知权限已开启')
    } else if (permission === 'denied') {
      message.warning('通知权限被拒绝，将仅显示弹窗提醒')
    }
  }, [])

  useEffect(() => {
    loadData()
    requestNotificationPermission()
  }, [loadData, requestNotificationPermission])

  const saveTasks = useCallback(async (newTasks: Task[]) => {
    setTasks(newTasks)
    await storage.saveTasks(newTasks)
  }, [])

  const saveHistory = useCallback(async (newHistory: TaskHistory[]) => {
    setHistory(newHistory)
    await storage.saveHistory(newHistory)
  }, [])

  const addHistoryRecord = useCallback(async (task: Task, status: TaskHistory['status'] = 'completed') => {
    const record: TaskHistory = {
      id: generateId(),
      taskId: task.id,
      taskTitle: task.title,
      triggeredAt: dayjs().toISOString(),
      status
    }
    const newHistory = [record, ...historyRef.current].slice(0, 500)
    await saveHistory(newHistory)
    log('添加历史记录:', task.title, status)
  }, [saveHistory])

  const triggerTestNotification = useCallback(() => {
    log('手动触发测试提醒')
    const testTask: Task = {
      id: 'test-' + Date.now(),
      title: '🔔 测试提醒',
      description: '这是一条测试提醒，用于验证通知功能是否正常工作！',
      targetTime: dayjs().toISOString(),
      repeatType: 'none',
      enabled: true,
      createdAt: dayjs().toISOString(),
      soundEnabled: true
    }

    setNotifyingTask(testTask)
    setNotificationOpen(true)
    storage.notify('测试提醒', '这是一条测试提醒，用于验证通知功能是否正常工作！')
    addHistoryRecord(testTask, 'completed')
  }, [addHistoryRecord])

  const createTestTask = useCallback(() => {
    const testTask: Task = {
      id: generateId(),
      title: '⏰ 测试任务（1分钟后）',
      description: '这是一个自动创建的测试任务，将在1分钟后触发提醒',
      targetTime: dayjs().add(1, 'minute').toISOString(),
      repeatType: 'none',
      enabled: true,
      createdAt: dayjs().toISOString(),
      soundEnabled: true
    }
    saveTasks([...tasks, testTask])
    message.success('测试任务已创建，将在1分钟后触发提醒')
    log('创建测试任务:', testTask.title, '触发时间:', dayjs(testTask.targetTime).format('YYYY-MM-DD HH:mm:ss'))
  }, [tasks, saveTasks])

  const checkTasks = useCallback(() => {
    const now = dayjs()
    const currentTasks = tasksRef.current

    log('检查任务，当前时间:', now.format('YYYY-MM-DD HH:mm:ss'))
    log('待检查任务数:', currentTasks.length)

    currentTasks.forEach((task) => {
      if (!task.enabled) {
        log('跳过已禁用任务:', task.title)
        return
      }

      const shouldTrigger = shouldTriggerTask(task, now)
      const alreadyTriggered = triggeredTasksRef.current.has(task.id)

      log('检查任务:', task.title, '应触发:', shouldTrigger, '已触发:', alreadyTriggered, '目标时间:', dayjs(task.targetTime).format('YYYY-MM-DD HH:mm'))

      if (shouldTrigger && !alreadyTriggered) {
        log('===== 触发任务 =====')
        log('任务名称:', task.title)
        log('任务描述:', task.description)

        triggeredTasksRef.current.add(task.id)
        setNotifyingTask(task)
        setNotificationOpen(true)

        storage.notify('任务提醒', task.title).catch(err => {
          log('发送系统通知:', err || '成功')
        })

        addHistoryRecord(task, 'completed')

        if (task.repeatType === 'none') {
          const updatedTasks = currentTasks.map((t) =>
            t.id === task.id ? { ...t, enabled: false } : t
          )
          saveTasks(updatedTasks)
          log('单次任务已自动禁用')
        }

        setTimeout(() => {
          triggeredTasksRef.current.delete(task.id)
          log('任务触发锁已释放:', task.title)
        }, 300000)
      }
    })
  }, [addHistoryRecord, saveTasks])

  useEffect(() => {
    log('启动任务调度器，每10秒检查一次')
    checkTasks()

    const runCheck = () => {
      checkTasks()
    }

    intervalRef.current = window.setInterval(runCheck, 10000)

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        log('页面变为可见，立即检查任务')
        runCheck()
      }
    }

    const handleOnline = () => {
      log('网络恢复，立即检查任务')
      runCheck()
    }

    const handleFocus = () => {
      log('窗口获得焦点，立即检查任务')
      runCheck()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleFocus)

    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').catch((err: any) => {
        log('无法获取屏幕常亮锁:', err)
      })
    }

    return () => {
      log('清理调度器')
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', handleFocus)
    }
  }, [checkTasks])

  const handleAddTask = () => {
    setEditingTask(null)
    setFormOpen(true)
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setFormOpen(true)
  }

  const handleDeleteTask = async (id: string) => {
    const newTasks = tasks.filter((t) => t.id !== id)
    await saveTasks(newTasks)
    message.success('任务已删除')
  }

  const handleToggleTask = async (id: string, enabled: boolean) => {
    const newTasks = tasks.map((t) =>
      t.id === id ? { ...t, enabled } : t
    )
    await saveTasks(newTasks)
  }

  const handleFormSubmit = async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    if (editingTask) {
      const updatedTasks = tasks.map((t) =>
        t.id === editingTask.id
          ? { ...t, ...taskData }
          : t
      )
      await saveTasks(updatedTasks)
      message.success('任务已更新')
    } else {
      const newTask: Task = {
        id: generateId(),
        createdAt: dayjs().toISOString(),
        ...taskData
      }
      await saveTasks([...tasks, newTask])
      message.success('任务已创建')
    }
    setFormOpen(false)
    setEditingTask(null)
  }

  const handleSnooze = (minutes: number) => {
    if (notifyingTask) {
      const snoozedTask: Task = {
        ...notifyingTask,
        targetTime: dayjs().add(minutes, 'minute').toISOString(),
        repeatType: 'none'
      }
      const updatedTasks = tasks.map((t) =>
        t.id === notifyingTask.id ? snoozedTask : t
      )
      saveTasks(updatedTasks)
      addHistoryRecord(notifyingTask, 'skipped')
      message.success(`将在 ${minutes} 分钟后再次提醒`)
    }
    setNotificationOpen(false)
    setNotifyingTask(null)
  }

  const handleNotificationClose = () => {
    setNotificationOpen(false)
    setNotifyingTask(null)
  }

  const handleClearHistory = async () => {
    await saveHistory([])
    message.success('历史记录已清空')
  }

  const handleQuit = async () => {
    if (window.api?.quit) {
      await window.api.quit()
    }
  }

  const enabledTasksCount = tasks.filter((t) => t.enabled && getNextTriggerTime(t)).length

  const tabItems = [
    {
      key: 'tasks',
      label: (
        <Space>
          <BellOutlined />
          任务列表
          {enabledTasksCount > 0 && (
            <Badge count={enabledTasksCount} size="small" />
          )}
        </Space>
      ),
      children: (
        <TaskList
          tasks={[...tasks].sort((a, b) => {
            const aNext = getNextTriggerTime(a)
            const bNext = getNextTriggerTime(b)
            if (!aNext && !bNext) return 0
            if (!aNext) return 1
            if (!bNext) return -1
            return aNext.valueOf() - bNext.valueOf()
          })}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
          onToggle={handleToggleTask}
        />
      )
    },
    {
      key: 'history',
      label: (
        <Space>
          <HistoryOutlined />
          历史记录
          {history.length > 0 && (
            <Badge count={history.length} size="small" />
          )}
        </Space>
      ),
      children: <HistoryPanel history={history} onClear={handleClearHistory} />
    }
  ]

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
            headerHeight: 64,
            headerPadding: '0 24px'
          }
        }
      }}
    >
      <Layout style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            padding: '0 24px'
          }}
        >
          <Space>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: '#1677ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}
            >
              <BellOutlined style={{ fontSize: 18 }} />
            </div>
            <div>
              <Title level={5} style={{ margin: 0, fontSize: 16 }}>
                任务提醒
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                高效管理您的时间
              </Text>
            </div>
          </Space>

          <Space>
            <Button
              onClick={triggerTestNotification}
              size="middle"
            >
              测试提醒
            </Button>
            <Button
              onClick={createTestTask}
              size="middle"
            >
              创建测试任务
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddTask}
              size="middle"
            >
              新建任务
            </Button>
            <Tooltip title="退出应用">
              <Button
                icon={<LogoutOutlined />}
                onClick={handleQuit}
                size="middle"
                danger
              />
            </Tooltip>
          </Space>
        </Header>

        <Content style={{ padding: '24px' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
            style={{ backgroundColor: '#fff', padding: '0 24px', borderRadius: 8 }}
          />
        </Content>
      </Layout>

      <TaskForm
        open={formOpen}
        task={editingTask}
        onCancel={() => {
          setFormOpen(false)
          setEditingTask(null)
        }}
        onSubmit={handleFormSubmit}
      />

      <NotificationModal
        open={notificationOpen}
        task={notifyingTask}
        onClose={handleNotificationClose}
        onSnooze={handleSnooze}
      />
    </ConfigProvider>
  )
}

export default App
