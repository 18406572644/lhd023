import React, { useState } from 'react'
import { Card, Row, Col, Progress, Tag, Space, Typography, Button, Tooltip, Empty, Dropdown, Menu, Input, Modal, message, InputNumber } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, MoreOutlined, ClockCircleOutlined, ExclamationCircleOutlined, FilterOutlined, SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Objective, Task, OKRStatus, OKRPriority, TaskTag } from '../types'
import { okrStatusColors, okrStatusLabels, okrPriorityColors, okrPriorityLabels, tagColors, tagLabels, getProgressColor, krTypeColors, krTypeLabels } from '../utils/constants'
import { calculateObjectiveProgress, calculateKRProgress, sortObjectives, filterObjectives } from '../utils/okrManager'

const { Title, Text, Paragraph } = Typography
const { Search } = Input
const { confirm } = Modal

interface OKRBoardProps {
  objectives: Objective[]
  tasks: Task[]
  onAddObjective: () => void
  onEditObjective: (objective: Objective) => void
  onViewDetail: (objective: Objective) => void
  onDeleteObjective: (id: string) => void
  onUpdateProgress: (objectiveId: string, krId: string, currentValue: number) => void
}

export const OKRBoard: React.FC<OKRBoardProps> = ({
  objectives,
  tasks: _tasks,
  onAddObjective,
  onEditObjective,
  onViewDetail,
  onDeleteObjective,
  onUpdateProgress
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'progress'>('date')
  const [sortAscending, setSortAscending] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [krProgressModal, setKrProgressModal] = useState<{ objective: Objective; krId: string } | null>(null)
  const [krProgressValue, setKrProgressValue] = useState<number | null>(0)

  const filteredObjectives = filterObjectives(objectives, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
    tag: tagFilter === 'all' ? undefined : tagFilter,
    overdueOnly
  }).filter(obj => 
    searchText === '' || 
    obj.title.toLowerCase().includes(searchText.toLowerCase()) ||
    obj.description.toLowerCase().includes(searchText.toLowerCase())
  )

  const sortedObjectives = sortObjectives(filteredObjectives, sortBy, sortAscending)

  const handleDeleteObjective = (objective: Objective) => {
    confirm({
      title: '确认删除目标',
      content: `确定要删除目标「${objective.title}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        onDeleteObjective(objective.id)
        message.success('目标已删除')
      }
    })
  }

  const handleOpenKRProgress = (objective: Objective, krId: string) => {
    const kr = objective.keyResults.find(k => k.id === krId)
    if (kr) {
      setKrProgressValue(kr.currentValue)
      setKrProgressModal({ objective, krId })
    }
  }

  const handleSaveKRProgress = () => {
    if (krProgressModal && krProgressValue !== null) {
      onUpdateProgress(krProgressModal.objective.id, krProgressModal.krId, krProgressValue)
      setKrProgressModal(null)
      message.success('进度已更新')
    }
  }

  const getStatusMenu = () => (
    <Menu onClick={(e) => setStatusFilter(e.key)}>
      <Menu.Item key="all">全部状态</Menu.Item>
      {(Object.keys(okrStatusLabels) as OKRStatus[]).map(status => (
        <Menu.Item key={status}>
          <Tag color={okrStatusColors[status]} style={{ margin: 0 }}>
            {okrStatusLabels[status]}
          </Tag>
        </Menu.Item>
      ))}
    </Menu>
  )

  const getPriorityMenu = () => (
    <Menu onClick={(e) => setPriorityFilter(e.key)}>
      <Menu.Item key="all">全部优先级</Menu.Item>
      {(Object.keys(okrPriorityLabels) as OKRPriority[]).map(priority => (
        <Menu.Item key={priority}>
          <Space>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: okrPriorityColors[priority]
            }} />
            {okrPriorityLabels[priority]}优先级
          </Space>
        </Menu.Item>
      ))}
    </Menu>
  )

  const getTagMenu = () => (
    <Menu onClick={(e) => setTagFilter(e.key)}>
      <Menu.Item key="all">全部标签</Menu.Item>
      {(Object.keys(tagLabels) as TaskTag[]).map(tag => (
        <Menu.Item key={tag}>
          <Tag color={tagColors[tag]} style={{ margin: 0 }}>
            {tagLabels[tag]}
          </Tag>
        </Menu.Item>
      ))}
    </Menu>
  )

  const getSortMenu = () => (
    <Menu onClick={(e) => {
      if (e.key === 'asc' || e.key === 'desc') {
        setSortAscending(e.key === 'asc')
      } else {
        setSortBy(e.key as any)
      }
    }}>
      <Menu.SubMenu title="排序方式">
        <Menu.Item key="date">按截止日期</Menu.Item>
        <Menu.Item key="priority">按优先级</Menu.Item>
        <Menu.Item key="progress">按进度</Menu.Item>
      </Menu.SubMenu>
      <Menu.SubMenu title="排序方向">
        <Menu.Item key="desc">
          <Space>
            <SortDescendingOutlined />
            降序
          </Space>
        </Menu.Item>
        <Menu.Item key="asc">
          <Space>
            <SortAscendingOutlined />
            升序
          </Space>
        </Menu.Item>
      </Menu.SubMenu>
    </Menu>
  )

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Card size="small" style={{ borderRadius: 8 }}>
          <Space wrap size="middle" style={{ width: '100%' }}>
            <Search
              placeholder="搜索目标..."
              allowClear
              style={{ width: 250 }}
              onChange={(e) => setSearchText(e.target.value)}
            />
            
            <Dropdown overlay={getStatusMenu} trigger={['click']}>
              <Button icon={<FilterOutlined />}>
                状态: {statusFilter === 'all' ? '全部' : okrStatusLabels[statusFilter as OKRStatus]}
              </Button>
            </Dropdown>

            <Dropdown overlay={getPriorityMenu} trigger={['click']}>
              <Button>
                优先级: {priorityFilter === 'all' ? '全部' : okrPriorityLabels[priorityFilter as OKRPriority]}
              </Button>
            </Dropdown>

            <Dropdown overlay={getTagMenu} trigger={['click']}>
              <Button>
                标签: {tagFilter === 'all' ? '全部' : tagLabels[tagFilter as TaskTag]}
              </Button>
            </Dropdown>

            <Button
              type={overdueOnly ? 'primary' : 'default'}
              onClick={() => setOverdueOnly(!overdueOnly)}
              icon={<ExclamationCircleOutlined />}
            >
              {overdueOnly ? '显示全部' : '仅看逾期'}
            </Button>

            <Dropdown overlay={getSortMenu} trigger={['click']}>
              <Button>
                排序: {sortBy === 'date' ? '日期' : sortBy === 'priority' ? '优先级' : '进度'}
                {sortAscending ? ' ↑' : ' ↓'}
              </Button>
            </Dropdown>

            <Space style={{ marginLeft: 'auto' }}>
              <Text type="secondary">
                共 {sortedObjectives.length} 个目标
              </Text>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={onAddObjective}
              >
                新建目标
              </Button>
            </Space>
          </Space>
        </Card>
      </div>

      {sortedObjectives.length === 0 ? (
        <Empty
          description={
            <div>
              <Title level={5}>暂无目标</Title>
              <Paragraph type="secondary">
                {searchText || statusFilter !== 'all' || priorityFilter !== 'all' || tagFilter !== 'all' || overdueOnly
                  ? '没有找到符合条件的目标，尝试调整筛选条件'
                  : '点击上方按钮创建你的第一个目标吧！'}
              </Paragraph>
            </div>
          }
          style={{ padding: '60px 0' }}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {sortedObjectives.map(objective => {
            const progress = calculateObjectiveProgress(objective)
            const progressColor = getProgressColor(progress.progress, progress.overdue)
            
            return (
              <Col xs={24} sm={12} lg={8} xl={6} key={objective.id}>
                <Card
                  hoverable
                  onClick={() => onViewDetail(objective)}
                  style={{
                    borderRadius: 12,
                    border: progress.overdue ? '2px solid #f5222d' : '1px solid #f0f0f0',
                    boxShadow: progress.overdue ? '0 2px 8px rgba(245, 34, 45, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.06)',
                    transition: 'all 0.3s ease',
                    overflow: 'hidden'
                  }}
                  bodyStyle={{ padding: '16px 20px' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = progress.overdue 
                      ? '0 4px 12px rgba(245, 34, 45, 0.2)' 
                      : '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = progress.overdue 
                      ? '0 2px 8px rgba(245, 34, 45, 0.15)' 
                      : '0 2px 8px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <div style={{ 
                    height: 4, 
                    backgroundColor: okrPriorityColors[objective.priority],
                    margin: '-16px -20px 12px -20px'
                  }} />

                  <div style={{ marginBottom: 12 }}>
                    <Space wrap size={[8, 8]} style={{ marginBottom: 8 }}>
                      <Tag color={okrStatusColors[objective.status]} style={{ margin: 0 }}>
                        {okrStatusLabels[objective.status]}
                      </Tag>
                      {progress.overdue && (
                        <Tag color="red" icon={<ExclamationCircleOutlined />} style={{ margin: 0 }}>
                          已逾期
                        </Tag>
                      )}
                      {objective.tags.map(tag => (
                        <Tag key={tag} color={tagColors[tag]} style={{ margin: 0 }}>
                          {tagLabels[tag]}
                        </Tag>
                      ))}
                    </Space>
                  </div>

                  <Title level={5} style={{ 
                    marginBottom: 8, 
                    fontSize: 16,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    minHeight: 44
                  }}>
                    {objective.title}
                  </Title>

                  {objective.description && (
                    <Paragraph 
                      type="secondary" 
                      style={{ 
                        fontSize: 13, 
                        marginBottom: 16,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        minHeight: 38
                      }}
                    >
                      {objective.description}
                    </Paragraph>
                  )}

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong style={{ color: progressColor, fontSize: 14 }}>
                        {progress.progress}%
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {progress.completedKRs}/{progress.totalKRs} KR完成
                      </Text>
                    </div>
                    <Progress 
                      percent={progress.progress} 
                      showInfo={false}
                      strokeColor={progressColor}
                      size="small"
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {dayjs(objective.startDate).format('MM/DD')} - {dayjs(objective.endDate).format('MM/DD')}
                      {' · '}
                      {progress.daysRemaining > 0 
                        ? `剩余 ${progress.daysRemaining} 天`
                        : progress.daysRemaining === 0
                          ? '今天截止'
                          : `已逾期 ${Math.abs(progress.daysRemaining)} 天`
                      }
                    </Text>
                  </div>

                  {objective.keyResults.length > 0 && (
                    <div style={{ 
                      paddingTop: 12, 
                      borderTop: '1px dashed #f0f0f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}>
                      {objective.keyResults.slice(0, 3).map(kr => {
                        const krProgress = calculateKRProgress(kr)
                        return (
                          <div 
                            key={kr.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (kr.type === 'numeric') {
                                handleOpenKRProgress(objective, kr.id)
                              }
                            }}
                            style={{ cursor: kr.type === 'numeric' ? 'pointer' : 'default' }}
                          >
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              marginBottom: 2
                            }}>
                              <Text 
                                style={{ 
                                  fontSize: 12,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 1,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  flex: 1,
                                  marginRight: 8
                                }}
                              >
                                {kr.title}
                              </Text>
                              <Space size={4}>
                                <Tag color={krTypeColors[kr.type]} style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                                  {krTypeLabels[kr.type]}
                                </Tag>
                                <Text 
                                  strong 
                                  style={{ 
                                    fontSize: 12, 
                                    color: getProgressColor(krProgress, false),
                                    minWidth: 36,
                                    textAlign: 'right'
                                  }}
                                >
                                  {Math.round(krProgress)}%
                                </Text>
                              </Space>
                            </div>
                            <Progress 
                              percent={Math.round(krProgress)} 
                              showInfo={false}
                              strokeColor={getProgressColor(krProgress, false)}
                              size="small"
                            />
                          </div>
                        )
                      })}
                      {objective.keyResults.length > 3 && (
                        <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
                          还有 {objective.keyResults.length - 3} 个 KR...
                        </Text>
                      )}
                    </div>
                  )}

                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{ 
                      marginTop: 12, 
                      paddingTop: 12, 
                      borderTop: '1px solid #f0f0f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: okrPriorityColors[objective.priority],
                        display: 'inline-block',
                        marginRight: 4
                      }} />
                      {okrPriorityLabels[objective.priority]}优先级
                    </Text>
                    <Space size={4}>
                      <Tooltip title="编辑">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditObjective(objective)
                          }}
                        />
                      </Tooltip>
                      <Tooltip title="更多">
                        <Dropdown
                          trigger={['click']}
                          menu={{
                            items: [
                              {
                                key: 'edit',
                                icon: <EditOutlined />,
                                label: '编辑',
                                onClick: () => onEditObjective(objective)
                              },
                              {
                                type: 'divider'
                              },
                              {
                                key: 'delete',
                                icon: <DeleteOutlined />,
                                label: '删除',
                                danger: true,
                                onClick: () => handleDeleteObjective(objective)
                              }
                            ]
                          }}
                        >
                          <Button type="text" size="small" icon={<MoreOutlined />} />
                        </Dropdown>
                      </Tooltip>
                    </Space>
                  </div>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}

      <Modal
        title="更新KR进度"
        open={!!krProgressModal}
        onCancel={() => setKrProgressModal(null)}
        onOk={handleSaveKRProgress}
        okText="保存"
        cancelText="取消"
      >
        {krProgressModal && (() => {
          const kr = krProgressModal.objective.keyResults.find(k => k.id === krProgressModal.krId)
          if (!kr) return null
          
          return (
            <div style={{ marginTop: 16 }}>
              <Title level={5} style={{ marginBottom: 8 }}>{kr.title}</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                目标值: {kr.targetValue}{kr.unit} / 单位: {kr.unit}
              </Text>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <InputNumber
                  min={0}
                  max={kr.targetValue}
                  value={krProgressValue}
                  onChange={setKrProgressValue}
                  style={{ flex: 1 }}
                />
                <Text strong>
                  {kr.unit} ({Math.round(((krProgressValue || 0) / kr.targetValue) * 100)}%)
                </Text>
              </div>

              <Progress 
                percent={Math.round(((krProgressValue || 0) / kr.targetValue) * 100)} 
                strokeColor={getProgressColor(((krProgressValue || 0) / kr.targetValue) * 100, false)}
              />
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
