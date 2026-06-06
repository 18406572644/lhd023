import React, { useState, useEffect, useRef } from 'react'
import { List, Button, message, Space, Tooltip, Popconfirm, Typography, Tag, Input } from 'antd'
import { PlayCircleOutlined, CheckOutlined, DeleteOutlined, UploadOutlined, SoundOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons'
import type { SoundOption } from '../types'
import { soundManager } from '../utils/soundManager'

const { Text, Paragraph } = Typography

interface SettingsPanelProps {
  onClose?: () => void
}

export const SettingsPanel: React.FC<SettingsPanelProps> = () => {
  const [sounds, setSounds] = useState<SoundOption[]>([])
  const [defaultSoundId, setDefaultSoundId] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadSounds = async () => {
    const [loadedSounds, loadedDefault] = await Promise.all([
      soundManager.getAllSounds(),
      soundManager.getDefaultSoundId()
    ])
    setSounds(loadedSounds)
    setDefaultSoundId(loadedDefault)
  }

  useEffect(() => {
    loadSounds()
  }, [])

  const handlePlay = (sound: SoundOption) => {
    soundManager.playSound(sound)
  }

  const handleSetDefault = async (soundId: string) => {
    await soundManager.setDefaultSoundId(soundId)
    setDefaultSoundId(soundId)
    message.success('已设为默认铃声')
  }

  const handleDelete = async (soundId: string) => {
    const success = await soundManager.deleteCustomSound(soundId)
    if (success) {
      message.success('铃声已删除')
      loadSounds()
    } else {
      message.error('删除失败')
    }
  }

  const handleFileUpload = async (file: File) => {
    const validExtensions = ['.mp3', '.wav']
    const fileName = file.name.toLowerCase()
    if (!validExtensions.some(ext => fileName.endsWith(ext))) {
      message.error('请上传 mp3 或 wav 格式的音频文件')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      message.error('文件大小不能超过 10MB')
      return
    }

    const newSound = await soundManager.addCustomSound(file)
    if (newSound) {
      message.success('铃声上传成功')
      loadSounds()
    } else {
      message.error('上传失败，请重试')
    }
  }

  const handleStartEdit = (sound: SoundOption) => {
    setEditingId(sound.id)
    setEditingName(sound.name)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return

    const success = await soundManager.updateSoundName(editingId, editingName.trim())
    if (success) {
      message.success('名称已更新')
      loadSounds()
    } else {
      message.error('更新失败')
    }
    setEditingId(null)
    setEditingName('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const builtInSounds = sounds.filter(s => s.isBuiltIn)
  const customSounds = sounds.filter(s => !s.isBuiltIn)

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ marginBottom: 24 }}>
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}
          >
            上传自定义铃声
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            支持 mp3、wav 格式，最大 10MB
          </Text>
        </Space>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              handleFileUpload(file)
            }
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
          }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
          <SoundOutlined style={{ marginRight: 6 }} />
          内置铃声
        </Text>
        <List
          dataSource={builtInSounds}
          renderItem={(sound) => (
            <List.Item
              key={sound.id}
              style={{
                padding: '12px 16px',
                marginBottom: 8,
                borderRadius: 8,
                backgroundColor: defaultSoundId === sound.id ? '#e6f4ff' : '#fafafa',
                border: defaultSoundId === sound.id ? '1px solid #1677ff' : '1px solid #f0f0f0'
              }}
              actions={[
                <Tooltip title="播放" key="play">
                  <Button
                    type="text"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handlePlay(sound)}
                    size="small"
                  />
                </Tooltip>,
                defaultSoundId === sound.id ? (
                  <Tag color="blue" key="default">
                    <CheckOutlined /> 默认
                  </Tag>
                ) : (
                  <Tooltip title="设为默认" key="default">
                    <Button
                      type="text"
                      size="small"
                      onClick={() => handleSetDefault(sound.id)}
                    >
                      设为默认
                    </Button>
                  </Tooltip>
                )
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>{sound.name}</Text>
                    <Tag color="default">内置</Tag>
                  </Space>
                }
                description={
                  <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
                    {sound.description}
                  </Paragraph>
                }
              />
            </List.Item>
          )}
        />
      </div>

      {customSounds.length > 0 && (
        <div>
          <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
            <UploadOutlined style={{ marginRight: 6 }} />
            自定义铃声
          </Text>
          <List
            dataSource={customSounds}
            renderItem={(sound) => (
              <List.Item
                key={sound.id}
                style={{
                  padding: '12px 16px',
                  marginBottom: 8,
                  borderRadius: 8,
                  backgroundColor: defaultSoundId === sound.id ? '#e6f4ff' : '#fafafa',
                  border: defaultSoundId === sound.id ? '1px solid #1677ff' : '1px solid #f0f0f0'
                }}
                actions={[
                  <Tooltip title="播放" key="play">
                    <Button
                      type="text"
                      icon={<PlayCircleOutlined />}
                      onClick={() => handlePlay(sound)}
                      size="small"
                    />
                  </Tooltip>,
                  editingId === sound.id ? (
                    <Tooltip title="保存" key="save">
                      <Button
                        type="text"
                        icon={<SaveOutlined />}
                        onClick={handleSaveEdit}
                        size="small"
                      />
                    </Tooltip>
                  ) : (
                    <Tooltip title="重命名" key="edit">
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => handleStartEdit(sound)}
                        size="small"
                      />
                    </Tooltip>
                  ),
                  defaultSoundId === sound.id ? (
                    <Tag color="blue" key="default">
                      <CheckOutlined /> 默认
                    </Tag>
                  ) : (
                    <Tooltip title="设为默认" key="default">
                      <Button
                        type="text"
                        size="small"
                        onClick={() => handleSetDefault(sound.id)}
                      >
                        设为默认
                      </Button>
                    </Tooltip>
                  ),
                  <Popconfirm
                    title="确定要删除这个铃声吗？"
                    description="删除后，使用此铃声的任务将恢复为默认铃声"
                    onConfirm={() => handleDelete(sound.id)}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    key="delete"
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
                ]}
              >
                <List.Item.Meta
                  title={
                    editingId === sound.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onPressEnter={handleSaveEdit}
                        onBlur={handleCancelEdit}
                        size="small"
                        autoFocus
                        style={{ width: 200 }}
                      />
                    ) : (
                      <Space>
                        <Text strong>{sound.name}</Text>
                        <Tag color="purple">自定义</Tag>
                        {sound.fileName && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            ({sound.fileName})
                          </Text>
                        )}
                      </Space>
                    )
                  }
                  description={
                    <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
                      {sound.description}
                    </Paragraph>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}

      {customSounds.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          <UploadOutlined style={{ fontSize: 36, marginBottom: 12 }} />
          <Paragraph type="secondary" style={{ margin: 0 }}>
            暂无自定义铃声，点击上方按钮上传
          </Paragraph>
        </div>
      )}
    </div>
  )
}
