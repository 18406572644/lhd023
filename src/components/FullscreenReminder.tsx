import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Button, Typography, Tag, Space, Progress } from 'antd'
import { ExclamationCircleOutlined, CheckOutlined, ClockCircleOutlined, SoundOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { PendingReminder } from '../types'
import { soundManager } from '../utils/soundManager'
import { reminderManager } from '../utils/reminderManager'

const { Title, Paragraph, Text } = Typography

interface FullscreenReminderProps {
  reminder: PendingReminder | null
  onClose: () => void
  onSnooze: (minutes: number) => void
}

export const FullscreenReminder: React.FC<FullscreenReminderProps> = ({
  reminder,
  onClose,
  onSnooze
}) => {
  const hasPlayedRef = useRef(false)
  const [soundDisplay, setSoundDisplay] = useState('')
  const [isSoundPlaying, setIsSoundPlaying] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const task = reminder?.task || null
  const priority = task?.priority || 'urgent'
  const priorityColor = reminderManager.getPriorityColor(priority)
  const priorityLabel = reminderManager.getPriorityLabel(priority)
  const snoozeOptions = reminder ? reminderManager.getSnoozeOptions(task!.priority) : []

  const playSound = useCallback(async () => {
    if (!hasPlayedRef.current && task) {
      hasPlayedRef.current = true
      await soundManager.playTaskSound(task)
    }
  }, [task])

  useEffect(() => {
    const unsubscribe = soundManager.subscribeToPlayState((_, isPlaying) => {
      setIsSoundPlaying(isPlaying)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadSoundDisplay = async () => {
      if (task?.soundEnabled) {
        if (!task.soundId) {
          const defaultId = await soundManager.getDefaultSoundId()
          const sound = await soundManager.getSoundById(defaultId)
          setSoundDisplay(`默认 (${sound?.name || '轻柔'})`)
        } else {
          const sound = await soundManager.getSoundById(task.soundId)
          setSoundDisplay(sound?.name || '未知铃声')
        }
      } else {
        setSoundDisplay('')
      }
    }
    loadSoundDisplay()
  }, [task])

  useEffect(() => {
    if (reminder && task) {
      hasPlayedRef.current = false
      if (task.soundEnabled) {
        setTimeout(() => {
          playSound()
        }, 100)
      }

      if (window.api?.windowState?.setFullScreen) {
        window.api.windowState.setFullScreen(true)
      }
      if (window.api?.windowState?.setAlwaysOnTop) {
        window.api.windowState.setAlwaysOnTop(true)
      }

      setCountdown(10)
      const countdownTimer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownTimer)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => {
        clearInterval(countdownTimer)
        hasPlayedRef.current = false
        soundManager.stopSound()
        if (window.api?.windowState?.setFullScreen) {
          window.api.windowState.setFullScreen(false)
        }
        if (window.api?.windowState?.setAlwaysOnTop) {
          window.api.windowState.setAlwaysOnTop(false)
        }
      }
    }
  }, [reminder, task, playSound])

  if (!reminder || !task) return null

  const handleSnooze = (minutes: number) => {
    hasPlayedRef.current = false
    soundManager.stopSound()
    onSnooze(minutes)
  }

  const handleClose = () => {
    hasPlayedRef.current = false
    soundManager.stopSound()
    onClose()
  }

  const handleToggleSound = async () => {
    if (isSoundPlaying) {
      soundManager.pauseSound()
    } else {
      hasPlayedRef.current = false
      await soundManager.playTaskSound(task)
    }
  }

  const urgencyProgress = reminder.reminderCount > 0
    ? Math.min((reminder.reminderCount / reminderManager.getSettings().maxReminderCount) * 100, 100)
    : 0

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000000',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        animation: 'fullscreen-flash 0.3s ease-in-out 3'
      }}
    >
      <div
        style={{
          maxWidth: 800,
          width: '90%',
          textAlign: 'center',
          color: '#ffffff',
          animation: 'fullscreen-zoom-in 0.5s ease-out'
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 77, 79, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            border: `4px solid ${priorityColor}`,
            animation: 'fullscreen-pulse 1s ease-in-out infinite'
          }}
        >
          <ExclamationCircleOutlined style={{ fontSize: 72, color: priorityColor }} />
        </div>

        <Space style={{ marginBottom: 24, justifyContent: 'center' }}>
          <Tag
            color="red"
            style={{
              fontSize: 18,
              padding: '8px 20px',
              borderRadius: 6
            }}
          >
            {priorityLabel}
          </Tag>
          {reminder.reminderCount > 1 && (
            <Tag color="warning" style={{ fontSize: 16, padding: '6px 16px' }}>
              第 {reminder.reminderCount} 次提醒
            </Tag>
          )}
        </Space>

        <Title
          level={1}
          style={{
            color: '#ffffff',
            marginBottom: 16,
            fontSize: 48,
            fontWeight: 'bold'
          }}
        >
          {task.title}
        </Title>

        <Paragraph
          style={{
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: 20,
            marginBottom: 32,
            minHeight: 60
          }}
        >
          {task.description || '这是一个紧急任务，请立即处理！'}
        </Paragraph>

        {reminder.reminderCount > 1 && (
          <div style={{ marginBottom: 24 }}>
            <Progress
              percent={urgencyProgress}
              strokeColor={priorityColor}
              trailColor="rgba(255, 255, 255, 0.2)"
              style={{ width: 300, margin: '0 auto 8px' }}
            />
            <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
              提醒进度: {reminder.reminderCount}/{reminderManager.getSettings().maxReminderCount}
            </Text>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 16 }}>
            <ClockCircleOutlined style={{ marginRight: 8 }} />
            {dayjs(reminder.triggeredAt).format('YYYY-MM-DD HH:mm:ss')}
          </Text>
        </div>

        {task.soundEnabled && soundDisplay && (
          <div style={{ marginBottom: 32 }}>
            <Tag color="gold" style={{ marginRight: 12, fontSize: 16, padding: '6px 16px' }}>
              <SoundOutlined style={{ marginRight: 6 }} />
              {soundDisplay}
            </Tag>
            <Button
              size="large"
              icon={isSoundPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={handleToggleSound}
              style={{
                color: isSoundPlaying ? '#1677ff' : '#ffffff',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                fontSize: 16
              }}
            >
              {isSoundPlaying ? '暂停铃声' : '播放铃声'}
            </Button>
          </div>
        )}

        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Button
            type="primary"
            size="large"
            icon={<CheckOutlined />}
            onClick={handleClose}
            style={{
              width: '80%',
              height: 64,
              fontSize: 22,
              backgroundColor: priorityColor,
              borderColor: priorityColor
            }}
            danger
          >
            确认已处理（必须点击）
          </Button>

          {snoozeOptions.length > 0 && (
            <div>
              <Text style={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', marginBottom: 12, fontSize: 16 }}>
                稍后提醒（不推荐）:
              </Text>
              <Space wrap style={{ justifyContent: 'center' }}>
                {snoozeOptions.map((minutes) => (
                  <Button
                    key={minutes}
                    size="large"
                    onClick={() => handleSnooze(minutes)}
                    disabled={minutes < 3}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      color: '#ffffff',
                      fontSize: 16,
                      padding: '0 24px'
                    }}
                  >
                    {minutes}分钟
                  </Button>
                ))}
              </Space>
            </div>
          )}

          {countdown > 0 && (
            <div style={{ marginTop: 24 }}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 14 }}>
                {countdown} 秒后将自动重播提醒
              </Text>
            </div>
          )}
        </Space>
      </div>

      <style>{`
        @keyframes fullscreen-pulse {
          0%, 100% { 
            transform: scale(1); 
            box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.8); 
          }
          50% { 
            transform: scale(1.1); 
            box-shadow: 0 0 0 30px rgba(255, 77, 79, 0); 
          }
        }

        @keyframes fullscreen-flash {
          0%, 100% {
            background-color: #000000;
          }
          50% {
            background-color: #330000;
          }
        }

        @keyframes fullscreen-zoom-in {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )
}
