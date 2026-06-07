import React, { useState } from 'react'
import { Drawer, Typography, Tag, Space, Progress, Button, List, InputNumber, message, Tooltip, Empty, Card, Timeline, Statistic, Row, Col, Modal } from 'antd'
import { EditOutlined, DeleteOutlined, LinkOutlined, ClockCircleOutlined, CalendarOutlined, UserOutlined, ExclamationCircleOutlined, CheckCircleOutlined, PlusOutlined, ArrowUpOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Objective, KeyResult, Task } from '../types'
import { okrStatusColors, okrStatusLabels, okrPriorityColors, okrPriorityLabels, tagColors, tagLabels, krTypeColors, krTypeLabels, getProgressColor, MILESTONES } from '../utils/constants'
import { calculateObjectiveProgress, calculateKRProgress, getLinkedTasksForObjective } from '../utils/okrManager'

const { Title, Text, Paragraph } = Typography
const { confirm } = Modal

interface OKRDetailPanelProps {
  open: boolean
  objective: Objective | null
  tasks: Task[]
  onClose: () => void
  onEdit: (objective: Objective) => void
  onEditKR: (objective: Objective) => void
  onDeleteKR: (objectiveId: string, krId: string) => void
  onUpdateKRProgress: (objectiveId: string, krId: string, currentValue: number) => void
  onAddKR: (objective: Objective) => void
}

export const OKRDetailPanel: React.FC<OKRDetailPanelProps> = ({
  open,
  objective,
  tasks,
  onClose,
  onEdit,
  onEditKR,
  onDeleteKR,
  onUpdateKRProgress,
  onAddKR
}) => {
  const [editingKRId, setEditingKRId] = useState<string | null>(null)
  const [editingKRValue, setEditingKRValue] = useState<number | null>(0)

  if (!objective) return null

  const progress = calculateObjectiveProgress(objective)
  const progressColor = getProgressColor(progress.progress, progress.overdue)
  const linkedTasks = getLinkedTasksForObjective(objective, tasks)

  const handleDeleteKR = (kr: KeyResult) => {
    confirm({
      title: '确认删除KR',
      content: `确定要删除KR「${kr.title}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        onDeleteKR(objective.id, kr.id)
        message.success('KR已删除')
      }
    })
  }

  const handleStartEditKR = (kr: KeyResult) => {
    setEditingKRId(kr.id)
    setEditingKRValue(kr.currentValue)
  }

  const handleSaveKRProgress = (kr: KeyResult) => {
    if (editingKRValue !== null) {
      onUpdateKRProgress(objective.id, kr.id, editingKRValue)
    }
    setEditingKRId(null)
    message.success('进度已更新')
  }

  const getMilestoneTimeline = () => {
    return MILESTONES.map(milestone => {
      const achieved = progress.progress >= milestone
      const notified = objective.notifiedMilestones.includes(milestone)
      
      return {
        color: achieved ? '#52c41a' : '#d9d9d9',
        children: (
          <div>
            <Text strong={achieved} style={{ color: achieved ? '#52c41a' : 'inherit' }}>
              {milestone}%
              {milestone === 100 ? ' 完成' : ' 里程碑'}
            </Text>
            {achieved && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {notified ? '已发送通知' : '已达成'}
                </Text>
              </div>
            )}
            {!achieved && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  还需 {milestone - progress.progress}%
                </Text>
              </div>
            )}
          </div>
        )
      }
    })
  }

  return (
    <Drawer
      title={
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
            {objective.title}
          </Title>
          <Space wrap size={[8, 8]}>
            <Tag color={okrStatusColors[objective.status]} style={{ margin: 0 }}>
              {okrStatusLabels[objective.status]}
            </Tag>
            {progress.overdue && (
              <Tag color="red" icon={<ExclamationCircleOutlined />} style={{ margin: 0 }}>
                已逾期
              </Tag>
            )}
            <Tag
              color={okrPriorityColors[objective.priority]}
              style={{ margin: 0 }}
            >
              {okrPriorityLabels[objective.priority]}优先级
            </Tag>
          </Space>
        </div>
      }
      open={open}
      onClose={onClose}
      width={720}
      extra={
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => onEdit(objective)}
        >
          编辑目标
        </Button>
      }
    >
      <div style={{ paddingTop: 16 }}>
        {objective.description && (
          <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
            <Title level={5} style={{ marginBottom: 8 }}>目标描述</Title>
            <Paragraph style={{ margin: 0 }}>{objective.description}</Paragraph>
          </Card>
        )}

        <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
          <Title level={5} style={{ marginBottom: 12 }}>总体进度</Title>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Progress
                  type="circle"
                  percent={progress.progress}
                  strokeColor={progressColor}
                  size={120}
                  format={(percent) => (
                    <div>
                      <Text strong style={{ fontSize: 24, color: progressColor }}>
                        {percent}%
                      </Text>
                    </div>
                  )}
                />
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
                <Statistic
                  title="KR完成"
                  value={progress.completedKRs}
                  suffix={`/ ${progress.totalKRs}`}
                  valueStyle={{ color: progressColor }}
                />
                <div>
                  <Text type="secondary">
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {progress.daysRemaining > 0
                      ? `剩余 ${progress.daysRemaining} 天`
                      : progress.daysRemaining === 0
                        ? '今天截止'
                        : `已逾期 ${Math.abs(progress.daysRemaining)} 天`
                    }
                  </Text>
                </div>
              </div>
            </Col>
          </Row>
        </Card>

        <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
          <Title level={5} style={{ marginBottom: 12 }}>里程碑</Title>
          <Timeline
            items={getMilestoneTimeline()}
            mode="left"
            style={{ paddingLeft: 0 }}
          />
        </Card>

        <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
          <Title level={5} style={{ marginBottom: 12 }}>基本信息</Title>
          <Row gutter={[16, 12]}>
            <Col xs={24} sm={12}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  <CalendarOutlined style={{ marginRight: 4 }} />
                  时间周期
                </Text>
                <Text strong>
                  {dayjs(objective.startDate).format('YYYY-MM-DD')}
                  {' → '}
                  {dayjs(objective.endDate).format('YYYY-MM-DD')}
                </Text>
              </div>
            </Col>
            {objective.owner && (
              <Col xs={24} sm={12}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    <UserOutlined style={{ marginRight: 4 }} />
                    负责人
                  </Text>
                  <Text strong>{objective.owner}</Text>
                </div>
              </Col>
            )}
            {objective.tags.length > 0 && (
              <Col xs={24}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    关联标签
                  </Text>
                  <Space wrap>
                    {objective.tags.map(tag => (
                      <Tag key={tag} color={tagColors[tag]}>
                        {tagLabels[tag]}
                      </Tag>
                    ))}
                  </Space>
                </div>
              </Col>
            )}
            <Col xs={24}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  创建时间
                </Text>
                <Text>
                  {dayjs(objective.createdAt).format('YYYY-MM-DD HH:mm')}
                  {objective.updatedAt !== objective.createdAt && (
                    <span style={{ marginLeft: 12 }}>
                      (更新于 {dayjs(objective.updatedAt).format('YYYY-MM-DD HH:mm')})
                    </span>
                  )}
                </Text>
              </div>
            </Col>
          </Row>
        </Card>

        <Card
          size="small"
          style={{ marginBottom: 16, borderRadius: 8 }}
          title={
            <Space>
              <Title level={5} style={{ margin: 0 }}>关键结果（KR）</Title>
              <Tag color="blue">{objective.keyResults.length} 个</Tag>
            </Space>
          }
          extra={
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => onAddKR(objective)}
            >
              添加KR
            </Button>
          }
        >
          {objective.keyResults.length === 0 ? (
            <Empty
              description="暂无关键结果"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '24px 0' }}
            />
          ) : (
            <List
              dataSource={[...objective.keyResults].sort((a, b) => a.sortOrder - b.sortOrder)}
              renderItem={(kr, index) => {
                const krProgress = calculateKRProgress(kr)
                const krProgressColor = getProgressColor(krProgress, false)
                const linkedTask = kr.taskId ? tasks.find(t => t.id === kr.taskId) : null
                const isEditing = editingKRId === kr.id

                return (
                  <List.Item
                    key={kr.id}
                    style={{
                      padding: '16px',
                      backgroundColor: '#fafafa',
                      borderRadius: 8,
                      marginBottom: 12,
                      border: krProgress >= 100 ? '1px solid #52c41a' : '1px solid #f0f0f0'
                    }}
                    actions={[
                      <Tooltip key="edit" title="编辑KR">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => onEditKR(objective)}
                        />
                      </Tooltip>,
                      <Tooltip key="delete" title="删除KR">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteKR(kr)}
                        />
                      </Tooltip>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: krTypeColors[kr.type],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 'bold'
                        }}>
                          {index + 1}
                        </div>
                      }
                      title={
                        <Space wrap style={{ width: '100%' }}>
                          <Text strong style={{ fontSize: 15 }}>
                            {kr.title}
                          </Text>
                          <Tag color={krTypeColors[kr.type]}>
                            {krTypeLabels[kr.type]}
                          </Tag>
                          {linkedTask && (
                            <Tag icon={<LinkOutlined />} color="purple">
                              关联任务: {linkedTask.title}
                            </Tag>
                          )}
                          {krProgress >= 100 && (
                            <Tag icon={<CheckCircleOutlined />} color="green">
                              已完成
                            </Tag>
                          )}
                        </Space>
                      }
                      description={
                        <div style={{ marginTop: 8 }}>
                          {kr.description && (
                            <Paragraph style={{ marginBottom: 12, fontSize: 13 }}>
                              {kr.description}
                            </Paragraph>
                          )}

                          {isEditing ? (
                            <div style={{ marginBottom: 12 }}>
                              <Space align="center">
                                <Text type="secondary">当前进度:</Text>
                                <InputNumber
                                  min={0}
                                  max={kr.targetValue}
                                  value={editingKRValue}
                                  onChange={setEditingKRValue}
                                  style={{ width: 120 }}
                                />
                                <Text strong>
                                  {kr.unit} ({Math.round(((editingKRValue || 0) / kr.targetValue) * 100)}%)
                                </Text>
                                <Button
                                  type="primary"
                                  size="small"
                                  onClick={() => handleSaveKRProgress(kr)}
                                >
                                  保存
                                </Button>
                                <Button
                                  size="small"
                                  onClick={() => setEditingKRId(null)}
                                >
                                  取消
                                </Button>
                              </Space>
                            </div>
                          ) : (
                            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                              <Text type="secondary" style={{ fontSize: 13 }}>
                                当前: {kr.currentValue}{kr.unit} / 目标: {kr.targetValue}{kr.unit}
                              </Text>
                              {kr.type === 'numeric' && (
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<ArrowUpOutlined />}
                                  onClick={() => handleStartEditKR(kr)}
                                >
                                  更新进度
                                </Button>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <Progress
                                percent={Math.round(krProgress)}
                                strokeColor={krProgressColor}
                                size="small"
                              />
                            </div>
                            <Text
                              strong
                              style={{
                                color: krProgressColor,
                                fontSize: 16,
                                minWidth: 56,
                                textAlign: 'right'
                              }}
                            >
                              {Math.round(krProgress)}%
                            </Text>
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )
              }}
            />
          )}
        </Card>

        {linkedTasks.length > 0 && (
          <Card
            size="small"
            style={{ marginBottom: 16, borderRadius: 8 }}
            title={
              <Space>
                <Title level={5} style={{ margin: 0 }}>关联任务</Title>
                <Tag color="purple">{linkedTasks.length} 个</Tag>
              </Space>
            }
          >
            <List
              size="small"
              dataSource={linkedTasks}
              renderItem={(task) => (
                <List.Item
                  key={task.id}
                  style={{ padding: '8px 12px' }}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text>{task.title}</Text>
                        {!task.enabled && (
                          <Tag color="green" icon={<CheckCircleOutlined />}>
                            已完成
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        {dayjs(task.targetTime).format('YYYY-MM-DD HH:mm')}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}

        <Card size="small" style={{ borderRadius: 8 }}>
          <Title level={5} style={{ marginBottom: 12 }}>通知记录</Title>
          {objective.notifiedMilestones.length === 0 ? (
            <Text type="secondary">暂无里程碑通知</Text>
          ) : (
            <Space wrap>
              {MILESTONES
                .filter(m => objective.notifiedMilestones.includes(m))
                .sort((a, b) => a - b)
                .map(milestone => (
                  <Tag key={milestone} color="green" icon={<CheckCircleOutlined />}>
                    {milestone}% 里程碑
                  </Tag>
                ))
              }
            </Space>
          )}
        </Card>
      </div>
    </Drawer>
  )
}
