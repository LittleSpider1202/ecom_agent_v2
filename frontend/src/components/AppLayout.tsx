import { ReactNode, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import api from '../hooks/useApi'

interface Props {
  children: ReactNode
}

interface Notification {
  id: number
  type: string
  title: string
  content: string
  read: boolean
}

const EXECUTOR_NAV = [
  { label: '我的看板', path: '/executor/dashboard', testid: 'nav-dashboard' },
  { label: '任务列表', path: '/executor/tasks', testid: 'nav-tasks' },
  { label: '任务历史', path: '/executor/history', testid: 'nav-history' },
  { label: '知识库', path: '/executor/knowledge', testid: 'nav-knowledge' },
  { label: '工具箱', path: '/executor/tools', testid: 'nav-tools' },
]

const MANAGER_NAV = [
  { label: '决策驾驶舱', path: '/manage/dashboard', testid: 'nav-cockpit' },
  { label: '任务监控', path: '/manage/monitor', testid: 'nav-monitor' },
  { label: '流程管理', path: '/manage/flows', testid: 'nav-flows' },
  { label: '数据分析', path: '/manage/analytics', testid: 'nav-analytics' },
  { label: 'AI建议', path: '/manage/suggestions', testid: 'nav-suggestions' },
  { label: '工具管理', path: '/manage/tools', testid: 'nav-tool-mgmt' },
  { label: '成员管理', path: '/manage/members', testid: 'nav-members' },
  { label: '集成配置', path: '/manage/integrations', testid: 'nav-integrations' },
  { label: '系统日志', path: '/manage/logs', testid: 'nav-logs' },
]

export default function AppLayout({ children }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)

  const isManager = user && user.role !== 'executor'
  const navItems = isManager ? MANAGER_NAV : EXECUTOR_NAV
  const isManagerPath = location.pathname.startsWith('/manage/')

  // Show manager nav if on manager path AND user is manager
  const sidebarItems = isManager && isManagerPath ? MANAGER_NAV : EXECUTOR_NAV

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!user) return
    api.get('/api/bot/notifications')
      .then(r => {
        const data = r.data as { notifications: Notification[] }
        setNotifications(data.notifications ?? [])
      })
      .catch(() => {/* silent */})
  }, [user])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900 text-sm">电商智能运营平台 v2</span>
          <span className="text-gray-300">|</span>
          <a href="/executor/dashboard" className="text-sm text-gray-600 hover:text-blue-600">
            执行者工作台
          </a>
          {user && user.role !== 'executor' && (
            <a href="/manage/dashboard" className="text-sm text-gray-600 hover:text-blue-600">
              管理工作台
            </a>
          )}
        </div>
        {user && (
          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <div className="relative">
              <button
                data-testid="notification-bell"
                onClick={() => { setShowNotifPanel(v => !v); markAllRead() }}
                className="relative p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="通知"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span
                    data-testid="notification-badge"
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center leading-none"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifPanel && (
                <div
                  data-testid="notification-panel"
                  className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto"
                >
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900">通知中心</span>
                    <span className="text-xs text-gray-400">{notifications.length} 条</span>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">暂无通知</div>
                  ) : (
                    <ul>
                      {notifications.slice(0, 10).map(n => (
                        <li
                          key={n.id}
                          data-testid={`notification-item-${n.id}`}
                          className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 last:border-0"
                        >
                          <p className="text-xs font-medium text-gray-800">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <span className="text-sm text-gray-700" data-testid="user-display-name">
              {user.display_name}
            </span>
            <div className="relative group">
              <button
                className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-medium flex items-center justify-center cursor-pointer"
                data-testid="user-avatar"
                aria-label="用户菜单"
              >
                {(user.display_name || user.username).charAt(0)}
              </button>
              <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-50">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                  data-testid="logout-button"
                >
                  退出登录
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <nav
          className="w-48 bg-white border-r border-gray-200 flex-shrink-0 py-4"
          data-testid={isManager && isManagerPath ? 'manager-sidebar' : 'executor-sidebar'}
        >
          <ul className="space-y-0.5 px-2">
            {sidebarItems.map(item => {
              const isActive = location.pathname === item.path ||
                (item.path !== '/executor/dashboard' && location.pathname.startsWith(item.path))
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    data-testid={item.testid}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}
