import { useEffect, useState } from 'react'
import api from '../../hooks/useApi'

interface Submission {
  id: number
  type: string
  title: string | null
  content: string
  category: string | null
  status: string
  submitter_id: number | null
  entry_id: number | null
  correction_reason: string | null
  created_at: string | null
}

export default function KnowledgeReview() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.get('/api/knowledge/submissions/pending')
      .then(r => setSubmissions(r.data))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleApprove = async (sub: Submission) => {
    setProcessing(sub.id)
    try {
      await api.post(`/api/knowledge/submissions/${sub.id}/approve`, {})
      setMessage(`词条「${sub.title || '未命名'}」已批准发布`)
      setSubmissions(prev => prev.filter(s => s.id !== sub.id))
    } catch {
      setMessage('审核失败，请重试')
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (sub: Submission) => {
    setProcessing(sub.id)
    try {
      await api.post(`/api/knowledge/submissions/${sub.id}/reject`, {})
      setMessage('已驳回该投稿')
      setSubmissions(prev => prev.filter(s => s.id !== sub.id))
    } catch {
      setMessage('操作失败，请重试')
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6" data-testid="review-title">知识贡献审核</h1>

      {message && (
        <div
          data-testid="review-message"
          className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center justify-between text-sm"
        >
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="ml-4 text-green-400 hover:text-green-600">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">加载中…</div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-20 text-gray-400" data-testid="no-pending">暂无待审核的投稿</div>
      ) : (
        <div className="space-y-4" data-testid="submission-list">
          {submissions.map(sub => (
            <div
              key={sub.id}
              data-testid={`submission-${sub.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-semibold text-gray-800 text-lg" data-testid={`sub-title-${sub.id}`}>
                    {sub.title || '（无标题）'}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                      {sub.type === 'new' ? '新词条' : '纠错'}
                    </span>
                    {sub.category && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{sub.category}</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {sub.created_at ? new Date(sub.created_at).toLocaleString('zh-CN') : ''}
                    </span>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">待审核</span>
              </div>

              <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto" data-testid={`sub-content-${sub.id}`}>
                {sub.content}
              </div>

              {sub.correction_reason && (
                <div className="text-xs text-orange-600 bg-orange-50 rounded px-3 py-2 mb-3">
                  纠错原因：{sub.correction_reason}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  data-testid={`reject-btn-${sub.id}`}
                  onClick={() => handleReject(sub)}
                  disabled={processing === sub.id}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  驳回
                </button>
                <button
                  data-testid={`approve-btn-${sub.id}`}
                  onClick={() => handleApprove(sub)}
                  disabled={processing === sub.id}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {processing === sub.id ? '处理中…' : '批准'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
