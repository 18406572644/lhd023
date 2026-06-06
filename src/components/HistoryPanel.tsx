import React from 'react'
import { Table, Empty, Tag, Typography, Button, Space } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { TaskHistory } from '../types'

const { Text } = Typography

interface HistoryPanelProps {
  history: TaskHistory[]
  onClear: () => void
}

const statusMap: Record<string, { text: string; color: string }> = {
  completed: { text: '已提醒', color: 'success' },
  skipped: { text: '已跳过', color: 'default' },
  failed: { text: '失败', color: 'error' }
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onClear }) => {
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
    </div>
  )
}
