import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

interface Task {
  id: number
  title: string
  flow_name: string
  status: string
  current_step: string | null
  has_human_step: boolean
  assigned_to: number | null
  created_at: string
  updated_at: string | null
  completed_at: string | null
}

interface Member {
  id: number
  username: string
  display_name: string
  role: string
}

const WARN_THRESHOLD_MS = 2 * 60 * 60 * 1000   // 2 小时：橙色预警
const ALERT_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 小时：红色告警

function getWaitInfo(task: Task, now: number): { label: string; cls: string } | null {
  if (task.status !== 'running' || !task.has_human_step) return null
  const ref = task.updated_at ?? task.created_at
  if (!ref) return null
  const elapsed = now - new Date(ref).getTime()
  if (elapsed < 0) return null

  const hours = Math.floor(elapsed / 3600000)
  const mins = Math.floor((elapsed % 3600000) / 60000)
  const label = hours > 0 ? `${hours}小时${mins}分` : `${mins}分钟`

  if (elapsed >= ALERT_THRESHOLD_MS) return { label, cls: 'text-red-600 font-semibold' }
  if (elapsed >= WARN_THRESHOLD_MS)  return { label, cls: 'text-orange-500 font-semibold' }
  return { label, cls: 'text-gray-500' }
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending:   { text: '待处理', cls: 'bg-orange-100 text-orange-700' },
  running:   { text: '进行中', cls: 'bg-blue-100 text-blue-700' },
  completed: { text: '已完成', cls: 'bg-green-100 text-green-700' },
  failed:    { text: '失败',   cls: 'bg-red-100 text-red-700' },
  rejected:  { text: '已驳回', cls: 'bg-gray-100 text-gray-600' },
}

type ViewMode = 'list' | 'gantt'

export default function TaskMonitor() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('list')
  const [flowFilter, setFlowFilter] = useState<string>('')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')
  const [members, setMembers] = useState<Member[]>([])
  const [urgeTaskId, setUrgeTaskId] = useState<number | null>(null)
  const [urgeMsg, setUrgeMsg] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const load = () => {
    const token = localStorage.getItem('auth_token')
    axios
      .get('/api/tasks/monitor', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setTasks(res.data))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    axios
      .get('/api/members', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setMembers(res.data))
      .catch(() => setMembers([]))
  }, [])

  // 每分钟更新 now，刷新等待时间显示
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  // Unique flow names for filter
  const flowNames = Array.from(new Set(tasks.map(t => t.flow_name))).filter(Boolean)

  const filtered = tasks.filter(t => {
    if (flowFilter && t.flow_name !== flowFilter) return false
    if (assigneeFilter && String(t.assigned_to) !== assigneeFilter) return false
    return true
  })

  const handleUrgeConfirm = async () => {
    if (urgeTaskId == null) return
    const token = localStorage.getItem('auth_token')
    try {
      const res = await axios.post(`/api/tasks/${urgeTaskId}/urge`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setUrgeMsg(res.data.message)
    } catch {
      setUrgeMsg('催办失败，请重试')
    } finally {
      setUrgeTaskId(null)
    }
  }

  // Compute Gantt time range
  const starts = tasks.map(t => new Date(t.created_at).getTime()).filter(Boolean)
  const ganttMin = starts.length ? Math.min(...starts) : now - 86400000
  const ganttMax = now
  const ganttSpan = ganttMax - ganttMin || 1

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800" data-testid="monitor-title">全局任务监控</h1>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1" data-testid="view-toggle">
            <button
              onClick={() => setView('list')}
              data-testid="view-list"
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${view === 'list' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              列表
            </button>
            <button
              onClick={() => setView('gantt')}
              data-testid="view-gantt"
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${view === 'gantt' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              甘特图
            </button>
          </div>
          {/* Flow filter */}
          <select
            data-testid="flow-filter"
            value={flowFilter}
            onChange={e => setFlowFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            <option value="">全部流程</option>
            {flowNames.map(fn => (
              <option key={fn} value={fn}>{fn}</option>
            ))}
          </select>
          {/* Assignee filter */}
          <select
            data-testid="assignee-filter"
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            <option value="">全部负责人</option>
            {members.map(m => (
              <option key={m.id} value={String(m.id)} data-testid={`assignee-option-${m.id}`}>{m.display_name}</option>
            ))}
          </select>
          <button
            onClick={load}
            className="px-3 py-1.5 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
          >
            刷新
          </button>
        </div>
      </div>

      {/* Success message */}
      {urgeMsg && (
        <div
          data-testid="urge-success"
          className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center justify-between"
        >
          <span>{urgeMsg}</span>
          <button onClick={() => setUrgeMsg(null)} className="ml-4 text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-20">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-20">暂无任务</div>
      ) : view === 'list' ? (
        /* ── List view ── */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" data-testid="task-monitor-table">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">任务名称</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">所属流程</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">状态</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">负责人</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">当前步骤</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">开始时间</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">人工等待时间</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(task => {
                const s = STATUS_LABEL[task.status] ?? { text: task.status, cls: 'bg-gray-100 text-gray-600' }
                const date = task.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : '-'
                const isStalled = task.status === 'running' && task.has_human_step
                return (
                  <tr
                    key={task.id}
                    onClick={() => navigate(`/manage/tasks/${task.id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    data-testid="monitor-task-row"
                  >
                    <td className="px-4 py-3 text-gray-500 font-mono">#{task.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{task.title}</td>
                    <td className="px-4 py-3 text-gray-500" data-testid={`task-flow-name-${task.id}`}>{task.flow_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
                        {s.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500" data-testid={`task-assignee-${task.id}`}>
                      {members.find(m => m.id === task.assigned_to)?.display_name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{task.current_step ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{date}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const wait = getWaitInfo(task, now)
                        if (!wait) return <span className="text-gray-300 text-xs">—</span>
                        return (
                          <span
                            data-testid={`wait-time-${task.id}`}
                            className={`text-xs flex items-center gap-1 ${wait.cls}`}
                          >
                            {wait.cls.includes('red') && (
                              <span data-testid={`timeout-alert-${task.id}`} title="严重超时">🔴</span>
                            )}
                            {wait.cls.includes('orange') && (
                              <span data-testid={`timeout-warn-${task.id}`} title="等待超时预警">🟠</span>
                            )}
                            {wait.label}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {isStalled && (
                        <button
                          data-testid={`urge-btn-${task.id}`}
                          onClick={e => { e.stopPropagation(); setUrgeTaskId(task.id) }}
                          className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                        >
                          催办
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Gantt view ── */
        <div data-testid="gantt-view" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-4">
          <div className="text-xs text-gray-400 mb-3 flex justify-between">
            <span data-testid="gantt-start">{new Date(ganttMin).toLocaleDateString('zh-CN')}</span>
            <span className="font-medium text-gray-600">时间轴（甘特图视图）</span>
            <span data-testid="gantt-end">{new Date(ganttMax).toLocaleDateString('zh-CN')}</span>
          </div>
          <div className="space-y-2" data-testid="gantt-rows">
            {filtered.map(task => {
              const start = new Date(task.created_at).getTime()
              const end = task.completed_at ? new Date(task.completed_at).getTime() : now
              const left = ((start - ganttMin) / ganttSpan) * 100
              const width = Math.max(((end - start) / ganttSpan) * 100, 1)
              const s = STATUS_LABEL[task.status] ?? { text: task.status, cls: '' }
              return (
                <div key={task.id} className="flex items-center gap-3" data-testid={`gantt-row-${task.id}`}>
                  <div className="w-40 text-xs text-gray-600 truncate flex-shrink-0" data-testid={`gantt-task-label-${task.id}`}>{task.title}</div>
                  <div className="flex-1 relative h-6 bg-gray-100 rounded">
                    <div
                      data-testid={`gantt-task-bar-${task.id}`}
                      className={`absolute h-full rounded text-xs flex items-center px-1 text-white overflow-hidden ${
                        task.status === 'completed' ? 'bg-green-500' :
                        task.status === 'running' ? 'bg-blue-500' :
                        task.status === 'failed' ? 'bg-red-500' : 'bg-orange-400'
                      }`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${task.title} — ${s.text}`}
                    >
                      {width > 10 ? task.flow_name : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Urge confirmation dialog */}
      {urgeTaskId != null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" data-testid="urge-dialog">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">确认催办</h3>
            <p className="text-gray-600 text-sm mb-4">
              确定对任务 <strong>#{urgeTaskId}</strong> 发送催办通知吗？系统将向负责人推送提醒。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                data-testid="urge-cancel"
                onClick={() => setUrgeTaskId(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                data-testid="urge-confirm"
                onClick={handleUrgeConfirm}
                className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                确认催办
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
