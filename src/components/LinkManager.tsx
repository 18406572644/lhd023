import React, { useState } from 'react'
import { List, Button, Space, Tooltip, Modal, Form, Input, message, Typography, Empty } from 'antd'
import {
  LinkOutlined,
  PlusOutlined,
  DeleteOutlined,
  GlobalOutlined,
  EditOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { TaskLink } from '../types'
import { generateId } from '../utils/scheduler'

const { Text, Paragraph } = Typography

interface LinkManagerProps {
  links: TaskLink[]
  onChange: (links: TaskLink[]) => void
  readOnly?: boolean
}

export const LinkManager: React.FC<LinkManagerProps> = ({ links, onChange, readOnly = false }) => {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<TaskLink | null>(null)
  const [addForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const handleAddLink = () => {
    addForm.validateFields().then((values) => {
      const newLink: TaskLink = {
        id: generateId(),
        title: values.title,
        url: values.url,
        createdAt: dayjs().toISOString()
      }
      onChange([...links, newLink])
      setAddModalOpen(false)
      addForm.resetFields()
      message.success('链接已添加')
    }).catch(() => {
      message.error('请填写完整的链接信息')
    })
  }

  const handleEditLink = () => {
    if (!editingLink) return
    editForm.validateFields().then((values) => {
      const updatedLinks = links.map(link =>
        link.id === editingLink.id
          ? { ...link, title: values.title, url: values.url }
          : link
      )
      onChange(updatedLinks)
      setEditModalOpen(false)
      setEditingLink(null)
      editForm.resetFields()
      message.success('链接已更新')
    }).catch(() => {
      message.error('请填写完整的链接信息')
    })
  }

  const handleDeleteLink = (id: string) => {
    Modal.confirm({
      title: '确认删除链接',
      content: '删除后无法恢复，确定要删除此链接吗？',
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        onChange(links.filter(link => link.id !== id))
        message.success('链接已删除')
      }
    })
  }

  const handleOpenLink = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      window.open(`file://${url}`, '_blank', 'noopener,noreferrer')
    }
  }

  const handleEditClick = (link: TaskLink) => {
    setEditingLink(link)
    editForm.setFieldsValue({
      title: link.title,
      url: link.url
    })
    setEditModalOpen(true)
  }

  return (
    <div>
      {!readOnly && (
        <div style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            onClick={() => setAddModalOpen(true)}
          >
            添加链接
          </Button>
        </div>
      )}

      {links.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={readOnly ? '暂无链接' : '暂无链接，点击上方按钮添加'}
          style={{ padding: '24px 0' }}
        />
      ) : (
        <List
          dataSource={links}
          renderItem={(link) => (
            <List.Item
              key={link.id}
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
                    onClick={() => handleEditClick(link)}
                  />
                </Tooltip>,
                <Tooltip title="删除" key="delete">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteLink(link.id)}
                  />
                </Tooltip>
              ] : undefined}
            >
              <List.Item.Meta
                avatar={
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      backgroundColor: '#1677ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff'
                    }}
                  >
                    <GlobalOutlined />
                  </div>
                }
                title={
                  <Space>
                    <Text strong style={{ fontSize: 14 }}>
                      {link.title}
                    </Text>
                  </Space>
                }
                description={
                  <div>
                    <Paragraph
                      style={{ margin: '4px 0 8px 0', fontSize: 12 }}
                      ellipsis={{ rows: 1 }}
                    >
                      <Text type="secondary">{link.url}</Text>
                    </Paragraph>
                    <Space size={16} style={{ fontSize: 12 }}>
                      <Button
                        type="link"
                        icon={<LinkOutlined />}
                        size="small"
                        onClick={() => handleOpenLink(link.url)}
                        style={{ padding: 0 }}
                      >
                        打开链接
                      </Button>
                      <Text type="secondary">
                        添加时间: {dayjs(link.createdAt).format('YYYY-MM-DD HH:mm')}
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
        title="添加外部链接"
        open={addModalOpen}
        onOk={handleAddLink}
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
            name="title"
            label="链接名称"
            rules={[{ required: true, message: '请输入链接名称' }]}
          >
            <Input placeholder="例如：项目会议链接" maxLength={50} showCount />
          </Form.Item>
          <Form.Item
            name="url"
            label="链接地址"
            rules={[
              { required: true, message: '请输入链接地址' },
              {
                pattern: /^(https?:\/\/|file:\/\/|\/|[a-zA-Z]:\\)/,
                message: '请输入有效的链接地址（http://、https://、file:// 或本地路径）'
              }
            ]}
          >
            <Input placeholder="例如：https://meeting.example.com/room/123" />
          </Form.Item>
          <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
            支持的链接类型：
            <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
              <li>网页链接：https:// 或 http:// 开头</li>
              <li>本地文件：file:// 开头或直接输入文件路径</li>
              <li>网络路径：\\server\share\file.docx 格式</li>
            </ul>
          </Paragraph>
        </Form>
      </Modal>

      <Modal
        title="编辑链接"
        open={editModalOpen}
        onOk={handleEditLink}
        onCancel={() => {
          setEditModalOpen(false)
          setEditingLink(null)
          editForm.resetFields()
        }}
        okText="保存"
        cancelText="取消"
        width={480}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="链接名称"
            rules={[{ required: true, message: '请输入链接名称' }]}
          >
            <Input placeholder="例如：项目会议链接" maxLength={50} showCount />
          </Form.Item>
          <Form.Item
            name="url"
            label="链接地址"
            rules={[
              { required: true, message: '请输入链接地址' },
              {
                pattern: /^(https?:\/\/|file:\/\/|\/|[a-zA-Z]:\\)/,
                message: '请输入有效的链接地址'
              }
            ]}
          >
            <Input placeholder="例如：https://meeting.example.com/room/123" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
