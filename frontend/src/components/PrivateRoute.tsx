import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  requiredRole?: 'executor' | 'manager' | 'admin'
}

export default function PrivateRoute({ children, requiredRole }: Props) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">加载中...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (requiredRole && requiredRole === 'manager' && user.role === 'executor') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-xl font-semibold text-gray-700">权限不足</h2>
          <p className="text-gray-400 mt-2 text-sm">您没有访问该页面的权限</p>
          <a href="/executor/dashboard" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
            返回执行者工作台
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
