import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../hooks/useApi'

interface Suggestion {
  id: number
  title: string
  summary: string
  category: string
  status: string
  created_at: string | null
  decided_at: string | null
  decided_by: number | null
}

const CATEGORY_COLOR: Record<string, string> = {
  库存管理: 'bg-indigo-100 text-indigo-700',
  定价策略: 'bg-orange-100 text-orange-700',
  供应商管理: 'bg-purple-100 text-purple-700',
}

const STATUS_LABEL: Record<string, string> = {
  pending:  '待处理',
  accepted: '已采纳',
  ignored:  '已忽略',
}

type TabKey = 'pending' | 'history'

export default function SuggestionList() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('pending')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  const [confirmAcceptId, setConfirmAcceptId] = useState<number | null>(null)
  const [acceptMsg, setAcceptMsg] = useState<string | null>(null)
  const [ignoringId, setIgnoringId] = useState<number | null>(null)

  const load = async (t: TabKey) => {
    setLoading(true)
    try {
      const status = t === 'history' ? 'history' : 'pending'
      const res = await api.get(`/api/suggestions?status=${status}`)
      setSuggestions(res.data)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(tab) }, [tab])

  const handleAcceptConfirm = async () => {
    if (confirmAcceptId == null) return
    setAcceptingId(confirmAcceptId)
    setConfirmAcceptId(null)
    try {
      const res = await api.post(`/api/suggestions/${confirmAcceptId}/accept`)
      setAcceptMsg(res.data.message + `（任务 #${res.data.task_id} 已创建）`)
      // Remove from list
      setSuggestions(prev => prev.filter(s => s.id !== confirmAcceptId))
    } catch {
      setAcceptMsg('操作失败，请重试')
    } finally {
      setAcceptingId(null)
    }
  }

  const handleIgnore = async (id: number) => {
    setIgnoringId(id)
    try {
      await api.post(`/api/suggestions/${id}/ignore`)
      setSuggestions(prev => prev.filter(s => s.id !== id))
    } catch {
      // ignore
    } finally {
      setIgnoringId(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800" data-testid="suggestions-title">AI决策建议</h1>
      </div>

      {/* Success message */}
      {acceptMsg && (
        <div data-testid="accept-success" className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center justify-between">
          <span>{acceptMsg}</span>
          <button onClick={() => setAcceptMsg(null)} className="ml-4 text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([['pending', '活跃建议'], ['history', '决策记录']] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            data-testid={`tab-${key}`}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">加载中…</div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          {tab === 'pending' ? '暂无待处理建议' : '暂无历史记录'}
        </div>
      ) : (
        <div className="space-y-4" data-testid="suggestion-list">
          {suggestions.map(s => (
            <div
              key={s.id}
              data-testid={`suggestion-item-${s.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        CATEGORY_COLOR[s.category] ?? 'bg-gray-100 text-gray-600'
                      }`}
                      data-testid={`suggestion-category-${s.id}`}
                    >
                      {s.category}
                    </span>
                    {s.status !== 'pending' && (
                      <span className="text-xs text-gray-400">
                        {STATUS_LABEL[s.status]}
                      </span>
                    )}
                  </div>
                  <h3
                    className="font-semibold text-gray-800 mb-1 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => navigate(`/manage/suggestions/${s.id}`)}
                    data-testid={`suggestion-title-${s.id}`}
                  >
                    {s.title}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-2" data-testid={`suggestion-summary-${s.id}`}>{s.summary}</p>
                  <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                    <div>生成时间：{s.created_at ? new Date(s.created_at).toLocaleString('zh-CN') : '-'}</div>
                    {s.decided_at && (
                      <div data-testid={`decided-at-${s.id}`}>
                        决策时间：{new Date(s.decided_at).toLocaleString('zh-CN')}
                        　决策类型：
                        <span className={s.status === 'accepted' ? 'text-green-600' : 'text-gray-500'}>
                          {s.status === 'accepted' ? '已采纳' : '已忽略'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions — only for pending */}
                {tab === 'pending' && s.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      data-testid={`accept-btn-${s.id}`}
                      onClick={() => setConfirmAcceptId(s.id)}
                      disabled={acceptingId === s.id}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {acceptingId === s.id ? '处理中…' : '采纳'}
                    </button>
                    <button
                      data-testid={`ignore-btn-${s.id}`}
                      onClick={() => handleIgnore(s.id)}
                      disabled={ignoringId === s.id}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      {ignoringId === s.id ? '处理中…' : '忽略'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accept confirmation dialog */}
      {confirmAcceptId != null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" data-testid="accept-dialog">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">确认采纳</h3>
            <p className="text-sm text-gray-600 mb-4">
              采纳后将自动触发对应流程，请确认此操作。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                data-testid="accept-cancel"
                onClick={() => setConfirmAcceptId(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                data-testid="accept-confirm"
                onClick={handleAcceptConfirm}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                确认采纳
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
