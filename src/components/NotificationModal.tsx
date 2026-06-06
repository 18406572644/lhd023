import React, { useEffect, useRef } from 'react'
import { Modal, Typography, Button, Space } from 'antd'
import { BellOutlined, CheckOutlined, ClockCircleOutlined } from '@ant-design/icons'
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

export const NotificationModal: React.FC<NotificationModalProps> = ({
  open,
  task,
  onClose,
  onSnooze
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (open && task?.soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    }
  }, [open, task])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  if (!task) return null

  const handleSnooze = (minutes: number) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    onSnooze(minutes)
  }

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    onClose()
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
      <audio ref={audioRef} preload="auto">
        <source src="/notification.wav" type="audio/wav" />
      </audio>
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
            margin: '0 auto 20px'
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
    </Modal>
  )
}
