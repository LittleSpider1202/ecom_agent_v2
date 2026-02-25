import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../hooks/useApi'

interface Task {
  id: number
  title: string
  flow_name: string
  status: string
  current_step: string | null
  due_date: string | null
  created_at: string
}

interface PagedResult {
  items: Task[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

const TABS = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'running', label: '进行中' },
  { key: 'completed', label: '已完成' },
  { key: 'failed', label: '失败' },
]

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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function TaskList() {
  const navigate = useNavigate()
  const [data, setData] = useState<PagedResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<'created_at_desc' | 'created_at_asc'>('created_at_desc')

  const fetchTasks = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (tab) params.set('status', tab)
    if (search) params.set('search', search)
    params.set('sort', sort)
    params.set('page', String(page))
    params.set('page_size', '20')
    api.get(`/api/tasks?${params}`)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [tab, search, sort, page])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleTabChange = (key: string) => { setTab(key); setPage(1) }
  const handleSearch = () => { setSearch(searchInput); setPage(1) }
  const handleClearSearch = () => { setSearchInput(''); setSearch(''); setPage(1) }
  const toggleSort = () => {
    setSort((s) => s === 'created_at_desc' ? 'created_at_asc' : 'created_at_desc')
    setPage(1)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">任务列表</h1>

      {/* 搜索框 */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="搜索任务名称..."
          data-testid="search-input"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          搜索
        </button>
        {search && (
          <button
            onClick={handleClearSearch}
            data-testid="clear-search"
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            清除
          </button>
        )}
      </div>

      {/* 状态 Tab */}
      <div className="flex gap-1 border-b border-gray-200 mb-4" data-testid="status-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            data-testid={`tab-${t.key || 'all'}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 表头 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">任务名称</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">所属流程</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">状态</th>
              <th
                className="text-left px-4 py-3 text-gray-600 font-medium cursor-pointer hover:text-blue-600 select-none"
                onClick={toggleSort}
                data-testid="sort-created-at"
              >
                创建时间 {sort === 'created_at_desc' ? '↓' : '↑'}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-400">加载中...</td>
              </tr>
            )}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-400">
                  {search ? `未找到包含"${search}"的任务` : '暂无任务'}
                </td>
              </tr>
            )}
            {!loading && data?.items.map((t) => (
              <tr
                key={t.id}
                className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/executor/tasks/${t.id}`)}
                data-testid={`task-row-${t.id}`}
              >
                <td className="px-4 py-3 font-medium text-gray-800">{t.title}</td>
                <td className="px-4 py-3 text-gray-500">{t.flow_name}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-gray-400">{formatDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between mt-4" data-testid="pagination">
          <span className="text-sm text-gray-500">
            共 {data.total} 条，第 {data.page} / {data.total_pages} 页
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="page-prev"
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              上一页
            </button>
            {Array.from({ length: Math.min(data.total_pages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                data-testid={`page-${p}`}
                className={`px-3 py-1.5 text-sm border rounded-lg ${
                  page === p
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
              disabled={page === data.total_pages}
              data-testid="page-next"
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
