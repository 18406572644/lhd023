import React, { useState, useEffect, useRef } from 'react'
import { List, Button, message, Space, Tooltip, Popconfirm, Typography, Tag, Input, Tabs, Switch } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckOutlined,
  DeleteOutlined,
  UploadOutlined,
  SoundOutlined,
  EditOutlined,
  SaveOutlined,
  KeyOutlined,
  ReloadOutlined,
  StopOutlined
} from '@ant-design/icons'
import type { SoundOption, HotkeyConfig } from '../types'
import { soundManager } from '../utils/soundManager'
import { storage } from '../utils/storage'

const { Text, Paragraph } = Typography

interface SettingsPanelProps {
  onClose?: () => void
}

export const SettingsPanel: React.FC<SettingsPanelProps> = () => {
  const [sounds, setSounds] = useState<SoundOption[]>([])
  const [defaultSoundId, setDefaultSoundId] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [hotkeys, setHotkeys] = useState<HotkeyConfig[]>([])
  const [recordingHotkeyId, setRecordingHotkeyId] = useState<string | null>(null)
  const [tempAccelerator, setTempAccelerator] = useState('')
  const recordingRef = useRef<boolean>(false)

  const loadSounds = async () => {
    const [loadedSounds, loadedDefault] = await Promise.all([
      soundManager.getAllSounds(),
      soundManager.getDefaultSoundId()
    ])
    setSounds(loadedSounds)
    setDefaultSoundId(loadedDefault)
  }

  const loadHotkeys = async () => {
    const loadedHotkeys = await storage.getHotkeys()
    setHotkeys(loadedHotkeys)
  }

  useEffect(() => {
    loadSounds()
    loadHotkeys()
    const unsubscribe = soundManager.subscribeToPlayState((soundId, isPlaying) => {
      setPlayingSoundId(isPlaying ? soundId : null)
    })
    return () => {
      unsubscribe()
      soundManager.stopSound()
      stopRecording()
    }
  }, [])

  const handleTogglePlay = (sound: SoundOption) => {
    soundManager.toggleSound(sound)
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

  const normalizeKey = (key: string): string => {
    const keyMap: Record<string, string> = {
      'Control': 'Ctrl',
      ' ': 'Space',
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right'
    }
    return keyMap[key] || key
  }

  const startRecording = (hotkeyId: string) => {
    setRecordingHotkeyId(hotkeyId)
    setTempAccelerator('')
    recordingRef.current = true
  }

  const stopRecording = () => {
    setRecordingHotkeyId(null)
    setTempAccelerator('')
    recordingRef.current = false
  }

  const handleHotkeyKeyDown = (e: React.KeyboardEvent, hotkey: HotkeyConfig) => {
    if (recordingHotkeyId !== hotkey.id) return

    e.preventDefault()
    e.stopPropagation()

    const keys: string[] = []

    if (e.ctrlKey) keys.push('Ctrl')
    if (e.altKey) keys.push('Alt')
    if (e.shiftKey) keys.push('Shift')
    if (e.metaKey) keys.push('Cmd')

    const nonModifierKey = normalizeKey(e.key)
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      keys.push(nonModifierKey)
    }

    const accelerator = keys.join('+')
    setTempAccelerator(accelerator)

    if (keys.length >= 2 && !['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      setTimeout(() => {
        saveHotkey(hotkey, accelerator)
      }, 300)
    }
  }

  const saveHotkey = async (hotkey: HotkeyConfig, newAccelerator: string) => {
    if (!newAccelerator || newAccelerator.split('+').length < 2) {
      message.warning('请至少选择一个修饰键（Ctrl/Alt/Shift）和一个其他键')
      stopRecording()
      return
    }

    const existingHotkey = hotkeys.find(h => h.accelerator === newAccelerator && h.id !== hotkey.id)
    if (existingHotkey) {
      message.warning(`快捷键 "${newAccelerator}" 已被 "${existingHotkey.name}" 使用`)
      stopRecording()
      return
    }

    try {
      if (hotkey.accelerator !== newAccelerator) {
        await storage.unregisterHotkey(hotkey.accelerator)
      }

      const success = await storage.registerHotkey(newAccelerator, hotkey.id)
      if (!success) {
        message.error('快捷键注册失败，请尝试其他组合')
        stopRecording()
        return
      }

      const updatedHotkeys = hotkeys.map(h =>
        h.id === hotkey.id ? { ...h, accelerator: newAccelerator } : h
      )
      await storage.saveHotkeys(updatedHotkeys)
      setHotkeys(updatedHotkeys)
      message.success('快捷键已更新')
    } catch (err) {
      console.error('保存快捷键失败:', err)
      message.error('保存失败，请重试')
    }

    stopRecording()
  }

  const handleResetHotkey = async (hotkey: HotkeyConfig) => {
    try {
      if (hotkey.accelerator !== hotkey.defaultAccelerator) {
        await storage.unregisterHotkey(hotkey.accelerator)
      }

      const success = await storage.registerHotkey(hotkey.defaultAccelerator, hotkey.id)
      if (!success) {
        message.error('重置失败，请重试')
        return
      }

      const updatedHotkeys = hotkeys.map(h =>
        h.id === hotkey.id ? { ...h, accelerator: h.defaultAccelerator } : h
      )
      await storage.saveHotkeys(updatedHotkeys)
      setHotkeys(updatedHotkeys)
      message.success('已恢复默认快捷键')
    } catch (err) {
      console.error('重置快捷键失败:', err)
      message.error('重置失败，请重试')
    }
  }

  const handleToggleHotkey = async (hotkey: HotkeyConfig, enabled: boolean) => {
    try {
      if (enabled) {
        const success = await storage.registerHotkey(hotkey.accelerator, hotkey.id)
        if (!success) {
          message.error('快捷键注册失败，请检查是否与其他程序冲突')
          return
        }
      } else {
        await storage.unregisterHotkey(hotkey.accelerator)
      }

      const updatedHotkeys = hotkeys.map(h =>
        h.id === hotkey.id ? { ...h, enabled } : h
      )
      await storage.saveHotkeys(updatedHotkeys)
      setHotkeys(updatedHotkeys)
      message.success(enabled ? '快捷键已启用' : '快捷键已禁用')
    } catch (err) {
      console.error('切换快捷键状态失败:', err)
      message.error('操作失败，请重试')
    }
  }

  const builtInSounds = sounds.filter(s => s.isBuiltIn)
  const customSounds = sounds.filter(s => !s.isBuiltIn)

  const soundTabContent = (
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
                <Tooltip title={playingSoundId === sound.id ? '暂停' : '播放'} key="play">
                  <Button
                    type="text"
                    icon={playingSoundId === sound.id ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    onClick={() => handleTogglePlay(sound)}
                    size="small"
                    style={{
                      color: playingSoundId === sound.id ? '#1677ff' : undefined
                    }}
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
                  <Tooltip title={playingSoundId === sound.id ? '暂停' : '播放'} key="play">
                    <Button
                      type="text"
                      icon={playingSoundId === sound.id ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                      onClick={() => handleTogglePlay(sound)}
                      size="small"
                      style={{
                        color: playingSoundId === sound.id ? '#1677ff' : undefined
                      }}
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

  const hotkeyTabContent = (
    <div style={{ padding: '16px 0' }}>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          全局快捷键可在任何界面下快速执行对应操作。点击输入框后按下新的快捷键组合进行修改。
        </Text>
      </div>

      <List
        dataSource={hotkeys}
        renderItem={(hotkey) => (
          <List.Item
            key={hotkey.id}
            style={{
              padding: '16px',
              marginBottom: 8,
              borderRadius: 8,
              backgroundColor: hotkey.enabled ? '#fafafa' : '#f5f5f5',
              border: '1px solid #f0f0f0'
            }}
            actions={[
              <Switch
                key="toggle"
                checked={hotkey.enabled}
                onChange={(checked) => handleToggleHotkey(hotkey, checked)}
                size="small"
              />
            ]}
          >
            <List.Item.Meta
              avatar={
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: hotkey.enabled ? '#1677ff' : '#bfbfbf',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff'
                  }}
                >
                  <KeyOutlined />
                </div>
              }
              title={
                <Space>
                  <Text strong>{hotkey.name}</Text>
                  {!hotkey.enabled && <Tag color="default">已禁用</Tag>}
                </Space>
              }
              description={
                <div>
                  <Paragraph type="secondary" style={{ margin: '0 0 8px 0', fontSize: 12 }}>
                    {hotkey.description}
                  </Paragraph>
                  <Space>
                    {recordingHotkeyId === hotkey.id ? (
                      <Input
                        value={tempAccelerator || '按下快捷键组合...'}
                        onKeyDown={(e) => handleHotkeyKeyDown(e, hotkey)}
                        autoFocus
                        size="small"
                        style={{ width: 200, fontWeight: 'bold' }}
                        suffix={
                          <Button
                            type="text"
                            size="small"
                            icon={<StopOutlined />}
                            onClick={stopRecording}
                            danger
                          />
                        }
                      />
                    ) : (
                      <Tooltip title="点击修改快捷键">
                        <Button
                          size="small"
                          onClick={() => hotkey.enabled && startRecording(hotkey.id)}
                          disabled={!hotkey.enabled}
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            minWidth: 140,
                            justifyContent: 'center'
                          }}
                        >
                          {hotkey.accelerator}
                        </Button>
                      </Tooltip>
                    )}
                    {recordingHotkeyId !== hotkey.id && (
                      <>
                        {hotkey.accelerator !== hotkey.defaultAccelerator && (
                          <Tooltip title="恢复默认快捷键">
                            <Button
                              type="text"
                              size="small"
                              icon={<ReloadOutlined />}
                              onClick={() => handleResetHotkey(hotkey)}
                              disabled={!hotkey.enabled}
                            >
                              重置
                            </Button>
                          </Tooltip>
                        )}
                        <Tooltip title="默认快捷键">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            默认: {hotkey.defaultAccelerator}
                          </Text>
                        </Tooltip>
                      </>
                    )}
                  </Space>
                </div>
              }
            />
          </List.Item>
        )}
      />

      {recordingHotkeyId && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: 8,
            textAlign: 'center'
          }}
        >
          <Space>
            <KeyOutlined style={{ color: '#fa8c16' }} />
            <Text type="warning">
              正在录制快捷键... 请按下新的快捷键组合（如 Ctrl+Alt+N），或点击取消按钮停止
            </Text>
          </Space>
        </div>
      )}
    </div>
  )

  const tabItems = [
    {
      key: 'sounds',
      label: (
        <Space>
          <SoundOutlined />
          铃声设置
        </Space>
      ),
      children: soundTabContent
    },
    {
      key: 'hotkeys',
      label: (
        <Space>
          <KeyOutlined />
          快捷键设置
        </Space>
      ),
      children: hotkeyTabContent
    }
  ]

  return (
    <Tabs
      items={tabItems}
      defaultActiveKey="sounds"
      size="large"
    />
  )
}
