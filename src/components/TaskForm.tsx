import React, { useEffect } from 'react'
import { Modal, Form, Input, DatePicker, Select, Switch, InputNumber, Row, Col, Checkbox } from 'antd'
import dayjs from 'dayjs'
import type { Task, TaskRepeatType } from '../types'

const { TextArea } = Input
const { Option } = Select

interface TaskFormProps {
  open: boolean
  task: Task | null
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

export const TaskForm: React.FC<TaskFormProps> = ({ open, task, onCancel, onSubmit }) => {
  const [form] = Form.useForm()
  const repeatType = Form.useWatch('repeatType', form)

  useEffect(() => {
    if (open) {
      if (task) {
        form.setFieldsValue({
          title: task.title,
          description: task.description,
          targetTime: dayjs(task.targetTime),
          repeatType: task.repeatType,
          repeatInterval: task.repeatInterval,
          repeatDays: task.repeatDays,
          enabled: task.enabled,
          soundEnabled: task.soundEnabled
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          repeatType: 'none',
          enabled: true,
          soundEnabled: true,
          targetTime: dayjs().add(1, 'hour')
        })
      }
    }
  }, [open, task, form])

  const handleOk = () => {
    form.validateFields().then((values) => {
      const taskData: Omit<Task, 'id' | 'createdAt'> = {
        title: values.title,
        description: values.description || '',
        targetTime: values.targetTime.toISOString(),
        repeatType: values.repeatType,
        repeatInterval: values.repeatInterval,
        repeatDays: values.repeatDays,
        enabled: values.enabled,
        soundEnabled: values.soundEnabled
      }
      onSubmit(taskData)
      form.resetFields()
    })
  }

  return (
    <Modal
      title={task ? '编辑任务' : '新建任务'}
      open={open}
      onCancel={onCancel}
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
          />
        </Form.Item>

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
      </Form>
    </Modal>
  )
}
