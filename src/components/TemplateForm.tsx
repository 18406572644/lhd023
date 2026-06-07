import React, { useEffect } from 'react'
import { Modal, Form, Input, Select, Switch, InputNumber, Row, Col, Checkbox, Space, Tag } from 'antd'
import type { TaskTemplate, TemplateCategory, TaskPriority, TaskTag } from '../types'
import { priorityColors, priorityLabels, tagColors, tagLabels, categoryColors, categoryLabels } from '../utils/constants'

const { TextArea } = Input
const { Option } = Select

const weekDays = [
  { label: '周日', value: 0 },
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 }
]

interface TemplateFormProps {
  open: boolean
  template: TaskTemplate | null
  onCancel: () => void
  onSubmit: (template: Omit<TaskTemplate, 'id' | 'createdAt' | 'isBuiltIn'>) => void
}

export const TemplateForm: React.FC<TemplateFormProps> = ({ open, template, onCancel, onSubmit }) => {
  const [form] = Form.useForm()
  const repeatType = Form.useWatch('repeatType', form)

  useEffect(() => {
    if (open) {
      if (template) {
        form.setFieldsValue({
          name: template.name,
          description: template.description,
          category: template.category,
          taskTitle: template.taskTitle,
          taskDescription: template.taskDescription,
          targetTime: template.targetTime,
          repeatType: template.repeatType,
          repeatInterval: template.repeatInterval,
          repeatDays: template.repeatDays,
          soundEnabled: template.soundEnabled,
          soundId: template.soundId,
          priority: template.priority,
          tag: template.tag,
          duration: template.duration
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          category: 'other',
          repeatType: 'none',
          soundEnabled: true,
          priority: 'medium',
          tag: 'work',
          duration: 30,
          targetTime: '09:00'
        })
      }
    }
  }, [open, template, form])

  const handleOk = () => {
    form.validateFields().then((values) => {
      const templateData: Omit<TaskTemplate, 'id' | 'createdAt' | 'isBuiltIn'> = {
        name: values.name,
        description: values.description || '',
        category: values.category,
        taskTitle: values.taskTitle,
        taskDescription: values.taskDescription || '',
        targetTime: values.targetTime,
        repeatType: values.repeatType,
        repeatInterval: values.repeatInterval,
        repeatDays: values.repeatDays,
        soundEnabled: values.soundEnabled,
        soundId: values.soundId,
        priority: values.priority,
        tag: values.tag,
        duration: values.duration
      }
      onSubmit(templateData)
      form.resetFields()
    })
  }

  const handleCancel = () => {
    onCancel()
  }

  return (
    <Modal
      title={template ? '编辑模板' : '创建模板'}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="保存"
      cancelText="取消"
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
        <Form.Item
          name="name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        >
          <Input placeholder="例如：每日晨会模板" maxLength={50} showCount />
        </Form.Item>

        <Form.Item name="description" label="模板描述">
          <TextArea placeholder="输入模板描述..." rows={2} maxLength={200} showCount />
        </Form.Item>

        <Form.Item
          name="category"
          label="模板分类"
          rules={[{ required: true, message: '请选择模板分类' }]}
        >
          <Select>
            {(Object.keys(categoryLabels) as TemplateCategory[]).map((category) => (
              <Option key={category} value={category}>
                <Space>
                  <Tag color={categoryColors[category]} style={{ margin: 0 }} />
                  {categoryLabels[category]}
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="taskTitle"
          label="任务名称"
          rules={[{ required: true, message: '请输入任务名称' }]}
        >
          <Input placeholder="例如：每日晨会" maxLength={50} showCount />
        </Form.Item>

        <Form.Item name="taskDescription" label="任务描述">
          <TextArea placeholder="输入任务详细描述..." rows={2} maxLength={200} showCount />
        </Form.Item>

        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="targetTime"
              label="目标时间"
              rules={[{ required: true, message: '请选择目标时间' }]}
            >
              <Input type="time" style={{ width: '100%' }} />
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

        <Form.Item name="soundEnabled" label="声音提醒" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}
