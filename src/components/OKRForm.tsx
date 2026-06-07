import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, Select, DatePicker, Button, Space, Typography, Tag, message, Divider, InputNumber, List } from 'antd'
import { PlusOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type { Objective, KeyResult, OKRPriority, TaskTag, Task, KRType } from '../types'
import { okrPriorityColors, okrPriorityLabels, tagColors, tagLabels, krTypeLabels, krTypeColors } from '../utils/constants'
import { generateId } from '../utils/scheduler'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { TextArea } = Input
const { Option } = Select

interface OKRFormProps {
  open: boolean
  objective: Objective | null
  tasks: Task[]
  onCancel: () => void
  onSubmit: (objectiveData: Omit<Objective, 'id' | 'createdAt' | 'updatedAt' | 'keyResults' | 'notifiedMilestones' | 'status'>, keyResults: Omit<KeyResult, 'id' | 'objectiveId' | 'createdAt' | 'updatedAt'>[]) => void
}

interface KRFormItem {
  tempId: string
  title: string
  description: string
  type: KRType
  targetValue: number
  currentValue: number
  unit: string
  taskId?: string
  sortOrder: number
}

export const OKRForm: React.FC<OKRFormProps> = ({ open, objective, tasks, onCancel, onSubmit }) => {
  const [form] = Form.useForm()
  const [krItems, setKrItems] = useState<KRFormItem[]>([])
  const [editingKR, setEditingKR] = useState<KRFormItem | null>(null)
  const [krFormVisible, setKrFormVisible] = useState(false)
  const [krForm] = Form.useForm()

  useEffect(() => {
    if (open) {
      form.resetFields()
      setKrItems([])
      setEditingKR(null)
      setKrFormVisible(false)
      
      if (objective) {
        form.setFieldsValue({
          title: objective.title,
          description: objective.description,
          dateRange: [dayjs(objective.startDate), dayjs(objective.endDate)],
          priority: objective.priority,
          tags: objective.tags,
          owner: objective.owner || ''
        })
        
        const sortedKRs = [...objective.keyResults].sort((a, b) => a.sortOrder - b.sortOrder)
        setKrItems(sortedKRs.map(kr => ({
          tempId: kr.id,
          title: kr.title,
          description: kr.description,
          type: kr.type,
          targetValue: kr.targetValue,
          currentValue: kr.currentValue,
          unit: kr.unit,
          taskId: kr.taskId,
          sortOrder: kr.sortOrder
        })))
      } else {
        form.setFieldsValue({
          priority: 'medium',
          tags: [],
          dateRange: [dayjs(), dayjs().add(30, 'day')]
        })
        setKrItems([])
      }
    }
  }, [open, objective, form])

  const handleAddKR = () => {
    krForm.resetFields()
    krForm.setFieldsValue({
      type: 'numeric',
      targetValue: 100,
      currentValue: 0,
      unit: '%'
    })
    setEditingKR(null)
    setKrFormVisible(true)
  }

  const handleEditKR = (item: KRFormItem) => {
    krForm.resetFields()
    krForm.setFieldsValue({
      title: item.title,
      description: item.description,
      type: item.type,
      targetValue: item.targetValue,
      currentValue: item.currentValue,
      unit: item.unit,
      taskId: item.taskId
    })
    setEditingKR(item)
    setKrFormVisible(true)
  }

  const handleDeleteKR = (tempId: string) => {
    setKrItems(prev => prev.filter(item => item.tempId !== tempId))
  }

  const handleSaveKR = async () => {
    try {
      const values = await krForm.validateFields()
      
      const newKR: KRFormItem = {
        tempId: editingKR?.tempId || generateId(),
        title: values.title,
        description: values.description || '',
        type: values.type,
        targetValue: values.targetValue,
        currentValue: values.currentValue || 0,
        unit: values.unit,
        taskId: values.taskId,
        sortOrder: editingKR?.sortOrder ?? krItems.length
      }

      if (editingKR) {
        setKrItems(prev => prev.map(item => 
          item.tempId === editingKR.tempId ? newKR : item
        ))
      } else {
        setKrItems(prev => [...prev, newKR])
      }
      
      setKrFormVisible(false)
      setEditingKR(null)
      message.success(editingKR ? 'KR已更新' : 'KR已添加')
    } catch (err) {
      console.error('保存KR失败:', err)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const [startDate, endDate] = values.dateRange as [Dayjs, Dayjs]
      
      if (krItems.length === 0) {
        message.warning('请至少添加一个关键结果（KR）')
        return
      }

      const objectiveData = {
        title: values.title,
        description: values.description || '',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        priority: values.priority as OKRPriority,
        tags: values.tags as TaskTag[],
        owner: values.owner || undefined
      }

      const keyResults = krItems.map(kr => ({
        title: kr.title,
        description: kr.description,
        type: kr.type,
        targetValue: kr.targetValue,
        currentValue: kr.currentValue,
        unit: kr.unit,
        taskId: kr.taskId,
        sortOrder: kr.sortOrder
      }))

      onSubmit(objectiveData, keyResults)
      form.resetFields()
      setKrItems([])
    } catch (err) {
      console.error('提交失败:', err)
    }
  }

  const getTaskTitle = (taskId?: string) => {
    if (!taskId) return ''
    const task = tasks.find(t => t.id === taskId)
    return task?.title || '未知任务'
  }

  return (
    <>
      <Modal
        title={
          <Title level={4} style={{ margin: 0 }}>
            {objective ? '编辑目标' : '创建新目标'}
          </Title>
        }
        open={open}
        onCancel={onCancel}
        onOk={handleSubmit}
        okText={objective ? '保存修改' : '创建目标'}
        cancelText="取消"
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="目标名称"
            rules={[{ required: true, message: '请输入目标名称' }]}
          >
            <Input placeholder="例如：Q3 产品上线" maxLength={100} showCount />
          </Form.Item>

          <Form.Item name="description" label="目标描述">
            <TextArea placeholder="描述目标的具体内容和期望达成的结果..." rows={3} maxLength={500} showCount />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="目标周期"
            rules={[{ required: true, message: '请选择目标起止时间' }]}
          >
            <RangePicker style={{ width: '100%' }} showTime />
          </Form.Item>

          <Space wrap size="large" style={{ width: '100%' }}>
            <Form.Item
              name="priority"
              label="优先级"
              rules={[{ required: true, message: '请选择优先级' }]}
              style={{ marginBottom: 0, minWidth: 150 }}
            >
              <Select>
                {(Object.keys(okrPriorityLabels) as OKRPriority[]).map(priority => (
                  <Option key={priority} value={priority}>
                    <Space>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: okrPriorityColors[priority]
                      }} />
                      {okrPriorityLabels[priority]}优先级
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="tags"
              label="关联标签"
              style={{ marginBottom: 0, flex: 1, minWidth: 200 }}
            >
              <Select mode="multiple" placeholder="选择标签">
                {(Object.keys(tagLabels) as TaskTag[]).map(tag => (
                  <Option key={tag} value={tag}>
                    <Tag color={tagColors[tag]} style={{ margin: 0 }}>
                      {tagLabels[tag]}
                    </Tag>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="owner"
              label="负责人（预留）"
              style={{ marginBottom: 0, minWidth: 150 }}
            >
              <Input placeholder="负责人名称" />
            </Form.Item>
          </Space>

          <Divider>
            <Space>
              <Title level={5} style={{ margin: 0 }}>关键结果（KR）</Title>
              <Tag color="blue">{krItems.length} 个</Tag>
            </Space>
          </Divider>

          <div style={{ marginBottom: 16 }}>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddKR}
              block
              style={{ height: 48 }}
            >
              添加关键结果
            </Button>
          </div>

          {krItems.length > 0 && (
            <List
              size="small"
              dataSource={krItems.sort((a, b) => a.sortOrder - b.sortOrder)}
              renderItem={(item, index) => (
                <List.Item
                  actions={[
                    <Button
                      type="text"
                      size="small"
                      onClick={() => handleEditKR(item)}
                    >
                      编辑
                    </Button>,
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteKR(item.tempId)}
                    />
                  ]}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#fafafa',
                    borderRadius: 8,
                    marginBottom: 8
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        backgroundColor: krTypeColors[item.type],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 'bold'
                      }}>
                        {index + 1}
                      </div>
                    }
                    title={
                      <Space wrap>
                        <Text strong>{item.title}</Text>
                        <Tag color={krTypeColors[item.type]}>
                          {krTypeLabels[item.type]}
                        </Tag>
                        {item.taskId && (
                          <Tag icon={<LinkOutlined />} color="purple">
                            关联任务: {getTaskTitle(item.taskId)}
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div>
                        {item.description && (
                          <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                            {item.description}
                          </Text>
                        )}
                        <Text type="secondary">
                          目标值: {item.targetValue}{item.unit} / 当前: {item.currentValue}{item.unit}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Form>
      </Modal>

      <Modal
        title={editingKR ? '编辑关键结果' : '添加关键结果'}
        open={krFormVisible}
        onCancel={() => setKrFormVisible(false)}
        onOk={handleSaveKR}
        okText="保存"
        cancelText="取消"
        width={500}
        destroyOnClose
      >
        <Form form={krForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="KR 名称"
            rules={[{ required: true, message: '请输入KR名称' }]}
          >
            <Input placeholder="例如：完成50篇文章" maxLength={100} showCount />
          </Form.Item>

          <Form.Item name="description" label="KR 描述">
            <TextArea placeholder="描述这个KR的具体内容..." rows={2} maxLength={300} showCount />
          </Form.Item>

          <Form.Item
            name="type"
            label="KR 类型"
            rules={[{ required: true, message: '请选择KR类型' }]}
          >
            <Select onChange={(value) => {
              if (value === 'task') {
                krForm.setFieldsValue({ targetValue: 1, unit: '个' })
              }
            }}>
              <Option value="numeric">
                <Space>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: krTypeColors.numeric
                  }} />
                  数值型
                </Space>
              </Option>
              <Option value="task">
                <Space>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: krTypeColors.task
                  }} />
                  任务型
                </Space>
              </Option>
            </Select>
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const type = getFieldValue('type') as KRType
              return (
                <>
                  {type === 'task' && (
                    <Form.Item
                      name="taskId"
                      label="关联任务"
                      rules={[{ required: true, message: '请选择关联的任务' }]}
                    >
                      <Select
                        placeholder="选择一个现有任务"
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                          String(option?.children || '').toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {tasks.map(task => (
                          <Option key={task.id} value={task.id}>
                            {task.title}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  )}

                  <Space wrap size="large" style={{ width: '100%' }}>
                    <Form.Item
                      name="currentValue"
                      label="当前值"
                      style={{ marginBottom: 0, flex: 1, minWidth: 120 }}
                    >
                      <InputNumber
                        min={0}
                        style={{ width: '100%' }}
                        disabled={type === 'task'}
                      />
                    </Form.Item>

                    <Form.Item
                      name="targetValue"
                      label="目标值"
                      rules={[{ required: true, message: '请输入目标值' }]}
                      style={{ marginBottom: 0, flex: 1, minWidth: 120 }}
                    >
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                      name="unit"
                      label="单位"
                      rules={[{ required: true, message: '请输入单位' }]}
                      style={{ marginBottom: 0, flex: 1, minWidth: 120 }}
                    >
                      <Input placeholder="%、个、篇 等" />
                    </Form.Item>
                  </Space>
                </>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
