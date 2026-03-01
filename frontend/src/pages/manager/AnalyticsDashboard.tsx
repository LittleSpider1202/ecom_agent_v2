import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../hooks/useApi'

interface TrendPoint {
  date: string
  completed: number
  created: number
}

interface TrendData {
  days: number
  data: TrendPoint[]
  total_completed: number
  total_created: number
}

interface Bottleneck {
  step_name: string
  total_executions: number
  avg_duration_sec: number
  avg_duration_label: string
  max_duration_label: string
  pct: number
}

interface BottleneckData {
  days: number
  bottlenecks: Bottleneck[]
  avg_human_step_sec: number
  avg_human_step_label: string
}

const RANGE_OPTIONS = [
  { label: '最近7天', days: 7 },
  { label: '最近30天', days: 30 },
  { label: '最近90天', days: 90 },
]

export default function AnalyticsDashboard() {
  const navigate = useNavigate()
  const [days, setDays] = useState(30)
  const [flowFilter, setFlowFilter] = useState('')
  const [flowNames, setFlowNames] = useState<string[]>([])
  const [trend, setTrend] = useState<TrendData | null>(null)
  const [bottleneck, setBottleneck] = useState<BottleneckData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async (d: number, fn?: string) => {
    setLoading(true)
    try {
      const flowParam = fn ? `&flow_name=${encodeURIComponent(fn)}` : ''
      const [tRes, bRes] = await Promise.all([
        api.get(`/api/analytics/trend?days=${d}${flowParam}`),
        api.get(`/api/analytics/bottlenecks?days=${d}${flowParam}`),
      ])
      setTrend(tRes.data)
      setBottleneck(bRes.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    api.get('/api/analytics/flow-names').then(r => setFlowNames(r.data.flow_names || [])).catch(() => {})
    load(days)
  }, [])

  useEffect(() => { load(days, flowFilter || undefined) }, [days, flowFilter])

  const applyRange = (d: number) => setDays(d)

  // SVG chart helpers
  const renderBarChart = (data: TrendPoint[]) => {
    if (!data.length) return null
    const w = 600
    const h = 160
    const pad = { l: 30, r: 10, t: 10, b: 30 }
    const innerW = w - pad.l - pad.r
    const innerH = h - pad.t - pad.b
    const maxVal = Math.max(...data.map(d => Math.max(d.completed, d.created)), 1)
    const barW = Math.max(2, (innerW / data.length) - 2)

    // Show every Nth label
    const labelEvery = Math.max(1, Math.floor(data.length / 8))

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" data-testid="trend-chart">
        {/* Y axis */}
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={h - pad.b} stroke="#e5e7eb" />
        {/* X axis */}
        <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="#e5e7eb" />
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(frac => {
          const y = pad.t + innerH * (1 - frac)
          return (
            <g key={frac}>
              <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#f3f4f6" strokeDasharray="4" />
              <text x={pad.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
                {Math.round(maxVal * frac)}
              </text>
            </g>
          )
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const x = pad.l + (i / data.length) * innerW
          const completedH = (d.completed / maxVal) * innerH
          const createdH = (d.created / maxVal) * innerH
          return (
            <g key={i}>
              {/* Created bar (light blue behind) */}
              <rect
                x={x}
                y={pad.t + innerH - createdH}
                width={barW}
                height={createdH}
                fill="#bfdbfe"
                rx="1"
              />
              {/* Completed bar (blue, on top, narrower) */}
              <rect
                x={x + barW * 0.2}
                y={pad.t + innerH - completedH}
                width={barW * 0.6}
                height={completedH}
                fill="#3b82f6"
                rx="1"
              />
              {/* X label */}
              {i % labelEvery === 0 && (
                <text
                  x={x + barW / 2}
                  y={h - pad.b + 14}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#9ca3af"
                >
                  {d.date.slice(5)}
                </text>
              )}
            </g>
          )
        })}
        {/* Legend */}
        <rect x={w - 110} y={pad.t} width={10} height={8} fill="#bfdbfe" />
        <text x={w - 96} y={pad.t + 8} fontSize="9" fill="#6b7280">创建</text>
        <rect x={w - 60} y={pad.t} width={10} height={8} fill="#3b82f6" />
        <text x={w - 46} y={pad.t + 8} fontSize="9" fill="#6b7280">完成</text>
      </svg>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800" data-testid="analytics-title">数据分析</h1>
        {/* Date range filter */}
        <div className="flex items-center gap-2" data-testid="date-range-filter">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.days}
              data-testid={`range-btn-${opt.days}`}
              onClick={() => applyRange(opt.days)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                days === opt.days
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {/* Flow type filter */}
      <div className="flex items-center gap-2 mb-6" data-testid="flow-type-filter">
        <span className="text-sm text-gray-500">按流程筛选：</span>
        <select
          data-testid="flow-name-select"
          value={flowFilter}
          onChange={e => setFlowFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white"
        >
          <option value="">全部流程</option>
          {flowNames.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        {flowFilter && (
          <button
            data-testid="clear-flow-filter"
            onClick={() => setFlowFilter('')}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            清除筛选
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">加载中…</div>
      ) : (
        <>
          {/* Summary cards */}
          {trend && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-3xl font-bold text-blue-600" data-testid="total-completed">{trend.total_completed}</div>
                <div className="text-sm text-gray-400 mt-1">已完成任务</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-3xl font-bold text-gray-700" data-testid="total-created">{trend.total_created}</div>
                <div className="text-sm text-gray-400 mt-1">创建任务</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-3xl font-bold text-green-600" data-testid="completion-rate">
                  {trend.total_created > 0
                    ? Math.round((trend.total_completed / trend.total_created) * 100)
                    : 0}%
                </div>
                <div className="text-sm text-gray-400 mt-1">完成率</div>
              </div>
              {bottleneck && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600" data-testid="avg-human-step-time">
                    {bottleneck.avg_human_step_label || '—'}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">平均人工步骤处理</div>
                </div>
              )}
            </div>
          )}

          {/* Trend chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6" data-testid="trend-chart-container">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-700">效率趋势</h2>
              <span className="text-xs text-gray-400">最近 {days} 天</span>
            </div>
            {/* Chart legend */}
            <div className="flex items-center gap-4 mb-2" data-testid="chart-legend">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
                <span className="text-xs text-gray-500">已完成任务</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-gray-300"></div>
                <span className="text-xs text-gray-500">新建任务</span>
              </div>
            </div>
            {trend && renderBarChart(trend.data)}
            {/* Time axis label */}
            <div className="text-xs text-center text-gray-400 mt-2" data-testid="time-axis-label">时间轴（天）</div>
          </div>

          {/* Bottleneck analysis */}
          <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="bottleneck-section">
            <h2 className="text-base font-semibold text-gray-700 mb-4">流程瓶颈识别</h2>
            {bottleneck && bottleneck.bottlenecks.length > 0 ? (
              <div className="space-y-3" data-testid="bottleneck-list">
                {bottleneck.bottlenecks.map((b, i) => (
                  <div key={i} className="flex items-center gap-3" data-testid={`bottleneck-item-${i}`}>
                    <button
                      data-testid={`bottleneck-link-${i}`}
                      onClick={() => navigate('/manage/flows')}
                      className="w-36 text-sm text-blue-600 hover:underline truncate flex-shrink-0 text-left"
                    >
                      {b.step_name}
                    </button>
                    <div className="flex-1 relative h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="absolute top-0 left-0 h-full bg-orange-400 rounded-full transition-all"
                        style={{ width: `${b.pct}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-500 w-20 text-right flex-shrink-0" data-testid={`bottleneck-duration-${i}`}>
                      平均 {b.avg_duration_label}
                    </div>
                    <div className="text-xs text-gray-400 w-14 text-right flex-shrink-0">
                      {b.total_executions}次
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8">暂无瓶颈数据</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
