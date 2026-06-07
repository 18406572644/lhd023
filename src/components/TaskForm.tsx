import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, DatePicker, Select, Switch, InputNumber, Row, Col, Checkbox, Button, Space, Tooltip, Tag } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined, SoundOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Task, SoundOption, TaskPriority, TaskTag } from '../types'
import { soundManager } from '../utils/soundManager'
import { priorityColors, priorityLabels, tagColors, tagLabels } from '../utils/constants'

const { TextArea } = Input
const { Option } = Select

interface TaskFormProps {
  open: boolean
  task: Task | null
  defaultTime?: dayjs.Dayjs | null
  onCancel: () => void
  onSubmit: (task: Omit<Task, 'id' | 'createdAt'>) => void
}

const weekDays = [
  { label: '周日', value: 0 },
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 }
]

export const TaskForm: React.FC<TaskFormProps> = ({ open, task, defaultTime, onCancel, onSubmit }) => {
  const [form] = Form.useForm()
  const [sounds, setSounds] = useState<SoundOption[]>([])
  const [defaultSoundId, setDefaultSoundId] = useState<string>('')
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null)
  const repeatType = Form.useWatch('repeatType', form)
  const soundEnabled = Form.useWatch('soundEnabled', form)

  useEffect(() => {
    const loadSounds = async () => {
      const [loadedSounds, loadedDefault] = await Promise.all([
        soundManager.getAllSounds(),
        soundManager.getDefaultSoundId()
      ])
      setSounds(loadedSounds)
      setDefaultSoundId(loadedDefault)
    }
    loadSounds()
  }, [])

  useEffect(() => {
    if (open) {
      const unsubscribe = soundManager.subscribeToPlayState((soundId, isPlaying) => {
        setPlayingSoundId(isPlaying ? soundId : null)
      })
      if (task) {
        form.setFieldsValue({
          title: task.title,
          description: task.description,
          targetTime: dayjs(task.targetTime),
          repeatType: task.repeatType,
          repeatInterval: task.repeatInterval,
          repeatDays: task.repeatDays,
          enabled: task.enabled,
          soundEnabled: task.soundEnabled,
          soundId: task.soundId,
          priority: task.priority,
          tag: task.tag,
          duration: task.duration
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          repeatType: 'none',
          enabled: true,
          soundEnabled: true,
          targetTime: defaultTime || dayjs().add(1, 'hour'),
          priority: 'medium',
          tag: 'work',
          duration: 30
        })
      }
      return () => {
        unsubscribe()
        soundManager.stopSound()
      }
    }
  }, [open, task, form])

  const handleOk = () => {
    soundManager.stopSound()
    form.validateFields().then((values) => {
      const taskData: Omit<Task, 'id' | 'createdAt'> = {
        title: values.title,
        description: values.description || '',
        targetTime: values.targetTime.toISOString(),
        repeatType: values.repeatType,
        repeatInterval: values.repeatInterval,
        repeatDays: values.repeatDays,
        enabled: values.enabled,
        soundEnabled: values.soundEnabled,
        soundId: values.soundId,
        priority: values.priority,
        tag: values.tag,
        duration: values.duration
      }
      onSubmit(taskData)
      form.resetFields()
    })
  }

  const handleCancel = () => {
    soundManager.stopSound()
    onCancel()
  }

  const handleTogglePlaySound = (soundId: string) => {
    const sound = sounds.find(s => s.id === soundId)
    if (sound) {
      soundManager.toggleSound(sound)
    }
  }

  return (
    <Modal
      title={task ? '编辑任务' : '新建任务'}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="保存"
      cancelText="取消"
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
        <Form.Item
          name="title"
          label="任务名称"
          rules={[{ required: true, message: '请输入任务名称' }]}
        >
          <Input placeholder="例如：每日晨会提醒" maxLength={50} showCount />
        </Form.Item>

        <Form.Item name="description" label="任务描述">
          <TextArea placeholder="输入任务详细描述..." rows={2} maxLength={200} showCount />
        </Form.Item>

        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="targetTime"
              label="开始时间"
              rules={[{ required: true, message: '请选择开始时间' }]}
            >
              <DatePicker
                showTime
                style={{ width: '100%' }}
                placeholder="选择日期和时间"
                format="YYYY-MM-DD HH:mm"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="duration"
              label="持续时间（分钟）"
            >
              <InputNumber min={5} max={1440} style={{ width: '100%' }} placeholder="例如：30" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="priority"
              label="优先级"
              rules={[{ required: true, message: '请选择优先级' }]}
            >
              <Select>
                {(Object.keys(priorityLabels) as TaskPriority[]).map((priority) => (
                  <Option key={priority} value={priority}>
                    <Space>
                      <Tag color={priorityColors[priority]} style={{ margin: 0 }} />
                      {priorityLabels[priority]}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="tag"
              label="标签"
              rules={[{ required: true, message: '请选择标签' }]}
            >
              <Select>
                {(Object.keys(tagLabels) as TaskTag[]).map((tag) => (
                  <Option key={tag} value={tag}>
                    <Space>
                      <Tag color={tagColors[tag]} style={{ margin: 0 }} />
                      {tagLabels[tag]}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="repeatType" label="重复方式">
          <Select>
            <Option value="none">不重复</Option>
            <Option value="daily">每天</Option>
            <Option value="weekly">每周</Option>
            <Option value="monthly">每月</Option>
            <Option value="custom">自定义间隔</Option>
          </Select>
        </Form.Item>

        {repeatType === 'weekly' && (
          <Form.Item name="repeatDays" label="选择星期">
            <Checkbox.Group>
              <Row>
                {weekDays.map((day) => (
                  <Col span={8} key={day.value}>
                    <Checkbox value={day.value}>{day.label}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
        )}

        {repeatType === 'custom' && (
          <Form.Item
            name="repeatInterval"
            label="重复间隔（分钟）"
            rules={[{ required: true, message: '请输入间隔时间' }]}
          >
            <InputNumber min={1} max={10080} style={{ width: '100%' }} placeholder="例如：60" />
          </Form.Item>
        )}

        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="enabled" label="启用任务" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="soundEnabled" label="声音提醒" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        {soundEnabled && (
          <Form.Item
            name="soundId"
            label={
              <Space>
                <SoundOutlined />
                提醒铃声
              </Space>
            }
            tooltip="选择该任务的提醒铃声，不选则使用全局默认铃声"
          >
            <Select
              placeholder="使用全局默认铃声"
              allowClear
              optionLabelProp="label"
              style={{ width: '100%' }}
            >
              <Option value="" label={`默认 (${sounds.find(s => s.id === defaultSoundId)?.name || '轻柔'})`}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span>使用全局默认铃声</span>
                  <Tooltip title={playingSoundId === defaultSoundId ? '暂停' : '播放'}>
                    <Button
                      type="text"
                      size="small"
                      icon={playingSoundId === defaultSoundId ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                      style={{
                        color: playingSoundId === defaultSoundId ? '#1677ff' : undefined
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTogglePlaySound(defaultSoundId)
                      }}
                    />
                  </Tooltip>
                </Space>
              </Option>
              {sounds.map((sound) => (
                <Option key={sound.id} value={sound.id} label={sound.name}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <span>{sound.name}</span>
                      {!sound.isBuiltIn && (
                        <span style={{ color: '#9254de', fontSize: 12 }}>自定义</span>
                      )}
                    </Space>
                    <Tooltip title={playingSoundId === sound.id ? '暂停' : '播放'}>
                      <Button
                        type="text"
                        size="small"
                        icon={playingSoundId === sound.id ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        style={{
                          color: playingSoundId === sound.id ? '#1677ff' : undefined
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTogglePlaySound(sound.id)
                        }}
                      />
                    </Tooltip>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
