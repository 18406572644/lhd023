import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Modal, Typography, Button, Space, Tag, Tooltip } from 'antd'
import { BellOutlined, CheckOutlined, ClockCircleOutlined, SoundOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Task } from '../types'
import { soundManager } from '../utils/soundManager'

const { Title, Paragraph, Text } = Typography

interface NotificationModalProps {
  open: boolean
  task: Task | null
  onClose: () => void
  onSnooze: (minutes: number) => void
}

const snoozeOptions = [5, 10, 30, 60]

export const NotificationModal: React.FC<NotificationModalProps> = ({
  open,
  task,
  onClose,
  onSnooze
}) => {
  const hasPlayedRef = useRef(false)
  const [soundDisplay, setSoundDisplay] = useState('')
  const [isSoundPlaying, setIsSoundPlaying] = useState(false)

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

  if (!task) return null

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

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={440}
      centered
      destroyOnClose
      maskClosable={false}
    >
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: '#e6f4ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
        >
          <BellOutlined style={{ fontSize: 32, color: '#1677ff' }} />
        </div>

        <Title level={4} style={{ margin: '0 0 8px 0' }}>
          {task.title}
        </Title>

        <Paragraph type="secondary" style={{ marginBottom: 24, minHeight: 48 }}>
          {task.description || '时间到了，请处理该任务'}
        </Paragraph>

        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {dayjs().format('YYYY-MM-DD HH:mm')}
        </Text>

        {task.soundEnabled && soundDisplay && (
          <div style={{ marginBottom: 16 }}>
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
            style={{ width: '100%', height: 44 }}
          >
            我知道了
          </Button>

          <Space style={{ width: '100%', justifyContent: 'center' }}>
            <Text type="secondary" style={{ marginRight: 8 }}>
              稍后提醒:
            </Text>
            {snoozeOptions.map((minutes) => (
              <Button
                key={minutes}
                size="small"
                onClick={() => handleSnooze(minutes)}
              >
                {minutes}分钟
              </Button>
            ))}
          </Space>
        </Space>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </Modal>
  )
}
