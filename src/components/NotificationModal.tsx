import React, { useEffect, useRef, useCallback } from 'react'
import { Modal, Typography, Button, Space } from 'antd'
import { BellOutlined, CheckOutlined, ClockCircleOutlined, SoundOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Task } from '../types'

const { Title, Paragraph, Text } = Typography

interface NotificationModalProps {
  open: boolean
  task: Task | null
  onClose: () => void
  onSnooze: (minutes: number) => void
}

const snoozeOptions = [5, 10, 30, 60]

function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) {
      console.warn('浏览器不支持 Web Audio API')
      return
    }

    const audioContext = new AudioContext()

    const playTone = (frequency: number, startTime: number, duration: number, volume: number = 0.3) => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = frequency
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02)
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration)

      oscillator.start(startTime)
      oscillator.stop(startTime + duration)
    }

    const now = audioContext.currentTime
    playTone(880, now, 0.15, 0.3)
    playTone(880, now + 0.25, 0.15, 0.3)
    playTone(1100, now + 0.5, 0.3, 0.4)

    setTimeout(() => {
      audioContext.close()
    }, 2000)
  } catch (err) {
    console.error('播放声音失败:', err)
  }
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  open,
  task,
  onClose,
  onSnooze
}) => {
  const hasPlayedRef = useRef(false)

  const playSound = useCallback(() => {
    if (!hasPlayedRef.current) {
      hasPlayedRef.current = true
      playNotificationSound()
    }
  }, [])

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
    }
  }, [open, task, playSound])

  if (!task) return null

  const handleSnooze = (minutes: number) => {
    hasPlayedRef.current = false
    onSnooze(minutes)
  }

  const handleClose = () => {
    hasPlayedRef.current = false
    onClose()
  }

  const handleTestSound = () => {
    playNotificationSound()
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

        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {dayjs().format('YYYY-MM-DD HH:mm')}
        </Text>

        {task.soundEnabled && (
          <div style={{ marginBottom: 16 }}>
            <Button
              size="small"
              icon={<SoundOutlined />}
              onClick={handleTestSound}
              type="text"
            >
              测试声音
            </Button>
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
