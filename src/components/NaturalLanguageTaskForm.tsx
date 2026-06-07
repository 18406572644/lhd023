import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Modal, Form, Input, DatePicker, Select, Switch, InputNumber, Row, Col, Checkbox, Button, Space, Tooltip, Tag, message, Typography, Card, Alert, Progress, Divider } from 'antd'
import { ThunderboltOutlined, BulbOutlined, CheckCircleOutlined, WarningOutlined, QuestionCircleOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Task, TaskPriority, TaskTag, NLPParseResult, VocabMapping } from '../types'
import { parseNaturalLanguage, getNLPExampleInputs } from '../utils/nlpParser'
import { storage } from '../utils/storage'
import { priorityColors, priorityLabels, tagColors, tagLabels } from '../utils/constants'

const { Text } = Typography
const { TextArea } = Input
const { Option } = Select

const weekDays = [
  { label: '周日', value: 0 },
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
]

const fieldLabels: Record<string, string> = {
  title: '任务标题',
  targetTime: '提醒时间',
  repeatType: '重复方式',
  repeatDays: '重复日期',
  repeatInterval: '重复间隔',
  priority: '优先级',
  tag: '标签',
  soundEnabled: '声音提醒',
  duration: '持续时间',
}

interface NaturalLanguageTaskFormProps {
  open: boolean
  onCancel: () => void
  onSubmit: (task: Omit<Task, 'id' | 'createdAt'>) => void
  onVocabManagerOpen?: () => void
}

export const NaturalLanguageTaskForm: React.FC<NaturalLanguageTaskFormProps> = ({ open, onCancel, onSubmit, onVocabManagerOpen }) => {
  const [form] = Form.useForm()
  const [inputText, setInputText] = useState('')
  const [parseResult, setParseResult] = useState<NLPParseResult | null>(null)
  const [vocabMappings, setVocabMappings] = useState<VocabMapping[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  const [successRate, setSuccessRate] = useState(0)
  const inputRef = useRef<any>(null)
  const parseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const repeatType = Form.useWatch('repeatType', form)

  const loadVocabMappings = useCallback(async () => {
    const mappings = await storage.getVocabMappings()
    const learningData = await storage.getNLPLearningData()
    setVocabMappings(mappings)
    if (learningData.totalParses > 0) {
      setSuccessRate(Math.round((learningData.successfulParses / learningData.totalParses) * 100))
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadVocabMappings()
      setInputText('')
      setParseResult(null)
      form.resetFields()
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [open, form, loadVocabMappings])

  useEffect(() => {
    return () => {
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current)
      }
    }
  }, [])

  const performParse = useCallback(async (text: string) => {
    if (!text.trim()) {
      setParseResult(null)
      return
    }

    setIsParsing(true)
    try {
      const result = parseNaturalLanguage(text, vocabMappings)
      setParseResult(result)

      form.setFieldsValue({
        title: result.title.value,
        targetTime: result.targetTime.value ? dayjs(result.targetTime.value) : null,
        repeatType: result.repeatType.value,
        repeatDays: result.repeatDays?.value,
        repeatInterval: result.repeatInterval?.value,
        priority: result.priority.value,
        tag: result.tag.value,
        soundEnabled: result.soundEnabled.value,
        duration: result.duration.value,
        description: text,
      })
    } catch (err) {
      console.error('解析失败:', err)
      message.error('解析失败，请重试')
    } finally {
      setIsParsing(false)
    }
  }, [form, vocabMappings])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setInputText(text)

    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current)
    }

    if (text.trim().length > 0) {
      parseTimeoutRef.current = setTimeout(() => {
        performParse(text)
      }, 300)
    } else {
      setParseResult(null)
    }
  }

  const handleExampleClick = (example: string) => {
    setInputText(example)
    performParse(example)
    setShowExamples(false)
  }

  const handleForceParse = () => {
    performParse(inputText)
  }

  const getFieldStatus = (fieldName: string): 'normal' | 'warning' | 'error' => {
    if (!parseResult) return 'normal'

    if (parseResult.missingFields.includes(fieldName)) {
      return 'error'
    }

    const field = parseResult[fieldName as keyof NLPParseResult] as any
    if (field?.isAmbiguous) {
      return 'warning'
    }

    return 'normal'
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#52c41a'
    if (confidence >= 0.5) return '#faad14'
    return '#ff4d4f'
  }

  const renderFieldBadge = (fieldName: string) => {
    const status = getFieldStatus(fieldName)
    if (status === 'error') {
      return (
        <Tooltip title="此字段未明确，请补充">
          <Tag color="red" icon={<QuestionCircleOutlined />}>需补充</Tag>
        </Tooltip>
      )
    }
    if (status === 'warning') {
      return (
        <Tooltip title="此字段解析可能不准确，建议确认">
          <Tag color="orange" icon={<WarningOutlined />}>待确认</Tag>
        </Tooltip>
      )
    }
    if (parseResult) {
      const field = parseResult[fieldName as keyof NLPParseResult] as any
      if (field?.confidence !== undefined) {
        return (
          <Tooltip title={`解析置信度: ${Math.round(field.confidence * 100)}%`}>
            <Tag color={getConfidenceColor(field.confidence)} icon={<CheckCircleOutlined />}>
              {Math.round(field.confidence * 100)}%
            </Tag>
          </Tooltip>
        )
      }
    }
    return null
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()

      const taskData: Omit<Task, 'id' | 'createdAt'> = {
        title: values.title,
        description: values.description || inputText,
        targetTime: values.targetTime.toISOString(),
        repeatType: values.repeatType,
        repeatInterval: values.repeatInterval,
        repeatDays: values.repeatDays,
        enabled: true,
        soundEnabled: values.soundEnabled,
        priority: values.priority,
        tag: values.tag,
        duration: values.duration,
        notes: '',
        links: [],
        attachments: [],
        isPinned: false,
      }

      const success = parseResult?.missingFields.length === 0
      await storage.recordNLPParse(inputText, success)

      if (parseResult) {
        if (parseResult.priority.rawText) {
          await storage.incrementVocabUsage(parseResult.priority.rawText, 'priority')
        }
        if (parseResult.tag.rawText) {
          await storage.incrementVocabUsage(parseResult.tag.rawText, 'tag')
        }
        if (parseResult.title.rawText) {
          await storage.incrementVocabUsage(parseResult.title.rawText, 'title')
        }
      }

      onSubmit(taskData)
      message.success('任务创建成功')
      form.resetFields()
      setInputText('')
      setParseResult(null)
    } catch (err) {
      console.error('提交失败:', err)
    }
  }

  const handleCancel = () => {
    onCancel()
  }

  const examples = getNLPExampleInputs()

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#1677ff' }} />
          <span>自然语言创建任务</span>
          {successRate > 0 && (
            <Tag color="blue">解析准确率 {successRate}%</Tag>
          )}
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="创建任务"
      cancelText="取消"
      width={720}
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
        <Card
          size="small"
          style={{ backgroundColor: '#f5f7fa' }}
          title={
            <Space>
              <BulbOutlined style={{ color: '#faad14' }} />
              <span>用自然语言描述你的任务</span>
            </Space>
          }
          extra={
            <Space>
              <Button
                type="link"
                size="small"
                onClick={() => setShowExamples(!showExamples)}
              >
                {showExamples ? '隐藏示例' : '查看示例'}
              </Button>
              <Tooltip title="重新解析">
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined spin={isParsing} />}
                  onClick={handleForceParse}
                  disabled={!inputText.trim()}
                />
              </Tooltip>
            </Space>
          }
        >
          <TextArea
            ref={inputRef}
            value={inputText}
            onChange={handleInputChange}
            placeholder="例如：明天下午3点开周会"
            rows={3}
            maxLength={200}
            showCount
            autoSize={{ minRows: 3, maxRows: 5 }}
            style={{ marginBottom: showExamples ? 12 : 0 }}
          />

          {showExamples && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>点击示例快速填充：</Text>
              <Space wrap size={[6, 6]} style={{ marginTop: 8 }}>
                {examples.map((example, index) => (
                  <Tag
                    key={index}
                    style={{ cursor: 'pointer', padding: '4px 8px' }}
                    onClick={() => handleExampleClick(example)}
                  >
                    {example}
                  </Tag>
                ))}
              </Space>
            </>
          )}
        </Card>

        {parseResult && (
          <Card
            size="small"
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>解析结果预览</span>
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                onClick={onVocabManagerOpen}
                icon={<PlusOutlined />}
              >
                管理词汇
              </Button>
            }
          >
            {parseResult.missingFields.length > 0 && (
              <Alert
                message="以下字段需要补充"
                description={parseResult.missingFields.map(f => fieldLabels[f]).join('、')}
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Form form={form} layout="vertical">
              <Form.Item
                name="title"
                label={
                  <Space>
                    <span>{fieldLabels.title}</span>
                    {renderFieldBadge('title')}
                  </Space>
                }
                rules={[{ required: true, message: '请输入任务标题' }]}
                validateStatus={getFieldStatus('title') === 'error' ? 'error' : ''}
              >
                <Input
                  placeholder="任务标题"
                  maxLength={50}
                  style={getFieldStatus('title') === 'error' ? { borderColor: '#ff4d4f' } : {}}
                />
              </Form.Item>

              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="targetTime"
                    label={
                      <Space>
                        <span>{fieldLabels.targetTime}</span>
                        {renderFieldBadge('targetTime')}
                      </Space>
                    }
                    rules={[{ required: true, message: '请选择提醒时间' }]}
                    validateStatus={getFieldStatus('targetTime') === 'error' ? 'error' : ''}
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
                    label={
                      <Space>
                        <span>{fieldLabels.duration}（分钟）</span>
                        {renderFieldBadge('duration')}
                      </Space>
                    }
                  >
                    <InputNumber min={5} max={1440} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="priority"
                    label={
                      <Space>
                        <span>{fieldLabels.priority}</span>
                        {renderFieldBadge('priority')}
                      </Space>
                    }
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
                    label={
                      <Space>
                        <span>{fieldLabels.tag}</span>
                        {renderFieldBadge('tag')}
                      </Space>
                    }
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

              <Form.Item
                name="repeatType"
                label={
                  <Space>
                    <span>{fieldLabels.repeatType}</span>
                    {renderFieldBadge('repeatType')}
                  </Space>
                }
              >
                <Select>
                  <Option value="none">不重复</Option>
                  <Option value="daily">每天</Option>
                  <Option value="weekly">每周</Option>
                  <Option value="monthly">每月</Option>
                  <Option value="custom">自定义间隔</Option>
                </Select>
              </Form.Item>

              {repeatType === 'weekly' && (
                <Form.Item
                  name="repeatDays"
                  label={
                    <Space>
                      <span>{fieldLabels.repeatDays}</span>
                      {renderFieldBadge('repeatDays')}
                    </Space>
                  }
                >
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
                  label={
                    <Space>
                      <span>{fieldLabels.repeatInterval}（分钟）</span>
                      {renderFieldBadge('repeatInterval')}
                    </Space>
                  }
                  rules={[{ required: true, message: '请输入间隔时间' }]}
                >
                  <InputNumber min={1} max={10080} style={{ width: '100%' }} placeholder="例如：60" />
                </Form.Item>
              )}

              <Form.Item
                name="soundEnabled"
                label={
                  <Space>
                    <span>{fieldLabels.soundEnabled}</span>
                    {renderFieldBadge('soundEnabled')}
                  </Space>
                }
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item name="description" label="原始描述">
                <Input.TextArea rows={2} readOnly placeholder="自动填充您的原始描述" />
              </Form.Item>
            </Form>

            {parseResult && (
              <Card size="small" style={{ marginTop: 16, backgroundColor: '#fafafa' }}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text type="secondary" strong>解析置信度概览</Text>
                  <Row gutter={[16, 8]}>
                    {['title', 'targetTime', 'priority', 'tag'].map((field) => {
                      const fieldData = parseResult[field as keyof NLPParseResult] as any
                      const confidence = fieldData?.confidence || 0
                      return (
                        <Col span={12} key={field}>
                          <Space size={8} style={{ width: '100%' }}>
                            <Text style={{ width: 70, fontSize: 12 }}>{fieldLabels[field]}:</Text>
                            <Progress
                              percent={Math.round(confidence * 100)}
                              size="small"
                              strokeColor={getConfidenceColor(confidence)}
                              showInfo={false}
                              style={{ flex: 1 }}
                            />
                            <Text style={{ fontSize: 12, width: 40, textAlign: 'right' }}>
                              {Math.round(confidence * 100)}%
                            </Text>
                          </Space>
                        </Col>
                      )
                    })}
                  </Row>
                </Space>
              </Card>
            )}
          </Card>
        )}

        {!parseResult && inputText.trim() && isParsing && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <ReloadOutlined spin style={{ fontSize: 24, color: '#1677ff' }} />
            <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
              正在解析...
            </Text>
          </div>
        )}

        {!parseResult && !inputText.trim() && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <BulbOutlined style={{ fontSize: 32, color: '#faad14' }} />
            <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
              在上方输入框中用自然语言描述您的任务，系统将自动解析
            </Text>
            <Button
              type="link"
              onClick={() => setShowExamples(true)}
              style={{ marginTop: 8 }}
            >
              查看示例
            </Button>
          </div>
        )}
      </Space>
    </Modal>
  )
}
