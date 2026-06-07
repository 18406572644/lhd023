import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Statistic, Space, DatePicker, Select, Typography, Empty } from 'antd'
import { CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, FileTextOutlined, BarChartOutlined } from '@ant-design/icons'
import { Column, Pie } from '@ant-design/charts'
import dayjs, { Dayjs } from 'dayjs'
import type { Task, TaskHistory, TaskTag } from '../types'
import { getNextTriggerTime } from '../utils/scheduler'
import { tagColors, tagLabels } from '../utils/constants'

const { RangePicker } = DatePicker
const { Option } = Select
const { Title, Text } = Typography

interface StatsPanelProps {
  tasks: Task[]
  history: TaskHistory[]
}

type TimeRange = '7days' | '30days' | '90days' | 'custom'

const timeRangeOptions = [
  { value: '7days', label: '近7天' },
  { value: '30days', label: '近30天' },
  { value: '90days', label: '近90天' },
  { value: 'custom', label: '自定义' }
]

export const StatsPanel: React.FC<StatsPanelProps> = ({ tasks, history }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7days')
  const [customDateRange, setCustomDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)

  const dateRange = useMemo(() => {
    const now = dayjs()
    switch (timeRange) {
      case '7days':
        return { start: now.subtract(6, 'day').startOf('day'), end: now.endOf('day') }
      case '30days':
        return { start: now.subtract(29, 'day').startOf('day'), end: now.endOf('day') }
      case '90days':
        return { start: now.subtract(89, 'day').startOf('day'), end: now.endOf('day') }
      case 'custom':
        if (customDateRange && customDateRange[0] && customDateRange[1]) {
          return { start: customDateRange[0].startOf('day'), end: customDateRange[1].endOf('day') }
        }
        return { start: now.subtract(6, 'day').startOf('day'), end: now.endOf('day') }
      default:
        return { start: now.subtract(6, 'day').startOf('day'), end: now.endOf('day') }
    }
  }, [timeRange, customDateRange])

  const stats = useMemo(() => {
    const totalTasks = tasks.length
    const enabledTasks = tasks.filter(t => t.enabled).length

    const todayStart = dayjs().startOf('day')
    const todayEnd = dayjs().endOf('day')
    const todayReminders = tasks.filter(t => {
      if (!t.enabled) return false
      const nextTime = getNextTriggerTime(t)
      return nextTime && nextTime.isAfter(todayStart) && nextTime.isBefore(todayEnd)
    }).length

    const weekStart = dayjs().startOf('week')
    const weekEnd = dayjs().endOf('week')
    const weekCompleted = history.filter(h => {
      const triggeredAt = dayjs(h.triggeredAt)
      return h.status === 'completed' && triggeredAt.isAfter(weekStart) && triggeredAt.isBefore(weekEnd)
    }).length

    return {
      totalTasks,
      enabledTasks,
      todayReminders,
      weekCompleted
    }
  }, [tasks, history])

  const trendData = useMemo(() => {
    const { start, end } = dateRange
    const days: { date: string; dateKey: string; count: number }[] = []

    let current = start.clone()
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      const dateKey = current.format('YYYY-MM-DD')
      const dateLabel = current.format('MM-DD')
      days.push({ date: dateLabel, dateKey, count: 0 })
      current = current.add(1, 'day')
    }

    history.forEach(h => {
      const triggeredAt = dayjs(h.triggeredAt)
      if (triggeredAt.isAfter(start) && triggeredAt.isBefore(end)) {
        const dateKey = triggeredAt.format('YYYY-MM-DD')
        const day = days.find(d => d.dateKey === dateKey)
        if (day) {
          day.count++
        }
      }
    })

    return days.map(d => ({ date: d.date, count: d.count }))
  }, [history, dateRange])

  const tagData = useMemo(() => {
    const tagCounts: Record<TaskTag, number> = {
      work: 0,
      personal: 0,
      family: 0,
      health: 0,
      study: 0,
      other: 0
    }

    tasks.forEach(t => {
      if (tagCounts[t.tag] !== undefined) {
        tagCounts[t.tag]++
      }
    })

    return Object.entries(tagCounts)
      .filter(([, count]) => count > 0)
      .map(([tag, count]) => ({
        type: tagLabels[tag as TaskTag],
        value: count,
        color: tagColors[tag as TaskTag]
      }))
  }, [tasks])

  const statusData = useMemo(() => {
    const { start, end } = dateRange
    const statusCounts = {
      completed: 0,
      skipped: 0,
      failed: 0
    }

    history.forEach(h => {
      const triggeredAt = dayjs(h.triggeredAt)
      if (triggeredAt.isAfter(start) && triggeredAt.isBefore(end)) {
        if (statusCounts[h.status as keyof typeof statusCounts] !== undefined) {
          statusCounts[h.status as keyof typeof statusCounts]++
        }
      }
    })

    const statusMap: Record<string, { text: string; color: string }> = {
      completed: { text: '已完成', color: '#52c41a' },
      skipped: { text: '已跳过', color: '#faad14' },
      failed: { text: '失败', color: '#f5222d' }
    }

    return Object.entries(statusCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        type: statusMap[status].text,
        value: count,
        color: statusMap[status].color
      }))
  }, [history, dateRange])

  const columnConfig = {
    data: trendData,
    xField: 'date',
    yField: 'count',
    color: '#1677ff',
    columnStyle: {
      radius: [4, 4, 0, 0]
    },
    label: {
      style: {
        fill: '#000',
        opacity: 0.8
      },
      position: 'top' as const
    },
    xAxis: {
      label: {
        autoHide: true,
        autoRotate: false
      }
    },
    yAxis: {
      label: {
        formatter: (v: string) => v
      }
    },
    smooth: true,
    animation: {
      appear: {
        animation: 'scale-in-y',
        duration: 500
      }
    }
  }

  const pieConfig = {
    data: tagData,
    angleField: 'value',
    colorField: 'type',
    color: tagData.map(d => d.color),
    radius: 0.8,
    label: {
      type: 'outer' as const,
      content: '{name}: {percentage}'
    },
    legend: {
      position: 'bottom' as const
    },
    interactions: [
      { type: 'pie-legend-active' },
      { type: 'element-active' }
    ]
  }

  const ringConfig = {
    data: statusData,
    angleField: 'value',
    colorField: 'type',
    color: statusData.map(d => d.color),
    radius: 0.8,
    innerRadius: 0.5,
    label: {
      type: 'outer' as const,
      content: '{name}: {percentage}'
    },
    legend: {
      position: 'bottom' as const
    },
    interactions: [
      { type: 'pie-legend-active' },
      { type: 'element-active' }
    ]
  }

  if (tasks.length === 0 && history.length === 0) {
    return (
      <div style={{ padding: '60px 0' }}>
        <Empty description="暂无数据，请先创建任务" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <BarChartOutlined style={{ fontSize: 20, color: '#1677ff' }} />
          <Title level={5} style={{ margin: 0 }}>数据统计</Title>
        </Space>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>时间范围：</Text>
          <Select
            value={timeRange}
            onChange={(value) => setTimeRange(value)}
            style={{ width: 120 }}
            size="small"
          >
            {timeRangeOptions.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
          {timeRange === 'custom' && (
            <RangePicker
              size="small"
              value={customDateRange}
              onChange={(dates) => setCustomDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
            />
          )}
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 8, height: '100%' }}>
            <Statistic
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#1677ff' }} />
                  <span>总任务数</span>
                </Space>
              }
              value={stats.totalTasks}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 8, height: '100%' }}>
            <Statistic
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <span>已启用任务</span>
                </Space>
              }
              value={stats.enabledTasks}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 8, height: '100%' }}>
            <Statistic
              title={
                <Space>
                  <ClockCircleOutlined style={{ color: '#faad14' }} />
                  <span>今日待提醒</span>
                </Space>
              }
              value={stats.todayReminders}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 8, height: '100%' }}>
            <Statistic
              title={
                <Space>
                  <CalendarOutlined style={{ color: '#722ed1' }} />
                  <span>本周已完成</span>
                </Space>
              }
              value={stats.weekCompleted}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="近7天提醒趋势" bordered={false} style={{ borderRadius: 8, height: '100%' }}>
            <div style={{ height: 320 }}>
              {trendData.some(d => d.count > 0) ? (
                <Column {...columnConfig} />
              ) : (
                <Empty description="暂无提醒数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card title="各标签任务占比" bordered={false} style={{ borderRadius: 8, height: '100%' }}>
            <div style={{ height: 320 }}>
              {tagData.length > 0 ? (
                <Pie {...pieConfig} />
              ) : (
                <Empty description="暂无任务数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card title="各状态占比" bordered={false} style={{ borderRadius: 8, height: '100%' }}>
            <div style={{ height: 320 }}>
              {statusData.length > 0 ? (
                <Pie {...ringConfig} />
              ) : (
                <Empty description="暂无状态数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
