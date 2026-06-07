import React, { useState, useRef, useEffect } from 'react'
import { Button, Space, Tooltip, Modal, Form, Input, message } from 'antd'
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  LinkOutlined,
  StrikethroughOutlined,
  ClearOutlined
} from '@ant-design/icons'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  readOnly?: boolean
  minHeight?: number
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = '在此输入备注内容，支持富文本编辑...',
  readOnly = false,
  minHeight = 150
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkForm] = Form.useForm()

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [])

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const handleInsertLink = () => {
    linkForm.validateFields().then((values) => {
      const { text, url } = values
      const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #1677ff; text-decoration: underline;">${text || url}</a>`
      execCommand('insertHTML', linkHtml)
      setLinkModalOpen(false)
      linkForm.resetFields()
      message.success('链接已插入')
    }).catch(() => {
      message.error('请填写完整的链接信息')
    })
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  if (readOnly) {
    return (
      <div
        style={{
          padding: '12px 16px',
          minHeight,
          border: '1px solid #f0f0f0',
          borderRadius: 6,
          backgroundColor: '#fafafa',
          wordBreak: 'break-word'
        }}
        dangerouslySetInnerHTML={{ __html: value || placeholder }}
      />
    )
  }

  return (
    <div>
      <Space wrap style={{ marginBottom: 8 }}>
        <Tooltip title="加粗">
          <Button
            size="small"
            icon={<BoldOutlined />}
            onClick={() => execCommand('bold')}
          />
        </Tooltip>
        <Tooltip title="斜体">
          <Button
            size="small"
            icon={<ItalicOutlined />}
            onClick={() => execCommand('italic')}
          />
        </Tooltip>
        <Tooltip title="下划线">
          <Button
            size="small"
            icon={<UnderlineOutlined />}
            onClick={() => execCommand('underline')}
          />
        </Tooltip>
        <Tooltip title="删除线">
          <Button
            size="small"
            icon={<StrikethroughOutlined />}
            onClick={() => execCommand('strikeThrough')}
          />
        </Tooltip>
        <Tooltip title="无序列表">
          <Button
            size="small"
            icon={<UnorderedListOutlined />}
            onClick={() => execCommand('insertUnorderedList')}
          />
        </Tooltip>
        <Tooltip title="有序列表">
          <Button
            size="small"
            icon={<OrderedListOutlined />}
            onClick={() => execCommand('insertOrderedList')}
          />
        </Tooltip>
        <Tooltip title="插入链接">
          <Button
            size="small"
            icon={<LinkOutlined />}
            onClick={() => setLinkModalOpen(true)}
          />
        </Tooltip>
        <Tooltip title="清除格式">
          <Button
            size="small"
            icon={<ClearOutlined />}
            onClick={() => execCommand('removeFormat')}
          />
        </Tooltip>
      </Space>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        style={{
          padding: '12px 16px',
          minHeight,
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          outline: 'none',
          wordBreak: 'break-word',
          lineHeight: 1.6
        }}
        dangerouslySetInnerHTML={{ __html: value || '' }}
        data-placeholder={placeholder}
      />

      <Modal
        title="插入链接"
        open={linkModalOpen}
        onOk={handleInsertLink}
        onCancel={() => {
          setLinkModalOpen(false)
          linkForm.resetFields()
        }}
        okText="插入"
        cancelText="取消"
        width={400}
      >
        <Form form={linkForm} layout="vertical">
          <Form.Item
            name="text"
            label="显示文字"
            rules={[{ required: true, message: '请输入链接显示文字' }]}
          >
            <Input placeholder="例如：会议链接" />
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
            <Input placeholder="例如：https://meeting.example.com" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
