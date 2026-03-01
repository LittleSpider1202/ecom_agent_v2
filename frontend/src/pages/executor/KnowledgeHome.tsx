import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const CATEGORIES = ['仓库操作', '客服规范', '采购流程', '运营规则', '产品信息', '平台规则']

interface KnowledgeItem {
  id: number
  title: string
  category: string
  version: string
  view_count: number
  helpful_count: number
  updated_at: string | null
}

interface AskResult {
  answer: string
  references: { id: number; title: string; category: string }[]
}

export default function KnowledgeHome() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<KnowledgeItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState('')
  const [askedQuestion, setAskedQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askResult, setAskResult] = useState<AskResult | null>(null)

  const fetchEntries = async (category?: string | null, q?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      if (q) params.set('search', q)
      const res = await fetch(`/api/knowledge?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setEntries(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries(null, '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCategoryClick = (cat: string) => {
    const next = selectedCategory === cat ? null : cat
    setSelectedCategory(next)
    setSearch('')
    fetchEntries(next, '')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSelectedCategory(null)
    fetchEntries(null, search)
  }

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return
    setAskedQuestion(question.trim())
    setAsking(true)
    setAskResult(null)
    try {
      const res = await fetch('/api/knowledge/ask', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      })
      setAskResult(await res.json())
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">知识库</h1>

      {/* AI Q&A — chat bubble layout */}
      <div className="bg-white rounded-xl border border-blue-100 overflow-hidden mb-6">
        <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
          <h2 className="text-lg font-semibold text-blue-800">AI 智能问答</h2>
        </div>

        {/* Chat messages area */}
        <div className="px-5 py-4 min-h-[80px]">
          {/* User question bubble — right aligned, blue */}
          {askedQuestion && (
            <div className="flex justify-end mb-3">
              <div
                data-testid="qa-question-bubble"
                className="max-w-xs px-4 py-2 bg-blue-600 text-white rounded-2xl rounded-tr-sm text-sm"
              >
                {askedQuestion}
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {asking && (
            <div className="flex justify-start mb-3">
              <div className="px-4 py-2 bg-gray-100 text-gray-500 rounded-2xl rounded-tl-sm text-sm italic">
                AI 正在思考...
              </div>
            </div>
          )}

          {/* AI answer bubble — left aligned, gray */}
          {askResult && (
            <div className="flex justify-start">
              <div
                data-testid="qa-answer-bubble"
                className="max-w-lg px-4 py-3 bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm text-sm"
              >
                <div data-testid="qa-result">
                  <p className="whitespace-pre-wrap mb-2">{askResult.answer}</p>
                  {askResult.references.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-blue-700 mb-1">引用词条：</p>
                      <div className="flex flex-wrap gap-1">
                        {askResult.references.map(ref => (
                          <button
                            key={ref.id}
                            data-testid={`qa-ref-${ref.id}`}
                            onClick={() => navigate(`/executor/knowledge/${ref.id}`)}
                            className="px-2 py-0.5 text-xs bg-white border border-blue-200 text-blue-600 rounded-full hover:bg-blue-50 transition-colors"
                          >
                            {ref.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input at bottom */}
        <div data-testid="qa-input-bar" className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <form onSubmit={handleAsk} className="flex gap-2">
            <input
              data-testid="qa-input"
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="请输入您的问题，如：退货处理的SOP是什么？"
              className="flex-1 px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-sm"
            />
            <button
              type="submit"
              disabled={asking || !question.trim()}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium text-sm"
            >
              {asking ? '查询中...' : '发送'}
            </button>
          </form>
        </div>
      </div>

      {/* Category Browse */}
      <div data-testid="category-area" className="mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">分类浏览</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              data-testid={`category-btn-${cat}`}
              onClick={() => handleCategoryClick(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          data-testid="search-input"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索知识词条..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          搜索
        </button>
      </form>

      {/* Entry List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">没有找到相关词条</div>
      ) : (
        <div data-testid="knowledge-list" className="space-y-3">
          {entries.map(entry => (
            <div
              key={entry.id}
              data-testid={`entry-${entry.id}`}
              onClick={() => navigate(`/executor/knowledge/${entry.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-800">{entry.title}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                    {entry.category}
                  </span>
                  <span className="text-xs text-gray-400">{entry.version}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>查看 {entry.view_count}</span>
                  <span>有帮助 {entry.helpful_count}</span>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
