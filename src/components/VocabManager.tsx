import React, { useState, useEffect, useCallback } from 'react'
import { Modal, Form, Input, Select, Button, Space, Table, Tag, message, Typography, Popconfirm, Card, Row, Col, Statistic, Tooltip } from 'antd'
import { BookOutlined, PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined, CloseOutlined, BulbOutlined, ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { VocabMapping, NLPLearningData, TaskPriority, TaskTag } from '../types'
import { storage } from '../utils/storage'
import { priorityLabels, tagLabels, priorityColors, tagColors } from '../utils/constants'

const { Text } = Typography
const { Option } = Select

interface VocabManagerProps {
  open: boolean
  onCancel: () => void
}

const categoryLabels: Record<VocabMapping['category'], string> = {
  priority: '优先级',
  tag: '标签',
  time: '时间',
  title: '标题',
}

const categoryColors: Record<VocabMapping['category'], string> = {
  priority: '#fa8c16',
  tag: '#1677ff',
  time: '#13c2c2',
  title: '#722ed1',
}

const getPriorityOptions = () =>
  (Object.keys(priorityLabels) as TaskPriority[]).map((p) => ({
    label: priorityLabels[p],
    value: p,
    color: priorityColors[p],
  }))

const getTagOptions = () =>
  (Object.keys(tagLabels) as TaskTag[]).map((t) => ({
    label: tagLabels[t],
    value: t,
    color: tagColors[t],
  }))

const getTimeSuggestions = (): { label: string; value: string }[] => [
  { label: '明天早上9点', value: '明天早上9点' },
  { label: '明天下午3点', value: '明天下午3点' },
  { label: '下周一', value: '下周一' },
  { label: '每天晚上10点', value: '每天晚上10点' },
  { label: '每周一三五早上9点', value: '每周一三五早上9点' },
]

const getTitleSuggestions = (): { label: string; value: string }[] => [
  { label: '开周会', value: '开周会' },
  { label: '打卡', value: '打卡' },
  { label: '完成报告', value: '完成报告' },
  { label: '喝水', value: '喝水' },
  { label: '健身', value: '健身' },
  { label: '提交代码', value: '提交代码' },
  { label: '还信用卡', value: '还信用卡' },
]

export const VocabManager: React.FC<VocabManagerProps> = ({ open, onCancel }) => {
  const [form] = Form.useForm()
  const [vocabMappings, setVocabMappings] = useState<VocabMapping[]>([])
  const [learningData, setLearningData] = useState<NLPLearningData | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<VocabMapping['category'] | 'all'>('all')
  const category = Form.useWatch('category', form)

  const loadData = useCallback(async () => {
    const [mappings, data] = await Promise.all([
      storage.getVocabMappings(),
      storage.getNLPLearningData(),
    ])
    setVocabMappings(mappings)
    setLearningData(data)
  }, [])

  useEffect(() => {
    if (open) {
      loadData()
      setEditingId(null)
      setIsAdding(false)
      form.resetFields()
    }
  }, [open, form, loadData])

  const handleAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    form.resetFields()
    form.setFieldsValue({
      category: 'priority',
    })
  }

  const handleEdit = (record: VocabMapping) => {
    setEditingId(record.id)
    setIsAdding(false)
    form.setFieldsValue({
      word: record.word,
      category: record.category,
      targetValue: record.targetValue,
    })
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    form.resetFields()
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      if (editingId) {
        await storage.updateVocabMapping(editingId, {
          word: values.word,
          category: values.category,
          targetValue: values.targetValue,
        })
        message.success('词汇映射已更新')
      } else {
        await storage.addVocabMapping({
          word: values.word,
          category: values.category,
          targetValue: values.targetValue,
        })
        message.success('词汇映射已添加')
      }

      setIsAdding(false)
      setEditingId(null)
      form.resetFields()
      loadData()
    } catch (err) {
      console.error('保存失败:', err)
      message.error('保存失败，请重试')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await storage.deleteVocabMapping(id)
      message.success('词汇映射已删除')
      loadData()
    } catch (err) {
      console.error('删除失败:', err)
      message.error('删除失败，请重试')
    }
  }

  const getTopWords = () => {
    if (!learningData) return []
    return Object.entries(learningData.wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }))
  }

  const handleQuickAdd = (word: string, category: VocabMapping['category'], targetValue: string) => {
    form.setFieldsValue({
      word,
      category,
      targetValue,
    })
    setIsAdding(true)
    setEditingId(null)
  }

  const filteredMappings = selectedCategory === 'all'
    ? vocabMappings
    : vocabMappings.filter((m) => m.category === selectedCategory)

  const columns = [
    {
      title: '词汇',
      dataIndex: 'word',
      key: 'word',
      width: 180,
      render: (text: string, record: VocabMapping) => {
        if (editingId === record.id || isAdding) {
          return (
            <Form.Item
              name="word"
              rules={[{ required: true, message: '请输入词汇' }]}
              style={{ margin: 0 }}
            >
              <Input placeholder="输入词汇" maxLength={20} />
            </Form.Item>
          )
        }
        return <Text strong>{text}</Text>
      },
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (text: VocabMapping['category'], record: VocabMapping) => {
        if (editingId === record.id || isAdding) {
          return (
            <Form.Item
              name="category"
              rules={[{ required: true, message: '请选择类别' }]}
              style={{ margin: 0 }}
            >
              <Select style={{ width: '100%' }} onChange={() => form.setFieldsValue({ targetValue: '' })}>
                <Option value="priority">优先级</Option>
                <Option value="tag">标签</Option>
                <Option value="time">时间</Option>
                <Option value="title">标题</Option>
              </Select>
            </Form.Item>
          )
        }
        return (
          <Tag color={categoryColors[text]}>
            {categoryLabels[text]}
          </Tag>
        )
      },
    },
    {
      title: '映射值',
      dataIndex: 'targetValue',
      key: 'targetValue',
      render: (_text: string, record: VocabMapping) => {
        if (editingId === record.id || isAdding) {
          if (category === 'priority') {
            return (
              <Form.Item
                name="targetValue"
                rules={[{ required: true, message: '请选择优先级' }]}
                style={{ margin: 0 }}
              >
                <Select style={{ width: '100%' }} placeholder="选择优先级">
                  {getPriorityOptions().map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      <Space>
                        <Tag color={opt.color} style={{ margin: 0 }} />
                        {opt.label}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )
          }
          if (category === 'tag') {
            return (
              <Form.Item
                name="targetValue"
                rules={[{ required: true, message: '请选择标签' }]}
                style={{ margin: 0 }}
              >
                <Select style={{ width: '100%' }} placeholder="选择标签">
                  {getTagOptions().map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      <Space>
                        <Tag color={opt.color} style={{ margin: 0 }} />
                        {opt.label}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )
          }
          if (category === 'time') {
            return (
              <Form.Item
                name="targetValue"
                rules={[{ required: true, message: '请输入时间表达式' }]}
                style={{ margin: 0 }}
              >
                <Select
                  style={{ width: '100%' }}
                  placeholder="输入或选择时间表达式"
                  mode={undefined}
                  showSearch
                  options={getTimeSuggestions()}
                />
              </Form.Item>
            )
          }
          return (
            <Form.Item
              name="targetValue"
              rules={[{ required: true, message: '请输入标题映射' }]}
              style={{ margin: 0 }}
            >
              <Select
                style={{ width: '100%' }}
                placeholder="输入或选择标题"
                mode={undefined}
                showSearch
                options={getTitleSuggestions()}
              />
            </Form.Item>
          )
        }

        if (record.category === 'priority') {
          const label = priorityLabels[record.targetValue as TaskPriority]
          const color = priorityColors[record.targetValue as TaskPriority]
          return (
            <Space>
              <Tag color={color} style={{ margin: 0 }} />
              {label || record.targetValue}
            </Space>
          )
        }
        if (record.category === 'tag') {
          const label = tagLabels[record.targetValue as TaskTag]
          const color = tagColors[record.targetValue as TaskTag]
          return (
            <Space>
              <Tag color={color} style={{ margin: 0 }} />
              {label || record.targetValue}
            </Space>
          )
        }
        return <Text>{record.targetValue}</Text>
      },
    },
    {
      title: '使用次数',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 100,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 10 ? '#52c41a' : count > 5 ? '#faad14' : '#8c8c8c'}>
          {count} 次
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: VocabMapping) => {
        if (editingId === record.id || isAdding) {
          return (
            <Space size={8}>
              <Tooltip title="保存">
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                />
              </Tooltip>
              <Tooltip title="取消">
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleCancel}
                />
              </Tooltip>
            </Space>
          )
        }
        return (
          <Space size={8}>
            <Tooltip title="编辑">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
            <Popconfirm
              title="确定删除此词汇映射吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="删除"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  const topWords = getTopWords()

  return (
    <Modal
      title={
        <Space>
          <BookOutlined style={{ color: '#722ed1' }} />
          <span>词汇映射管理</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={900}
      destroyOnClose
      centered
      styles={{
        header: {
          borderBottom: '1px solid #f0f0f0',
          paddingBottom: 16,
        },
        body: {
          paddingTop: 20,
          paddingBottom: 20,
        },
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {learningData && (
          <Row gutter={16}>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="总解析次数"
                  value={learningData.totalParses}
                  prefix={<ThunderboltOutlined />}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="成功解析次数"
                  value={learningData.successfulParses}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="解析准确率"
                  value={learningData.totalParses > 0 ? Math.round((learningData.successfulParses / learningData.totalParses) * 100) : 0}
                  suffix="%"
                  valueStyle={{
                    color: learningData.totalParses > 0 && (learningData.successfulParses / learningData.totalParses) >= 0.8 ? '#52c41a' : '#faad14',
                  }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {topWords.length > 0 && (
          <Card
            size="small"
            title={
              <Space>
                <BulbOutlined style={{ color: '#faad14' }} />
                <span>常用词汇推荐（快速添加）</span>
              </Space>
            }
          >
            <Space wrap size={[8, 8]}>
              {topWords.map((item) => (
                <Space key={item.word} size={4}>
                  <Tag color="blue">{item.word}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>({item.count}次)</Text>
                  <Space size={2}>
                    <Button
                      type="text"
                      size="small"
                      style={{ padding: '0 4px', height: 'auto', fontSize: 12 }}
                      onClick={() => handleQuickAdd(item.word, 'priority', 'high')}
                    >
                      优先级
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      style={{ padding: '0 4px', height: 'auto', fontSize: 12 }}
                      onClick={() => handleQuickAdd(item.word, 'tag', 'work')}
                    >
                      标签
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      style={{ padding: '0 4px', height: 'auto', fontSize: 12 }}
                      onClick={() => handleQuickAdd(item.word, 'title', item.word)}
                    >
                      标题
                    </Button>
                  </Space>
                </Space>
              ))}
            </Space>
          </Card>
        )}

        <Card
          size="small"
          title={
            <Space>
              <BookOutlined />
              <span>我的词汇映射</span>
              <Space size={[4, 0]} style={{ marginLeft: 16 }}>
                {(['all', 'priority', 'tag', 'time', 'title'] as const).map((cat) => (
                  <Button
                    key={cat}
                    type={selectedCategory === cat ? 'primary' : 'default'}
                    size="small"
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat === 'all' ? '全部' : categoryLabels[cat]}
                  </Button>
                ))}
              </Space>
            </Space>
          }
          extra={
            !isAdding && !editingId && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                添加词汇
              </Button>
            )
          }
        >
          {isAdding && (
            <Form form={form} layout="vertical">
              <Table
                dataSource={[{ id: 'new', word: '', category: 'priority' as const, targetValue: '', createdAt: '', usageCount: 0 }]}
                columns={columns}
                pagination={false}
                rowKey="id"
                showHeader={false}
                style={{ marginBottom: 16 }}
              />
            </Form>
          )}
          <Form form={form} layout="vertical">
            <Table
              dataSource={filteredMappings}
              columns={columns}
              rowKey="id"
              locale={{ emptyText: '暂无词汇映射，点击"添加词汇"开始创建' }}
            />
          </Form>
        </Card>

        <Card size="small" title="使用说明">
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text type="secondary">
              • <Text strong>优先级映射</Text>：如将"加急"映射为"高优先级"，输入"加急"时自动设置高优先级
            </Text>
            <Text type="secondary">
              • <Text strong>标签映射</Text>：如将"健身"映射为"健康"标签，自动归类任务
            </Text>
            <Text type="secondary">
              • <Text strong>时间映射</Text>：如将"下班时间"映射为"18:00"，输入"明天下班时间"自动解析为明天18:00
            </Text>
            <Text type="secondary">
              • <Text strong>标题映射</Text>：如将"站会"映射为"每日晨会"，统一任务标题
            </Text>
            <Text type="secondary">
              • 系统会记录您的常用词汇，使用次数越多，解析准确率越高
            </Text>
          </Space>
        </Card>
      </Space>
    </Modal>
  )
}
