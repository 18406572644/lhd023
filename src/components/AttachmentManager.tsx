import React, { useState, useRef } from 'react'
import { List, Button, Space, Tooltip, Modal, Form, Input, message, Typography, Empty, Tag } from 'antd'
import {
  PaperClipOutlined,
  PlusOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  FileOutlined,
  EditOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { TaskAttachment } from '../types'
import { generateId } from '../utils/scheduler'

const { Text, Paragraph } = Typography

interface AttachmentManagerProps {
  attachments: TaskAttachment[]
  onChange: (attachments: TaskAttachment[]) => void
  readOnly?: boolean
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '未知大小'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

const getFileExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toUpperCase() || ''
  return ext.length > 5 ? 'FILE' : ext
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({
  attachments,
  onChange,
  readOnly = false
}) => {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingAttachment, setEditingAttachment] = useState<TaskAttachment | null>(null)
  const [addForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isElectron = () => {
    return typeof window !== 'undefined' && window.api !== undefined
  }

  const handleSelectFile = async () => {
    if (isElectron() && window.api?.file?.select) {
      const result = await window.api.file.select({
        title: '选择要关联的文件',
        multiple: true,
        filters: [
          { name: '所有文件', extensions: ['*'] }
        ]
      })
      if (result) {
        const files = Array.isArray(result) ? result : [result]
        const newAttachments: TaskAttachment[] = files.map(file => ({
          id: generateId(),
          name: file.name,
          path: file.path,
          size: file.size || undefined,
          createdAt: dayjs().toISOString()
        }))
        onChange([...attachments, ...newAttachments])
        message.success(`已添加 ${files.length} 个附件`)
      }
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const newAttachments: TaskAttachment[] = Array.from(files).map(file => ({
        id: generateId(),
        name: file.name,
        path: file.name,
        size: file.size,
        createdAt: dayjs().toISOString()
      }))
      onChange([...attachments, ...newAttachments])
      message.success(`已添加 ${files.length} 个附件`)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleAddManual = () => {
    addForm.validateFields().then((values) => {
      const newAttachment: TaskAttachment = {
        id: generateId(),
        name: values.name,
        path: values.path,
        createdAt: dayjs().toISOString()
      }
      onChange([...attachments, newAttachment])
      setAddModalOpen(false)
      addForm.resetFields()
      message.success('附件已添加')
    }).catch(() => {
      message.error('请填写完整的附件信息')
    })
  }

  const handleEditAttachment = () => {
    if (!editingAttachment) return
    editForm.validateFields().then((values) => {
      const updatedAttachments = attachments.map(att =>
        att.id === editingAttachment.id
          ? { ...att, name: values.name, path: values.path }
          : att
      )
      onChange(updatedAttachments)
      setEditModalOpen(false)
      setEditingAttachment(null)
      editForm.resetFields()
      message.success('附件已更新')
    }).catch(() => {
      message.error('请填写完整的附件信息')
    })
  }

  const handleDeleteAttachment = (id: string) => {
    Modal.confirm({
      title: '确认删除附件',
      content: '删除后无法恢复，确定要删除此附件吗？',
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        onChange(attachments.filter(att => att.id !== id))
        message.success('附件已删除')
      }
    })
  }

  const handleOpenFile = async (path: string) => {
    if (isElectron() && window.api?.file?.open) {
      const success = await window.api.file.open(path)
      if (!success) {
        message.error('无法打开文件，请检查文件路径是否正确')
      }
    } else {
      message.warning('浏览器环境下无法直接打开本地文件，请手动访问路径')
    }
  }

  const handleShowInFolder = async (path: string) => {
    if (isElectron() && window.api?.file?.showInFolder) {
      const success = await window.api.file.showInFolder(path)
      if (!success) {
        message.error('无法定位文件，请检查文件路径是否正确')
      }
    } else {
      message.warning('浏览器环境下无法定位文件位置')
    }
  }

  const handleEditClick = (attachment: TaskAttachment) => {
    setEditingAttachment(attachment)
    editForm.setFieldsValue({
      name: attachment.name,
      path: attachment.path
    })
    setEditModalOpen(true)
  }

  return (
    <div>
      {!readOnly && (
        <div style={{ marginBottom: 12 }}>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={handleSelectFile}
            >
              选择文件
            </Button>
            <Button
              icon={<PaperClipOutlined />}
              size="small"
              onClick={() => setAddModalOpen(true)}
            >
              手动添加路径
            </Button>
          </Space>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />
        </div>
      )}

      {attachments.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={readOnly ? '暂无附件' : '暂无附件，点击上方按钮添加'}
          style={{ padding: '24px 0' }}
        />
      ) : (
        <List
          dataSource={attachments}
          renderItem={(attachment) => (
            <List.Item
              key={attachment.id}
              style={{
                padding: '12px 16px',
                marginBottom: 8,
                borderRadius: 6,
                backgroundColor: '#fafafa',
                border: '1px solid #f0f0f0'
              }}
              actions={!readOnly ? [
                <Tooltip title="编辑" key="edit">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEditClick(attachment)}
                  />
                </Tooltip>,
                <Tooltip title="在文件夹中显示" key="show">
                  <Button
                    type="text"
                    size="small"
                    icon={<FolderOpenOutlined />}
                    onClick={() => handleShowInFolder(attachment.path)}
                  />
                </Tooltip>,
                <Tooltip title="删除" key="delete">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteAttachment(attachment.id)}
                  />
                </Tooltip>
              ] : [
                <Tooltip title="在文件夹中显示" key="show">
                  <Button
                    type="text"
                    size="small"
                    icon={<FolderOpenOutlined />}
                    onClick={() => handleShowInFolder(attachment.path)}
                  />
                </Tooltip>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      backgroundColor: '#722ed1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      position: 'relative'
                    }}
                  >
                    <FileOutlined />
                    <Tag
                      color="geekblue"
                      style={{
                        position: 'absolute',
                        bottom: -6,
                        right: -6,
                        margin: 0,
                        padding: '0 4px',
                        fontSize: 10,
                        lineHeight: '16px',
                        minWidth: 'auto'
                      }}
                    >
                      {getFileExtension(attachment.name)}
                    </Tag>
                  </div>
                }
                title={
                  <Space>
                    <Text strong style={{ fontSize: 14 }}>
                      {attachment.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatFileSize(attachment.size)}
                    </Text>
                  </Space>
                }
                description={
                  <div>
                    <Paragraph
                      style={{ margin: '4px 0 8px 0', fontSize: 12 }}
                      ellipsis={{ rows: 1 }}
                    >
                      <Text type="secondary">{attachment.path}</Text>
                    </Paragraph>
                    <Space size={16} style={{ fontSize: 12 }}>
                      <Button
                        type="link"
                        icon={<PaperClipOutlined />}
                        size="small"
                        onClick={() => handleOpenFile(attachment.path)}
                        style={{ padding: 0 }}
                      >
                        打开文件
                      </Button>
                      <Text type="secondary">
                        添加时间: {dayjs(attachment.createdAt).format('YYYY-MM-DD HH:mm')}
                      </Text>
                    </Space>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      <Modal
        title="手动添加附件"
        open={addModalOpen}
        onOk={handleAddManual}
        onCancel={() => {
          setAddModalOpen(false)
          addForm.resetFields()
        }}
        okText="添加"
        cancelText="取消"
        width={480}
      >
        <Form form={addForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="文件名称"
            rules={[{ required: true, message: '请输入文件名称' }]}
          >
            <Input placeholder="例如：项目需求文档.docx" maxLength={100} showCount />
          </Form.Item>
          <Form.Item
            name="path"
            label="文件路径"
            rules={[{ required: true, message: '请输入文件路径' }]}
            tooltip="请输入文件的完整路径，例如：C:\\Users\\Documents\\file.docx 或 \\\\server\\share\\file.docx"
          >
            <Input placeholder="例如：C:\\Users\\Documents\\项目需求.docx" />
          </Form.Item>
          <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
            提示：附件只存储文件路径，不存储文件本身。请确保文件路径正确且可访问。
          </Paragraph>
        </Form>
      </Modal>

      <Modal
        title="编辑附件"
        open={editModalOpen}
        onOk={handleEditAttachment}
        onCancel={() => {
          setEditModalOpen(false)
          setEditingAttachment(null)
          editForm.resetFields()
        }}
        okText="保存"
        cancelText="取消"
        width={480}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="文件名称"
            rules={[{ required: true, message: '请输入文件名称' }]}
          >
            <Input placeholder="例如：项目需求文档.docx" maxLength={100} showCount />
          </Form.Item>
          <Form.Item
            name="path"
            label="文件路径"
            rules={[{ required: true, message: '请输入文件路径' }]}
          >
            <Input placeholder="例如：C:\\Users\\Documents\\项目需求.docx" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
