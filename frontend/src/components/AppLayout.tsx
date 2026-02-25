import { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

interface Props {
  children: ReactNode
}

export default function AppLayout({ children }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
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
      <main>{children}</main>
    </div>
  )
}
