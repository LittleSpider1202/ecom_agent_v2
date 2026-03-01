import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface KnowledgeEntryDetail {
  id: number
  title: string
  content: string
  category: string
  version: string
  view_count: number
  helpful_count: number
  status: string
  updated_at: string | null
}

function renderMarkdown(text: string): string {
  // Protect code blocks first
  const codeBlocks: string[] = []
  let processed = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    const idx = codeBlocks.length
    codeBlocks.push(`<pre class="bg-gray-100 rounded-lg px-4 py-3 overflow-x-auto my-3 font-mono text-sm text-gray-800 whitespace-pre-wrap">${code.trim()}</pre>`)
    return `@@CODE_BLOCK_${idx}@@`
  })
  return processed
    .replace(/`([^`\n]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-sm text-gray-800">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-700 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-800 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-800 mt-2 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700">$1</li>')
    .replace(/^(\|.+\|)$/gm, (line) => {
      if (line.includes('---')) return ''
      const cells = line.split('|').filter(c => c.trim())
      const isHeader = false
      const tag = isHeader ? 'th' : 'td'
      return `<tr>${cells.map(c => `<${tag} class="border border-gray-300 px-3 py-1 text-sm">${c.trim()}</${tag}>`).join('')}</tr>`
    })
    .replace(/\n\n/g, '</p><p class="text-gray-700 mb-3">')
    .replace(/\n/g, '<br/>')
    .replace(/@@CODE_BLOCK_(\d+)@@/g, (_, idx) => codeBlocks[parseInt(idx)] || '')
}

export default function KnowledgeDetail() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<KnowledgeEntryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [helpful, setHelpful] = useState(false)
  const [helpfulCount, setHelpfulCount] = useState(0)

  useEffect(() => {
    if (!id) return
    const t = token || localStorage.getItem('auth_token')
    if (!t) return
    const load = async () => {
      try {
        const res = await fetch(`/api/knowledge/${id}`, {
          headers: { Authorization: `Bearer ${t}` },
        })
        if (!res.ok) {
          setLoading(false)
          return
        }
        const data = await res.json()
        setEntry(data)
        setHelpfulCount(data.helpful_count)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, token]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleHelpful = async () => {
    if (helpful || !entry) return
    const t = token || localStorage.getItem('auth_token')
    try {
      const res = await fetch(`/api/knowledge/${entry.id}/helpful`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      })
      const data = await res.json()
      setHelpfulCount(data.helpful_count)
      setHelpful(true)
    } catch {
      // ignore
    }
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '-'
    return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-400">加载中...</div>
  }
  if (!entry) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p>词条不存在或加载失败</p>
        <button onClick={() => navigate('/executor/knowledge')} className="mt-2 text-blue-500 underline text-sm">
          返回知识库
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <button onClick={() => navigate('/executor/knowledge')} className="hover:text-blue-600 transition-colors">
          知识库
        </button>
        <span>/</span>
        <span>{entry.category}</span>
        <span>/</span>
        <span className="text-gray-600">{entry.title}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 data-testid="entry-title" className="text-2xl font-bold text-gray-800 mb-2">
              {entry.title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span data-testid="entry-category" className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                {entry.category}
              </span>
              <span data-testid="entry-version">{entry.version}</span>
              <span data-testid="entry-updated">更新时间：{formatDate(entry.updated_at)}</span>
              <span data-testid="entry-views">查看次数：{entry.view_count}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <button
            data-testid="helpful-btn"
            onClick={handleHelpful}
            disabled={helpful}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              helpful
                ? 'bg-green-50 text-green-600 border border-green-200 cursor-default'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
            }`}
          >
            <span>👍</span>
            <span data-testid="helpful-count">有帮助 ({helpfulCount})</span>
          </button>
          <button
            data-testid="correct-btn"
            onClick={() => navigate(`/executor/knowledge/contribute?entry_id=${entry.id}&title=${encodeURIComponent(entry.title)}&type=correction`)}
            className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            提交修正
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div
          data-testid="entry-content"
          className="prose prose-gray max-w-none leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.content) }}
        />
      </div>
    </div>
  )
}
