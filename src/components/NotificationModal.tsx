import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Modal, Typography, Button, Space, Tag, Tooltip, Progress } from 'antd'
import { BellOutlined, CheckOutlined, ClockCircleOutlined, SoundOutlined, PauseCircleOutlined, PlayCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { PendingReminder } from '../types'
import { soundManager } from '../utils/soundManager'
import { reminderManager } from '../utils/reminderManager'

const { Title, Paragraph, Text } = Typography

interface NotificationModalProps {
  open: boolean
  reminder: PendingReminder | null
  onClose: () => void
  onSnooze: (minutes: number) => void
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  open,
  reminder,
  onClose,
  onSnooze
}) => {
  const hasPlayedRef = useRef(false)
  const [soundDisplay, setSoundDisplay] = useState('')
  const [isSoundPlaying, setIsSoundPlaying] = useState(false)
  const [animationKey, setAnimationKey] = useState(0)

  const task = reminder?.task || null
  const priority = task?.priority || 'medium'
  const config = reminderManager.getReminderLevelConfig(priority)
  const priorityColor = reminderManager.getPriorityColor(priority)
  const priorityLabel = reminderManager.getPriorityLabel(priority)
  const animationClass = reminderManager.getAnimationClass(config.animation)
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
    if (open && task) {
      hasPlayedRef.current = false
      setAnimationKey(prev => prev + 1)
      if (task.soundEnabled) {
        setTimeout(() => {
          playSound()
        }, 100)
      }
    }
    return () => {
      hasPlayedRef.current = false
      soundManager.stopSound()
    }
  }, [open, task, playSound])

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

  const modalWidth = priority === 'urgent' ? 520 : priority === 'high' ? 480 : 440

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={modalWidth}
      centered
      destroyOnClose
      maskClosable={priority !== 'urgent'}
      closable={priority !== 'urgent'}
      keyboard={priority !== 'urgent'}
      className={`${animationClass}`}
      key={animationKey}
      style={{
        top: priority === 'urgent' ? '45%' : '50%'
      }}
    >
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div
          style={{
            width: priority === 'urgent' ? 80 : 64,
            height: priority === 'urgent' ? 80 : 64,
            borderRadius: '50%',
            backgroundColor: `${priorityColor}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            border: `3px solid ${priorityColor}30`,
            animation: priority === 'urgent' 
              ? 'reminder-pulse-urgent 0.8s ease-in-out infinite' 
              : priority === 'high'
                ? 'reminder-pulse 1.2s ease-in-out infinite'
                : 'none'
          }}
        >
          {priority === 'urgent' ? (
            <ExclamationCircleOutlined style={{ fontSize: 48, color: priorityColor }} />
          ) : (
            <BellOutlined style={{ fontSize: priority === 'high' ? 48 : 32, color: priorityColor }} />
          )}
        </div>

        <Space style={{ marginBottom: 12 }}>
          <Tag 
            color={priority === 'urgent' ? 'red' : priority === 'high' ? 'orange' : priority === 'medium' ? 'blue' : 'green'}
            style={{
              fontSize: 14,
              padding: '4px 12px',
              borderRadius: 4
            }}
          >
            {priorityLabel}
          </Tag>
          {reminder.reminderCount > 1 && (
            <Tag color="warning">
              第 {reminder.reminderCount} 次提醒
            </Tag>
          )}
        </Space>

        <Title 
          level={priority === 'urgent' ? 3 : 4} 
          style={{ 
            margin: '0 0 8px 0', 
            color: priority === 'urgent' ? priorityColor : undefined 
          }}
        >
          {task.title}
        </Title>

        <Paragraph 
          type="secondary" 
          style={{ 
            marginBottom: 20, 
            minHeight: 48,
            fontSize: priority === 'urgent' ? 16 : 14
          }}
        >
          {task.description || '时间到了，请处理该任务'}
        </Paragraph>

        {reminder.reminderCount > 1 && (
          <div style={{ marginBottom: 16 }}>
            <Progress 
              percent={urgencyProgress} 
              size="small"
              strokeColor={priorityColor}
              showInfo={false}
              style={{ width: 200, margin: '0 auto 8px' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              提醒进度: {reminder.reminderCount}/{reminderManager.getSettings().maxReminderCount}
            </Text>
          </div>
        )}

        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {dayjs(reminder.triggeredAt).format('YYYY-MM-DD HH:mm:ss')}
        </Text>

        {task.soundEnabled && soundDisplay && (
          <div style={{ marginBottom: 20 }}>
            <Tag color="gold" style={{ marginRight: 8 }}>
              <SoundOutlined style={{ marginRight: 4 }} />
              {soundDisplay}
            </Tag>
            <Tooltip title={isSoundPlaying ? '暂停' : '播放'}>
              <Button
                size="small"
                icon={isSoundPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={handleToggleSound}
                type="text"
                style={{
                  color: isSoundPlaying ? '#1677ff' : undefined
                }}
              >
                {isSoundPlaying ? '暂停' : '播放'}
              </Button>
            </Tooltip>
          </div>
        )}

        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Button
            type="primary"
            size="large"
            icon={<CheckOutlined />}
            onClick={handleClose}
            style={{ 
              width: '100%', 
              height: priority === 'urgent' ? 52 : 44,
              fontSize: priority === 'urgent' ? 16 : 14,
              backgroundColor: priority === 'urgent' ? priorityColor : undefined
            }}
            danger={priority === 'urgent'}
          >
            {priority === 'urgent' ? '确认处理（必须点击）' : '我知道了'}
          </Button>

          {config.snoozeEnabled && snoozeOptions.length > 0 && (
            <Space style={{ width: '100%', justifyContent: 'center' }}>
              <Text type="secondary" style={{ marginRight: 8 }}>
                稍后提醒:
              </Text>
              {snoozeOptions.map((minutes) => (
                <Button
                  key={minutes}
                  size="small"
                  onClick={() => handleSnooze(minutes)}
                  disabled={priority === 'urgent' && minutes < 3}
                >
                  {minutes}分钟
                </Button>
              ))}
            </Space>
          )}
        </Space>
      </div>

      <style>{`
        @keyframes reminder-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.4); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(22, 119, 255, 0); }
        }

        @keyframes reminder-pulse-urgent {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.6); }
          50% { transform: scale(1.1); box-shadow: 0 0 0 15px rgba(255, 77, 79, 0); }
        }

        .reminder-animation-slide-in {
          animation: reminder-slide-in 0.3s ease-out;
        }

        @keyframes reminder-slide-in {
          from {
            opacity: 0;
            transform: translateY(-50px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .reminder-animation-bounce {
          animation: reminder-bounce 0.5s ease-out;
        }

        @keyframes reminder-bounce {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .reminder-animation-flash {
          animation: reminder-flash 0.1s ease-in-out 3;
        }

        @keyframes reminder-flash {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .reminder-animation-fade-in {
          animation: reminder-fade-in 0.4s ease-out;
        }

        @keyframes reminder-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .reminder-animation-zoom-in {
          animation: reminder-zoom-in 0.3s ease-out;
        }

        @keyframes reminder-zoom-in {
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
    </Modal>
  )
}
