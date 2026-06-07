import React, { useState, useRef, useEffect } from 'react'
import { Modal, Form, Input, DatePicker, Button, Space, message, Tooltip } from 'antd'
import { AudioOutlined, AudioMutedOutlined, ClockCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Task } from '../types'

interface QuickTaskFormProps {
  open: boolean
  onCancel: () => void
  onSubmit: (task: Omit<Task, 'id' | 'createdAt'>) => void
}

const { TextArea } = Input

export const QuickTaskForm: React.FC<QuickTaskFormProps> = ({ open, onCancel, onSubmit }) => {
  const [form] = Form.useForm()
  const [isRecording, setIsRecording] = useState(false)
  const [quickTimeOptions] = useState([
    { label: '5分钟后', minutes: 5 },
    { label: '15分钟后', minutes: 15 },
    { label: '30分钟后', minutes: 30 },
    { label: '1小时后', minutes: 60 },
    { label: '2小时后', minutes: 120 },
    { label: '明天此时', minutes: 24 * 60 }
  ])
  const recognitionRef = useRef<any>(null)
  const titleInputRef = useRef<any>(null)

  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({
        targetTime: dayjs().add(30, 'minute')
      })
      setTimeout(() => {
        titleInputRef.current?.focus()
      }, 100)
    }
    return () => {
      stopRecording()
    }
  }, [open, form])

  const handleQuickTime = (minutes: number) => {
    form.setFieldsValue({
      targetTime: dayjs().add(minutes, 'minute')
    })
  }

  const isSpeechRecognitionSupported = () => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  }

  const startRecording = () => {
    if (!isSpeechRecognitionSupported()) {
      message.warning('当前浏览器不支持语音识别功能')
      return
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'zh-CN'

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('')
        
        form.setFieldsValue({
          title: transcript
        })
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('语音识别错误:', event.error)
        if (event.error !== 'no-speech') {
          message.error(`语音识别失败: ${event.error}`)
        }
        setIsRecording(false)
      }

      recognitionRef.current.onend = () => {
        setIsRecording(false)
      }

      recognitionRef.current.start()
      setIsRecording(true)
      message.info('正在聆听，请说话...')
    } catch (err) {
      console.error('启动语音识别失败:', err)
      message.error('启动语音识别失败，请重试')
    }
  }

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null
    }
    setIsRecording(false)
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const handleOk = () => {
    stopRecording()
    form.validateFields().then((values) => {
      const taskData: Omit<Task, 'id' | 'createdAt'> = {
        title: values.title,
        description: values.description || '',
        targetTime: values.targetTime.toISOString(),
        repeatType: 'none',
        enabled: true,
        soundEnabled: true,
        priority: 'medium',
        tag: 'work',
        duration: 30,
        notes: '',
        links: [],
        attachments: []
      }
      onSubmit(taskData)
      form.resetFields()
    })
  }

  const handleCancel = () => {
    stopRecording()
    onCancel()
  }

  return (
    <Modal
      title={
        <Space>
          <ClockCircleOutlined />
          快速创建任务
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="创建"
      cancelText="取消"
      width={420}
      destroyOnClose
      centered
      styles={{
        header: {
          borderBottom: '1px solid #f0f0f0',
          paddingBottom: 16
        },
        body: {
          paddingTop: 20
        }
      }}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="任务标题"
          rules={[{ required: true, message: '请输入任务标题' }]}
        >
          <Input
            ref={titleInputRef}
            placeholder="例如：下午3点开会"
            maxLength={50}
            showCount
            suffix={
              <Tooltip title={isSpeechRecognitionSupported() ? (isRecording ? '停止录音' : '语音输入') : '浏览器不支持语音识别'}>
                <Button
                  type="text"
                  icon={isRecording ? <AudioMutedOutlined /> : <AudioOutlined />}
                  onClick={toggleRecording}
                  size="small"
                  danger={isRecording}
                  style={{
                    color: isRecording ? '#ff4d4f' : undefined,
                    animation: isRecording ? 'pulse 1.5s infinite' : undefined
                  }}
                />
              </Tooltip>
            }
          />
        </Form.Item>

        <Form.Item
          name="targetTime"
          label="提醒时间"
          rules={[{ required: true, message: '请选择提醒时间' }]}
        >
          <DatePicker
            showTime
            style={{ width: '100%' }}
            placeholder="选择日期和时间"
            format="YYYY-MM-DD HH:mm"
            minuteStep={5}
          />
        </Form.Item>

        <Form.Item label="快速选择">
          <Space wrap size={[8, 8]}>
            {quickTimeOptions.map((option) => (
              <Button
                key={option.minutes}
                size="small"
                onClick={() => handleQuickTime(option.minutes)}
              >
                {option.label}
              </Button>
            ))}
          </Space>
        </Form.Item>

        <Form.Item name="description" label="补充说明（可选）">
          <TextArea
            placeholder="输入任务详细描述..."
            rows={2}
            maxLength={200}
            showCount
          />
        </Form.Item>
      </Form>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </Modal>
  )
}
