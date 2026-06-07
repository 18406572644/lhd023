import React, { useState, useEffect, useCallback } from 'react'
import { List, Button, Tag, Space, Tooltip, Typography, Select, Empty, Popconfirm, message, Input } from 'antd'
import { EditOutlined, DeleteOutlined, FileTextOutlined, PlusOutlined, PlayCircleOutlined, TagOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { TaskTemplate, TemplateCategory } from '../types'
import { storage } from '../utils/storage'
import { categoryColors, categoryLabels, priorityColors, priorityLabels, tagColors, tagLabels } from '../utils/constants'
import { TemplateForm } from './TemplateForm'

const { Text, Paragraph } = Typography
const { Option } = Select
const { Search } = Input

const repeatTypeLabels: Record<string, string> = {
  none: '单次',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  custom: '自定义'
}

const repeatTypeColors: Record<string, string> = {
  none: 'default',
  daily: 'blue',
  weekly: 'cyan',
  monthly: 'geekblue',
  custom: 'purple'
}

interface TemplateManagerProps {
  onCreateTaskFromTemplate?: (templateId: string) => void
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ onCreateTaskFromTemplate }) => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
  const [searchText, setSearchText] = useState('')

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const loadedTemplates = await storage.getTemplates()
      setTemplates(loadedTemplates)
    } catch (err) {
      console.error('加载模板失败:', err)
      message.error('加载模板失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleAddTemplate = () => {
    setEditingTemplate(null)
    setFormOpen(true)
  }

  const handleEditTemplate = (template: TaskTemplate) => {
    setEditingTemplate(template)
    setFormOpen(true)
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      await storage.deleteTemplate(id)
      message.success('模板已删除')
      loadTemplates()
    } catch (err) {
      console.error('删除模板失败:', err)
      message.error('删除模板失败')
    }
  }

  const handleFormSubmit = async (templateData: Omit<TaskTemplate, 'id' | 'createdAt' | 'isBuiltIn'>) => {
    try {
      if (editingTemplate) {
        await storage.updateTemplate(editingTemplate.id, templateData)
        message.success('模板已更新')
      } else {
        await storage.addTemplate(templateData)
        message.success('模板已创建')
      }
      setFormOpen(false)
      setEditingTemplate(null)
      loadTemplates()
    } catch (err) {
      console.error('保存模板失败:', err)
      message.error('保存模板失败')
    }
  }

  const handleCreateTask = async (template: TaskTemplate) => {
    if (onCreateTaskFromTemplate) {
      onCreateTaskFromTemplate(template.id)
    }
  }

  const filteredTemplates = templates.filter(t => {
    const matchCategory = selectedCategory === 'all' || t.category === selectedCategory
    const matchSearch = !searchText || 
      t.name.toLowerCase().includes(searchText.toLowerCase()) ||
      t.description.toLowerCase().includes(searchText.toLowerCase()) ||
      t.taskTitle.toLowerCase().includes(searchText.toLowerCase())
    return matchCategory && matchSearch
  })

  const builtInTemplates = filteredTemplates.filter(t => t.isBuiltIn)
  const customTemplates = filteredTemplates.filter(t => !t.isBuiltIn)

  const renderTemplateItem = (template: TaskTemplate) => {
    const actions = [
      <Tooltip title="使用模板创建任务" key="use">
        <Button
          type="text"
          icon={<PlayCircleOutlined />}
          onClick={() => handleCreateTask(template)}
          size="small"
        />
      </Tooltip>
    ]

    if (!template.isBuiltIn) {
      actions.push(
        <Tooltip title="编辑" key="edit">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditTemplate(template)}
            size="small"
          />
        </Tooltip>
      )
      actions.push(
        <Popconfirm
          key="delete"
          title="确定删除此模板？"
          onConfirm={() => handleDeleteTemplate(template.id)}
          okText="删除"
          cancelText="取消"
        >
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Tooltip>
        </Popconfirm>
      )
    }

    return (
      <List.Item
        key={template.id}
        style={{
          padding: '16px 20px',
          marginBottom: 12,
          borderRadius: 8,
          backgroundColor: '#fff',
          border: '1px solid #f0f0f0'
        }}
        actions={actions}
      >
        <List.Item.Meta
          avatar={
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                backgroundColor: categoryColors[template.category],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}
            >
              <FileTextOutlined style={{ fontSize: 20 }} />
            </div>
          }
          title={
            <Space wrap>
              <Text strong style={{ fontSize: 15 }}>
                {template.name}
              </Text>
              {template.isBuiltIn && (
                <Tag color="blue">内置</Tag>
              )}
              <Tag color={categoryColors[template.category]}>
                <TagOutlined style={{ marginRight: 4 }} />
                {categoryLabels[template.category]}
              </Tag>
              <Tag color={repeatTypeColors[template.repeatType]}>
                {repeatTypeLabels[template.repeatType]}
              </Tag>
              <Tag color={priorityColors[template.priority]}>
                {priorityLabels[template.priority]}
              </Tag>
              <Tag color={tagColors[template.tag]}>
                {tagLabels[template.tag]}
              </Tag>
            </Space>
          }
          description={
            <div>
              {template.description && (
                <Paragraph
                  type="secondary"
                  style={{ margin: '4px 0 8px 0', fontSize: 13 }}
                  ellipsis={{ rows: 1 }}
                >
                  {template.description}
                </Paragraph>
              )}
              <Space size={24} style={{ fontSize: 12 }}>
                <Text type="secondary">
                  任务: {template.taskTitle}
                </Text>
                <Text type="secondary">
                  时间: {template.targetTime}
                </Text>
                {template.duration && (
                  <Text type="secondary">
                    时长: {template.duration}分钟
                  </Text>
                )}
                {!template.isBuiltIn && (
                  <Text type="secondary">
                    创建时间: {dayjs(template.createdAt).format('YYYY-MM-DD')}
                  </Text>
                )}
              </Space>
            </div>
          }
        />
      </List.Item>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Space wrap>
          <Select
            value={selectedCategory}
            onChange={setSelectedCategory}
            style={{ width: 150 }}
            placeholder="选择分类"
          >
            <Option value="all">全部分类</Option>
            {(Object.keys(categoryLabels) as TemplateCategory[]).map((category) => (
              <Option key={category} value={category}>
                <Space>
                  <Tag color={categoryColors[category]} style={{ margin: 0 }} />
                  {categoryLabels[category]}
                </Space>
              </Option>
            ))}
          </Select>
          <Search
            placeholder="搜索模板..."
            allowClear
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            prefix={<SearchOutlined />}
          />
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddTemplate}
        >
          创建模板
        </Button>
      </div>

      {filteredTemplates.length === 0 ? (
        <Empty
          description="暂无模板"
          style={{ padding: '60px 0' }}
        />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {builtInTemplates.length > 0 && (
            <div>
              <Text strong style={{ marginBottom: 12, display: 'inline-block', fontSize: 14, color: '#666' }}>
                内置模板 ({builtInTemplates.length})
              </Text>
              <List
                dataSource={builtInTemplates}
                loading={loading}
                renderItem={renderTemplateItem}
              />
            </div>
          )}
          {customTemplates.length > 0 && (
            <div>
              <Text strong style={{ marginBottom: 12, display: 'inline-block', fontSize: 14, color: '#666' }}>
                我的模板 ({customTemplates.length})
              </Text>
              <List
                dataSource={customTemplates}
                loading={loading}
                renderItem={renderTemplateItem}
              />
            </div>
          )}
        </Space>
      )}

      <TemplateForm
        open={formOpen}
        template={editingTemplate}
        onCancel={() => {
          setFormOpen(false)
          setEditingTemplate(null)
        }}
        onSubmit={handleFormSubmit}
      />
    </div>
  )
}
