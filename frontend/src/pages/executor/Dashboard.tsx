import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../hooks/useApi'

interface Task {
  id: number
  title: string
  flow_name: string
  status: string
  current_step: string | null
  has_human_step: boolean
  due_date: string | null
  created_at: string
}

interface MyTasks {
  pending: Task[]
  running: Task[]
  pending_count: number
  running_count: number
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: '待处理', cls: 'bg-yellow-100 text-yellow-800' },
  running: { label: '进行中', cls: 'bg-blue-100 text-blue-800' },
  completed: { label: '已完成', cls: 'bg-green-100 text-green-800' },
  failed: { label: '失败', cls: 'bg-red-100 text-red-800' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  )
}

function formatDue(due: string | null) {
  if (!due) return null
  const d = new Date(due)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  if (diff < 0) return <span className="text-red-500 text-xs">已逾期</span>
  const h = Math.floor(diff / 3600000)
  if (h < 24) return <span className="text-orange-500 text-xs">{h}h后截止</span>
  const day = Math.floor(h / 24)
  return <span className="text-gray-400 text-xs">{day}天后截止</span>
}

const SHORTCUTS = [
  { label: '任务列表', icon: '📋', href: '/executor/tasks' },
  { label: '任务历史', icon: '🗂', href: '/executor/history' },
  { label: '知识库', icon: '📚', href: '/executor/knowledge' },
  { label: '工具列表', icon: '🔧', href: '/executor/tools' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<MyTasks | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/tasks/my')
      .then((r) => setData(r.data))
      .catch(() => setError('加载失败，请刷新重试'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">我的看板</h1>

      {/* 快捷入口 */}
      <section className="mb-8" data-testid="shortcuts">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          快捷入口
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {SHORTCUTS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              data-testid={`shortcut-${s.href.split('/').pop()}`}
              className="flex flex-col items-center gap-2 bg-white rounded-xl border border-gray-200 py-4 hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <span className="text-2xl">{s.icon}</span>
              <span className="text-sm text-gray-700">{s.label}</span>
            </a>
          ))}
        </div>
      </section>

      {loading && (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      )}
      {error && (
        <div className="text-center py-12 text-red-500">{error}</div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 待办区域 */}
          <section data-testid="pending-section">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                待办
                <span
                  className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-white text-xs font-bold"
                  data-testid="pending-count"
                >
                  {data.pending_count}
                </span>
              </h2>
              <a href="/executor/tasks" className="text-xs text-blue-600 hover:underline">查看全部</a>
            </div>
            <div className="space-y-2">
              {data.pending.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-xl border border-dashed border-gray-200">
                  暂无待办任务 🎉
                </div>
              )}
              {data.pending.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
                  onClick={() => t.has_human_step
                    ? navigate(`/task/${t.id}/step/current`)
                    : navigate(`/executor/tasks/${t.id}`)
                  }
                  data-testid={`pending-task-${t.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 leading-snug">{t.title}</p>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    <span>{t.flow_name}</span>
                    {t.due_date && <>{formatDue(t.due_date)}</>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 进行中区域 */}
          <section data-testid="running-section">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                进行中
                <span
                  className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold"
                  data-testid="running-count"
                >
                  {data.running_count}
                </span>
              </h2>
            </div>
            <div className="space-y-2">
              {data.running.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-xl border border-dashed border-gray-200">
                  暂无进行中任务
                </div>
              )}
              {data.running.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
                  onClick={() => navigate(`/executor/tasks/${t.id}`)}
                  data-testid={`running-task-${t.id}`}
                >
                  <p className="text-sm font-medium text-gray-800">{t.title}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    <span>{t.flow_name}</span>
                    {t.current_step && (
                      <span className="text-blue-500">▶ {t.current_step}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
