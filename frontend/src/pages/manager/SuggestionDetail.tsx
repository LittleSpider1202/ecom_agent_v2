import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../hooks/useApi'

interface Suggestion {
  id: number
  title: string
  summary: string
  content: string
  category: string
  status: string
}

const CATEGORY_COLOR: Record<string, string> = {
  库存管理: 'bg-indigo-100 text-indigo-700',
  定价策略: 'bg-orange-100 text-orange-700',
  供应商管理: 'bg-purple-100 text-purple-700',
}

export default function SuggestionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get(`/api/suggestions/${id}`)
      .then(res => setData(res.data))
      .catch(() => setError('加载失败，请返回重试'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        加载中...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-400">{error ?? '建议不存在'}</p>
        <button
          className="text-blue-500 hover:underline text-sm"
          onClick={() => navigate('/manage/dashboard')}
        >
          返回决策驾驶舱
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto" data-testid="suggestion-detail">
      {/* 面包屑 */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <button
          className="hover:text-blue-500 transition-colors"
          onClick={() => navigate('/manage/dashboard')}
        >
          决策驾驶舱
        </button>
        <span>›</span>
        <span className="text-gray-600">AI 建议详情</span>
      </nav>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* 标题行 */}
        <div className="flex items-start gap-3 mb-4">
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
              CATEGORY_COLOR[data.category] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {data.category}
          </span>
        </div>

        <h1 className="text-xl font-bold text-gray-800 mb-3" data-testid="suggestion-title">
          {data.title}
        </h1>

        <p className="text-sm text-gray-500 mb-6 pb-4 border-b border-gray-100">
          {data.summary}
        </p>

        {/* 完整内容（Markdown 简单渲染：换行和标题） */}
        <div
          className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed"
          data-testid="suggestion-content"
        >
          {data.content}
        </div>
      </div>
    </div>
  )
}
