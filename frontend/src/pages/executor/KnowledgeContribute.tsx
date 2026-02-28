import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const CATEGORIES = ['仓库操作', '客服规范', '采购流程', '运营规则', '产品信息', '平台规则']

interface Submission {
  id: number
  type: string
  title: string | null
  category: string | null
  status: string
  entry_id: number | null
  created_at: string | null
}

export default function KnowledgeContribute() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const initType = searchParams.get('type') || 'new'
  const initTitle = searchParams.get('title') || ''
  const initEntryId = searchParams.get('entry_id') || ''

  const [type, setType] = useState<'new' | 'correction'>(initType === 'correction' ? 'correction' : 'new')
  const [title, setTitle] = useState(initTitle)
  const [category, setCategory] = useState(CATEGORIES[0])
  const [content, setContent] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loadingSubs, setLoadingSubs] = useState(true)

  useEffect(() => {
    loadSubmissions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSubmissions = async () => {
    setLoadingSubs(true)
    try {
      const res = await fetch('/api/knowledge/my-submissions', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setSubmissions(await res.json())
    } finally {
      setLoadingSubs(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        type,
        content,
        category,
        title: type === 'new' ? title : initTitle,
      }
      if (type === 'correction') {
        body.entry_id = initEntryId ? Number(initEntryId) : null
        body.correction_reason = correctionReason
      }
      const res = await fetch('/api/knowledge/submissions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setSuccess(true)
        setTitle('')
        setContent('')
        setCorrectionReason('')
        loadSubmissions()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const statusLabel = (s: string) => {
    if (s === 'pending') return { text: '待审核', cls: 'bg-yellow-100 text-yellow-700' }
    if (s === 'approved') return { text: '已通过', cls: 'bg-green-100 text-green-700' }
    return { text: '未通过', cls: 'bg-red-100 text-red-700' }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <button onClick={() => navigate('/executor/knowledge')} className="hover:text-blue-600 transition-colors">
          知识库
        </button>
        <span>/</span>
        <span className="text-gray-600">知识贡献</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-6">知识贡献</h1>

      {/* Success Message */}
      {success && (
        <div data-testid="success-message" className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-700 font-medium">提交成功！等待管理员审核后生效。</p>
          <p className="text-green-600 text-sm mt-1">您可以在下方"我的提交"中查看审核状态。</p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-2 text-sm text-green-600 underline hover:text-green-800"
          >
            继续提交
          </button>
        </div>
      )}

      {/* Form */}
      {!success && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          {/* Type Switch */}
          <div className="flex gap-3 mb-5">
            <button
              type="button"
              onClick={() => setType('new')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                type === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              提交新知识
            </button>
            <button
              type="button"
              onClick={() => setType('correction')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                type === 'correction' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              提交修正意见
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                词条标题{type === 'new' ? '' : '（被修正词条）'}
              </label>
              <input
                data-testid="title-input"
                type="text"
                value={type === 'correction' ? initTitle : title}
                onChange={e => type === 'new' && setTitle(e.target.value)}
                readOnly={type === 'correction'}
                required={type === 'new'}
                placeholder="请输入词条标题"
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  type === 'correction' ? 'bg-gray-50 text-gray-500' : ''
                }`}
              />
            </div>

            {/* Category */}
            {type === 'new' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <select
                  data-testid="category-select"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {type === 'new' ? '词条内容' : '修正后内容（支持 Markdown）'}
              </label>
              <textarea
                data-testid="content-input"
                value={content}
                onChange={e => setContent(e.target.value)}
                required
                rows={8}
                placeholder={type === 'new' ? '请输入词条内容，支持 Markdown 格式...' : '请输入修正后的完整内容...'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono text-sm"
              />
            </div>

            {/* Correction Reason */}
            {type === 'correction' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">修正原因</label>
                <textarea
                  data-testid="correction-reason-input"
                  value={correctionReason}
                  onChange={e => setCorrectionReason(e.target.value)}
                  rows={3}
                  placeholder="请说明为什么需要修正..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}

            <button
              data-testid="submit-btn"
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {submitting ? '提交中...' : '提交'}
            </button>
          </form>
        </div>
      )}

      {/* My Submissions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">我的提交</h2>
        {loadingSubs ? (
          <div className="text-center py-6 text-gray-400">加载中...</div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-6 text-gray-400">暂无提交记录</div>
        ) : (
          <div data-testid="submissions-list" className="space-y-2">
            {submissions.map(sub => {
              const { text, cls } = statusLabel(sub.status)
              return (
                <div key={sub.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-800 text-sm">
                      {sub.type === 'new' ? '新词条：' : '修正：'}{sub.title || '未命名'}
                    </span>
                    {sub.category && (
                      <span className="ml-2 text-xs text-gray-400">{sub.category}</span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{text}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
