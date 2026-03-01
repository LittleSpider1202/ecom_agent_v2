import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../hooks/useApi'

interface AISuggestion {
  id: number
  title: string
  summary: string
  category: string
  status: string
}

interface ActiveTask {
  id: number
  title: string
  status: string
  current_step: string | null
  flow_name: string
}

interface DashboardData {
  health_score: number
  ai_suggestions: AISuggestion[]
  active_tasks: {
    total: number
    running: number
    pending: number
    items: ActiveTask[]
  }
}

function HealthGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  const label = score >= 80 ? '健康' : score >= 60 ? '注意' : '警告'

  return (
    <div className="flex flex-col items-center" data-testid="health-gauge">
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r="54" fill="none" stroke="#e5e7eb" strokeWidth="12" />
          <circle
            cx="70" cy="70" r="54" fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-bold"
            style={{ color }}
            data-testid="health-score-value"
          >
            {score}
          </span>
          <span className="text-xs text-gray-500">分</span>
        </div>
      </div>
      <span
        className="mt-2 text-sm font-medium px-3 py-1 rounded-full"
        style={{ backgroundColor: color + '20', color }}
      >
        {label}
      </span>
    </div>
  )
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: '待处理', cls: 'bg-yellow-100 text-yellow-700' },
  running: { label: '进行中', cls: 'bg-blue-100 text-blue-700' },
}

const CATEGORY_COLOR: Record<string, string> = {
  库存管理: 'bg-indigo-100 text-indigo-700',
  定价策略: 'bg-orange-100 text-orange-700',
  供应商管理: 'bg-purple-100 text-purple-700',
}

export default function DecisionCockpit() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get('/api/dashboard')
      .then(res => setData(res.data))
      .catch(() => setError('加载失败，请刷新重试'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        加载中...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? '数据异常'}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 标题 */}
      <h1 className="text-2xl font-bold text-gray-800 mb-6" data-testid="page-title">
        决策驾驶舱
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 全局健康度 */}
        <div
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center"
          data-testid="health-score-section"
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            全局健康度
          </h2>
          <HealthGauge score={data.health_score} />
          <p className="mt-4 text-xs text-gray-400 text-center">
            综合任务完成率与异常率计算
          </p>
        </div>

        {/* AI 建议列表 */}
        <div
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2"
          data-testid="ai-suggestions-section"
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            AI 建议
          </h2>
          {data.ai_suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400" data-testid="suggestions-empty">
              <span className="text-2xl mb-2">💡</span>
              <span className="text-sm">暂无 AI 建议</span>
            </div>
          ) : (
            <ul className="space-y-3" data-testid="suggestion-list">
              {data.ai_suggestions.map(s => (
                <li
                  key={s.id}
                  data-testid={`suggestion-item-${s.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-gray-100"
                  onClick={() => navigate(`/manage/suggestions/${s.id}`)}
                >
                  <span
                    className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                      CATEGORY_COLOR[s.category] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {s.category}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{s.summary}</p>
                  </div>
                  <span className="shrink-0 text-gray-300 text-sm">›</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 进行中任务摘要 */}
        <div
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-3"
          data-testid="active-tasks-section"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              进行中任务摘要
            </h2>
            <button
              className="text-xs text-blue-500 hover:underline"
              onClick={() => navigate('/manage/monitor')}
            >
              查看全部
            </button>
          </div>

          {/* 统计卡片 */}
          <div className="flex gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-center">
              <div className="text-2xl font-bold text-gray-800" data-testid="active-tasks-count">
                {data.active_tasks.total}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">总计</div>
            </div>
            <div className="bg-blue-50 rounded-lg px-4 py-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{data.active_tasks.running}</div>
              <div className="text-xs text-blue-400 mt-0.5">进行中</div>
            </div>
            <div className="bg-yellow-50 rounded-lg px-4 py-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{data.active_tasks.pending}</div>
              <div className="text-xs text-yellow-400 mt-0.5">待处理</div>
            </div>
          </div>

          {/* 任务列表 */}
          {data.active_tasks.items.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-6" data-testid="tasks-empty">
              当前无进行中任务
            </div>
          ) : (
            <ul className="divide-y divide-gray-100" data-testid="active-task-list">
              {data.active_tasks.items.map(t => {
                const s = STATUS_LABEL[t.status] ?? { label: t.status, cls: 'bg-gray-100 text-gray-600' }
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>
                      {s.label}
                    </span>
                    <span className="flex-1 text-sm text-gray-700 truncate">{t.title}</span>
                    <span className="shrink-0 text-xs text-gray-400">{t.flow_name}</span>
                    {t.current_step && (
                      <span className="shrink-0 text-xs text-gray-300">{t.current_step}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
