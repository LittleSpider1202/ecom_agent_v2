import { useEffect, useState } from 'react'
import axios from 'axios'

interface Task {
  id: number
  title: string
  flow_name: string
  status: string
  current_step: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending:   { text: '待处理', cls: 'bg-orange-100 text-orange-700' },
  running:   { text: '进行中', cls: 'bg-blue-100 text-blue-700' },
  completed: { text: '已完成', cls: 'bg-green-100 text-green-700' },
  failed:    { text: '失败',   cls: 'bg-red-100 text-red-700' },
  rejected:  { text: '已驳回', cls: 'bg-gray-100 text-gray-600' },
}

export default function TaskMonitor() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    const token = localStorage.getItem('auth_token')
    axios
      .get('/api/tasks/monitor', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setTasks(res.data))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">全局任务监控</h1>
        <button
          onClick={load}
          className="px-3 py-1.5 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
        >
          刷新
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">加载中…</div>
      ) : tasks.length === 0 ? (
        <div className="text-center text-gray-400 py-20">暂无任务</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" data-testid="task-monitor-table">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">任务名称</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">所属流程</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">状态</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">当前步骤</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map(task => {
                const s = STATUS_LABEL[task.status] ?? { text: task.status, cls: 'bg-gray-100 text-gray-600' }
                const date = task.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : '-'
                return (
                  <tr key={task.id} className="hover:bg-gray-50 transition-colors" data-testid="monitor-task-row">
                    <td className="px-4 py-3 text-gray-500 font-mono">#{task.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{task.title}</td>
                    <td className="px-4 py-3 text-gray-500">{task.flow_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
                        {s.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{task.current_step ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{date}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
