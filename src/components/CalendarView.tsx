import React, { useState, useMemo, useRef } from 'react'
import { Button, Space, Typography, Modal, List, Tag, Tooltip, Badge, Dropdown, MenuProps } from 'antd'
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  BellOutlined
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type { Task } from '../types'
import { getNextTriggerTime } from '../utils/scheduler'
import {
  priorityColors,
  priorityLabels,
  tagColors,
  tagLabels,
  getTaskColor
} from '../utils/constants'
import type { ViewType } from '../utils/constants'

const { Title, Text } = Typography

interface CalendarViewProps {
  tasks: Task[]
  onAddTask: (defaultTime?: Dayjs) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (id: string) => void
  onUpdateTaskTime: (task: Task, newTime: string) => void
}

interface DayTasks {
  [date: string]: Task[]
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onUpdateTaskTime
}) => {
  const [viewType, setViewType] = useState<ViewType>('month')
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs())
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [dayModalOpen, setDayModalOpen] = useState(false)
  const [draggingTask, setDraggingTask] = useState<Task | null>(null)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  const getTaskTime = (task: Task): Dayjs => {
    const nextTime = getNextTriggerTime(task)
    return nextTime || dayjs(task.targetTime)
  }

  const getTaskEndTime = (task: Task): Dayjs => {
    const startTime = getTaskTime(task)
    const duration = task.duration || 30
    return startTime.add(duration, 'minute')
  }

  const isTaskOnDay = (task: Task, date: Dayjs): boolean => {
    const taskTime = getTaskTime(task)
    return taskTime.isSame(date, 'day')
  }

  const getTasksByDate = useMemo((): DayTasks => {
    const result: DayTasks = {}
    tasks.forEach((task) => {
      if (!task.enabled) return
      const taskTime = getTaskTime(task)
      if (!taskTime) return

      if (task.repeatType === 'none') {
        const dateKey = taskTime.format('YYYY-MM-DD')
        if (!result[dateKey]) result[dateKey] = []
        result[dateKey].push(task)
      } else {
        let checkDate = currentDate.startOf(viewType === 'month' ? 'month' : viewType === 'week' ? 'week' : 'day')
        const endDate = currentDate.endOf(viewType === 'month' ? 'month' : viewType === 'week' ? 'week' : 'day')
        
        while (checkDate.isBefore(endDate) || checkDate.isSame(endDate, 'day')) {
          if (isTaskOnDay(task, checkDate)) {
            const dateKey = checkDate.format('YYYY-MM-DD')
            if (!result[dateKey]) result[dateKey] = []
            result[dateKey].push(task)
          }
          checkDate = checkDate.add(1, 'day')
        }
      }
    })
    
    Object.keys(result).forEach((dateKey) => {
      result[dateKey].sort((a, b) => {
        return getTaskTime(a).valueOf() - getTaskTime(b).valueOf()
      })
    })
    
    return result
  }, [tasks, currentDate, viewType])

  const navigatePrevious = () => {
    if (viewType === 'month') {
      setCurrentDate(currentDate.subtract(1, 'month'))
    } else if (viewType === 'week') {
      setCurrentDate(currentDate.subtract(1, 'week'))
    } else {
      setCurrentDate(currentDate.subtract(1, 'day'))
    }
  }

  const navigateNext = () => {
    if (viewType === 'month') {
      setCurrentDate(currentDate.add(1, 'month'))
    } else if (viewType === 'week') {
      setCurrentDate(currentDate.add(1, 'week'))
    } else {
      setCurrentDate(currentDate.add(1, 'day'))
    }
  }

  const navigateToday = () => {
    setCurrentDate(dayjs())
    setSelectedDate(dayjs())
  }

  const handleDayClick = (date: Dayjs) => {
    setSelectedDate(date)
    setDayModalOpen(true)
  }

  const handleTimeSlotClick = (date: Dayjs, hour: number) => {
    const time = date.hour(hour).minute(0)
    onAddTask(time)
  }

  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    setDraggingTask(task)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
  }

  const handleTaskDragEnd = () => {
    setDraggingTask(null)
    setDragOverCell(null)
  }

  const handleCellDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCell(dateKey)
  }

  const handleCellDragLeave = () => {
    setDragOverCell(null)
  }

  const handleCellDrop = (e: React.DragEvent, date: Dayjs, hour?: number) => {
    e.preventDefault()
    if (!draggingTask) return

    let newTime = date
    if (hour !== undefined) {
      newTime = date.hour(hour).minute(0)
    } else {
      const originalTime = getTaskTime(draggingTask)
      newTime = date.hour(originalTime.hour()).minute(originalTime.minute())
    }

    onUpdateTaskTime(draggingTask, newTime.toISOString())
    setDraggingTask(null)
    setDragOverCell(null)
  }

  const getSelectedDateTasks = (): Task[] => {
    const dateKey = selectedDate.format('YYYY-MM-DD')
    return getTasksByDate[dateKey] || []
  }

  const getHeaderTitle = (): string => {
    if (viewType === 'month') {
      return currentDate.format('YYYY年M月')
    } else if (viewType === 'week') {
      const start = currentDate.startOf('week')
      const end = currentDate.endOf('week')
      if (start.month() === end.month()) {
        return `${start.format('YYYY年M月D日')} - ${end.format('D日')}`
      } else {
        return `${start.format('YYYY年M月D日')} - ${end.format('M月D日')}`
      }
    } else {
      return currentDate.format('YYYY年M月D日 dddd')
    }
  }

  const viewMenuItems: MenuProps['items'] = [
    { key: 'month', label: '月视图' },
    { key: 'week', label: '周视图' },
    { key: 'day', label: '日视图' }
  ]

  const handleViewMenuClick: MenuProps['onClick'] = ({ key }) => {
    setViewType(key as ViewType)
  }

  const renderMonthView = () => {
    const startOfMonth = currentDate.startOf('month')
    const endOfMonth = currentDate.endOf('month')
    const startDay = startOfMonth.startOf('week')
    const endDay = endOfMonth.endOf('week')

    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const days: Dayjs[] = []
    let day = startDay

    while (day.isBefore(endDay) || day.isSame(endDay, 'day')) {
      days.push(day)
      day = day.add(1, 'day')
    }

    return (
      <div className="calendar-month-view">
        <div className="calendar-weekdays">
          {weekDays.map((wd, idx) => (
            <div
              key={wd}
              className="calendar-weekday"
              style={{
                color: idx === 0 || idx === 6 ? '#f5222d' : '#666'
              }}
            >
              {wd}
            </div>
          ))}
        </div>
        <div className="calendar-days-grid">
          {days.map((date) => {
            const dateKey = date.format('YYYY-MM-DD')
            const dayTasks = getTasksByDate[dateKey] || []
            const isCurrentMonth = date.month() === currentDate.month()
            const isToday = date.isSame(dayjs(), 'day')
            const isSelected = date.isSame(selectedDate, 'day')
            const isDragOver = dragOverCell === dateKey

            return (
              <div
                key={dateKey}
                className={`calendar-day-cell ${isCurrentMonth ? '' : 'other-month'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
                onClick={() => handleDayClick(date)}
                onDragOver={(e) => handleCellDragOver(e, dateKey)}
                onDragLeave={handleCellDragLeave}
                onDrop={(e) => handleCellDrop(e, date)}
              >
                <div className="calendar-day-number">
                  {date.date()}
                  {dayTasks.length > 0 && (
                    <Badge
                      count={dayTasks.length}
                      size="small"
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </div>
                <div className="calendar-day-tasks">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="calendar-task-item"
                      draggable
                      onDragStart={(e) => handleTaskDragStart(e, task)}
                      onDragEnd={handleTaskDragEnd}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditTask(task)
                      }}
                      style={{
                        backgroundColor: getTaskColor(task.priority, task.tag) + '20',
                        borderLeft: `3px solid ${getTaskColor(task.priority, task.tag)}`
                      }}
                    >
                      <Text
                        ellipsis
                        style={{
                          fontSize: 12,
                          color: '#333'
                        }}
                      >
                        <ClockCircleOutlined style={{ fontSize: 10, marginRight: 2 }} />
                        {getTaskTime(task).format('HH:mm')} {task.title}
                      </Text>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="calendar-more-tasks">
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        还有 {dayTasks.length - 3} 个任务
                      </Text>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const startOfWeek = currentDate.startOf('week')
    const endOfWeek = currentDate.endOf('week')
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const days: Dayjs[] = []
    let day = startOfWeek

    while (day.isBefore(endOfWeek) || day.isSame(endOfWeek, 'day')) {
      days.push(day)
      day = day.add(1, 'day')
    }

    return (
      <div className="calendar-week-view">
        <div className="calendar-time-header">
          <div className="calendar-time-label" />
          {days.map((date) => {
            const isToday = date.isSame(dayjs(), 'day')
            return (
              <div
                key={date.format('YYYY-MM-DD')}
                className={`calendar-week-day-header ${isToday ? 'today' : ''}`}
              >
                <Text strong>{date.format('ddd')}</Text>
                <Text strong style={{ fontSize: 18 }}>{date.format('D')}</Text>
              </div>
            )
          })}
        </div>
        <div className="calendar-time-grid">
          {hours.map((hour) => (
            <React.Fragment key={hour}>
              <div className="calendar-time-label">
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {hour.toString().padStart(2, '0')}:00
                </Text>
              </div>
              {days.map((date) => {
                const dateKey = date.format('YYYY-MM-DD')
                const cellKey = `${dateKey}-${hour}`
                const isToday = date.isSame(dayjs(), 'day')
                const isDragOver = dragOverCell === cellKey
                const dayTasks = (getTasksByDate[dateKey] || []).filter(
                  (task) => getTaskTime(task).hour() === hour
                )

                return (
                  <div
                    key={cellKey}
                    className={`calendar-time-slot ${isToday ? 'today' : ''} ${isDragOver ? 'drag-over' : ''}`}
                    onClick={() => handleTimeSlotClick(date, hour)}
                    onDragOver={(e) => handleCellDragOver(e, cellKey)}
                    onDragLeave={handleCellDragLeave}
                    onDrop={(e) => handleCellDrop(e, date, hour)}
                  >
                    {dayTasks.map((task) => {
                      const taskTime = getTaskTime(task)
                      const duration = task.duration || 30
                      const topOffset = (taskTime.minute() / 60) * 100
                      const height = Math.max((duration / 60) * 100, 20)

                      return (
                        <div
                          key={task.id}
                          className="calendar-time-task"
                          draggable
                          onDragStart={(e) => handleTaskDragStart(e, task)}
                          onDragEnd={handleTaskDragEnd}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditTask(task)
                          }}
                          style={{
                            top: `${topOffset}%`,
                            height: `${height}%`,
                            backgroundColor: getTaskColor(task.priority, task.tag),
                            borderLeft: `3px solid ${getTaskColor(task.priority, task.tag)}`
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>
                            {taskTime.format('HH:mm')} {task.title}
                          </Text>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    )
  }

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const dateKey = currentDate.format('YYYY-MM-DD')
    const isToday = currentDate.isSame(dayjs(), 'day')
    const dayTasks = getTasksByDate[dateKey] || []

    return (
      <div className="calendar-day-view">
        <div className="calendar-time-grid single-day">
          {hours.map((hour) => {
            const cellKey = `${dateKey}-${hour}`
            const isDragOver = dragOverCell === cellKey
            const hourTasks = dayTasks.filter(
              (task) => getTaskTime(task).hour() === hour
            )

            return (
              <React.Fragment key={hour}>
                <div className="calendar-time-label">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {hour.toString().padStart(2, '0')}:00
                  </Text>
                </div>
                <div
                  key={cellKey}
                  className={`calendar-time-slot ${isToday ? 'today' : ''} ${isDragOver ? 'drag-over' : ''}`}
                  onClick={() => handleTimeSlotClick(currentDate, hour)}
                  onDragOver={(e) => handleCellDragOver(e, cellKey)}
                  onDragLeave={handleCellDragLeave}
                  onDrop={(e) => handleCellDrop(e, currentDate, hour)}
                >
                  {hourTasks.map((task) => {
                    const taskTime = getTaskTime(task)
                    const duration = task.duration || 30
                    const topOffset = (taskTime.minute() / 60) * 100
                    const height = Math.max((duration / 60) * 100, 25)

                    return (
                      <div
                        key={task.id}
                        className="calendar-time-task day-view"
                        draggable
                        onDragStart={(e) => handleTaskDragStart(e, task)}
                        onDragEnd={handleTaskDragEnd}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditTask(task)
                        }}
                        style={{
                          top: `${topOffset}%`,
                          height: `${height}%`,
                          backgroundColor: getTaskColor(task.priority, task.tag),
                          borderLeft: `4px solid ${getTaskColor(task.priority, task.tag)}`
                        }}
                      >
                        <div style={{ padding: '8px 12px' }}>
                          <Text strong style={{ color: '#fff', fontSize: 14 }}>
                            {taskTime.format('HH:mm')} - {getTaskEndTime(task).format('HH:mm')}
                          </Text>
                          <br />
                          <Text strong style={{ color: '#fff', fontSize: 16 }}>
                            {task.title}
                          </Text>
                          {task.description && (
                            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                              <br />{task.description}
                            </Text>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="calendar-view" ref={calendarRef}>
      <style>{`
        .calendar-view {
          background: #fff;
          border-radius: 8px;
          padding: 24px;
        }
        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .calendar-nav {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .calendar-title {
          margin: 0 16px;
          min-width: 200px;
          text-align: center;
        }
        .calendar-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          border-bottom: 1px solid #f0f0f0;
          margin-bottom: 8px;
        }
        .calendar-weekday {
          padding: 12px 8px;
          text-align: center;
          font-weight: 500;
          font-size: 14px;
        }
        .calendar-days-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          background: #f0f0f0;
        }
        .calendar-day-cell {
          background: #fff;
          min-height: 120px;
          padding: 8px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        .calendar-day-cell:hover {
          background: #f5f5f5;
        }
        .calendar-day-cell.other-month {
          background: #fafafa;
        }
        .calendar-day-cell.other-month .calendar-day-number {
          color: #bfbfbf;
        }
        .calendar-day-cell.today {
          background: #e6f4ff;
        }
        .calendar-day-cell.today .calendar-day-number {
          color: #1677ff;
          font-weight: bold;
        }
        .calendar-day-cell.selected {
          background: #bae0ff;
        }
        .calendar-day-cell.drag-over {
          background: #d6e4ff;
          border: 2px dashed #1677ff;
        }
        .calendar-day-number {
          font-size: 14px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .calendar-day-tasks {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .calendar-task-item {
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: transform 0.15s;
        }
        .calendar-task-item:hover {
          transform: translateX(2px);
        }
        .calendar-more-tasks {
          padding-left: 8px;
        }
        .calendar-week-view,
        .calendar-day-view {
          overflow-x: auto;
        }
        .calendar-time-header {
          display: grid;
          grid-template-columns: 60px repeat(7, 1fr);
          border-bottom: 2px solid #f0f0f0;
          position: sticky;
          top: 0;
          background: #fff;
          z-index: 10;
        }
        .calendar-week-day-header {
          padding: 16px 8px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .calendar-week-day-header.today {
          background: #e6f4ff;
        }
        .calendar-time-grid {
          display: grid;
          grid-template-columns: 60px repeat(7, 1fr);
          overflow-y: auto;
          max-height: 600px;
        }
        .calendar-time-grid.single-day {
          grid-template-columns: 60px 1fr;
        }
        .calendar-time-label {
          padding: 8px;
          text-align: right;
          border-right: 1px solid #f0f0f0;
          border-bottom: 1px solid #f0f0f0;
          background: #fafafa;
          position: sticky;
          left: 0;
          z-index: 5;
        }
        .calendar-time-slot {
          border-right: 1px solid #f0f0f0;
          border-bottom: 1px solid #f0f0f0;
          min-height: 60px;
          cursor: pointer;
          position: relative;
          transition: background 0.15s;
        }
        .calendar-time-slot:hover {
          background: #f5f5f5;
        }
        .calendar-time-slot.today {
          background: #f0f8ff;
        }
        .calendar-time-slot.drag-over {
          background: #d6e4ff;
          border: 2px dashed #1677ff;
        }
        .calendar-time-task {
          position: absolute;
          left: 2px;
          right: 2px;
          border-radius: 4px;
          padding: 2px 6px;
          cursor: pointer;
          overflow: hidden;
          transition: transform 0.15s, box-shadow 0.15s;
          z-index: 1;
        }
        .calendar-time-task:hover {
          transform: scale(1.02);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        .calendar-time-task.day-view {
          left: 4px;
          right: 4px;
          border-radius: 6px;
        }
      `}</style>

      <div className="calendar-header">
        <Space>
          <Dropdown menu={{ items: viewMenuItems, onClick: handleViewMenuClick }}>
            <Button icon={<CalendarOutlined />}>
              {viewType === 'month' ? '月视图' : viewType === 'week' ? '周视图' : '日视图'}
            </Button>
          </Dropdown>
          <div className="calendar-nav">
            <Button
              icon={<LeftOutlined />}
              onClick={navigatePrevious}
              size="small"
            />
            <Title level={4} className="calendar-title" style={{ margin: 0 }}>
              {getHeaderTitle()}
            </Title>
            <Button
              icon={<RightOutlined />}
              onClick={navigateNext}
              size="small"
            />
          </div>
          <Button onClick={navigateToday} size="small">
            今天
          </Button>
        </Space>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => onAddTask()}
          >
            新建任务
          </Button>
        </Space>
      </div>

      {viewType === 'month' && renderMonthView()}
      {viewType === 'week' && renderWeekView()}
      {viewType === 'day' && renderDayView()}

      <Modal
        title={`${selectedDate.format('YYYY年M月D日 dddd')} 的任务`}
        open={dayModalOpen}
        onCancel={() => setDayModalOpen(false)}
        footer={[
          <Button
            key="add"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setDayModalOpen(false)
              onAddTask(selectedDate)
            }}
          >
            添加任务
          </Button>,
          <Button key="close" onClick={() => setDayModalOpen(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {getSelectedDateTasks().length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            <CalendarOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <p>当天暂无任务</p>
          </div>
        ) : (
          <List
            dataSource={getSelectedDateTasks()}
            renderItem={(task) => (
              <List.Item
                style={{
                  padding: '12px 16px',
                  marginBottom: 8,
                  borderRadius: 8,
                  borderLeft: `4px solid ${getTaskColor(task.priority, task.tag)}`,
                  backgroundColor: getTaskColor(task.priority, task.tag) + '10'
                }}
                actions={[
                  <Tooltip title="编辑" key="edit">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => {
                        setDayModalOpen(false)
                        onEditTask(task)
                      }}
                    />
                  </Tooltip>,
                  <Tooltip title="删除" key="delete">
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={() => onDeleteTask(task.id)}
                    />
                  </Tooltip>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 6,
                        backgroundColor: getTaskColor(task.priority, task.tag),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                      }}
                    >
                      <BellOutlined style={{ fontSize: 18 }} />
                    </div>
                  }
                  title={
                    <Space>
                      <Text strong>{task.title}</Text>
                      <Tag color={tagColors[task.tag]}>{tagLabels[task.tag]}</Tag>
                      <Tag color={priorityColors[task.priority]}>{priorityLabels[task.priority]}优先级</Tag>
                    </Space>
                  }
                  description={
                    <div>
                      {task.description && (
                        <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                          {task.description}
                        </Text>
                      )}
                      <Space size={16}>
                        <Text type="secondary">
                          <ClockCircleOutlined style={{ marginRight: 4 }} />
                          {getTaskTime(task).format('HH:mm')}
                          {task.duration && ` - ${getTaskEndTime(task).format('HH:mm')}`}
                        </Text>
                      </Space>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  )
}
