import React, { useState } from 'react'
import { Table, Empty, Tag, Typography, Button, Space, Modal, Select, DatePicker, message, Radio } from 'antd'
import { DeleteOutlined, ExportOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type { TaskHistory } from '../types'
import { exportHistory, type ExportFormat, type TimeRange, filterHistoryByTimeRange } from '../utils/export'

const { Text } = Typography
const { RangePicker } = DatePicker
const { Option } = Select
const { Group, Button: RadioButton } = Radio

interface HistoryPanelProps {
  history: TaskHistory[]
  onClear: () => void
}

const statusMap: Record<string, { text: string; color: string }> = {
  completed: { text: '已提醒', color: 'success' },
  skipped: { text: '已跳过', color: 'default' },
  failed: { text: '失败', color: 'error' }
}

const timeRangeOptions = [
  { value: 'all', label: '全部' },
  { value: '7days', label: '近7天' },
  { value: '30days', label: '近30天' },
  { value: 'custom', label: '自定义' }
]

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onClear }) => {
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv')
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [customDateRange, setCustomDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'taskTitle',
      key: 'taskTitle',
      width: '35%',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '触发时间',
      dataIndex: 'triggeredAt',
      key: 'triggeredAt',
      width: '30%',
      sorter: (a: any, b: any) => dayjs(a.triggeredAt).valueOf() - dayjs(b.triggeredAt).valueOf(),
      defaultSortOrder: 'descend' as const,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: '20%',
      render: (status: string) => {
        const info = statusMap[status] || statusMap.skipped
        return <Tag color={info.color}>{info.text}</Tag>
      }
    }
  ]

  const handleExport = () => {
    let customStart: string | undefined
    let customEnd: string | undefined

    if (timeRange === 'custom') {
      if (!customDateRange || !customDateRange[0] || !customDateRange[1]) {
        message.warning('请选择自定义时间范围')
        return
      }
      customStart = customDateRange[0].format('YYYY-MM-DD')
      customEnd = customDateRange[1].format('YYYY-MM-DD')
    }

    const filtered = filterHistoryByTimeRange(history, timeRange, customStart, customEnd)

    if (filtered.length === 0) {
      message.warning('当前时间范围内没有可导出的记录')
      return
    }

    try {
      exportHistory(history, {
        format: exportFormat,
        timeRange,
        customStart,
        customEnd
      })
      message.success(`成功导出 ${filtered.length} 条记录`)
      setExportModalOpen(false)
    } catch (err) {
      console.error('导出失败:', err)
      message.error('导出失败，请重试')
    }
  }

  const openExportModal = () => {
    setExportFormat('csv')
    setTimeRange('all')
    setCustomDateRange(null)
    setExportModalOpen(true)
  }

  if (history.length === 0) {
    return (
      <div style={{ padding: '60px 0' }}>
        <Empty description="暂无提醒记录" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {history.length} 条记录
          </Text>
          <Button
            size="small"
            icon={<ExportOutlined />}
            onClick={openExportModal}
          >
            导出
          </Button>
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={onClear}
          >
            清空记录
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={history}
        rowKey="id"
        size="small"
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showQuickJumper: true
        }}
        showSorterTooltip={false}
      />

      <Modal
        title="导出历史记录"
        open={exportModalOpen}
        onOk={handleExport}
        onCancel={() => setExportModalOpen(false)}
        okText="导出"
        cancelText="取消"
        width={420}
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 20 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              导出格式
            </Text>
            <Group value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
              <RadioButton value="csv">CSV</RadioButton>
              <RadioButton value="excel">Excel</RadioButton>
            </Group>
          </div>

          <div style={{ marginBottom: 20 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              时间范围
            </Text>
            <Select
              value={timeRange}
              onChange={(value) => setTimeRange(value)}
              style={{ width: '100%' }}
            >
              {timeRangeOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </div>

          {timeRange === 'custom' && (
            <div style={{ marginBottom: 8 }}>
              <RangePicker
                value={customDateRange}
                onChange={(dates) => setCustomDateRange(dates)}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {timeRange !== 'custom' && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              预计导出 {filterHistoryByTimeRange(history, timeRange).length} 条记录
            </Text>
          )}
        </div>
      </Modal>
    </div>
  )
}
