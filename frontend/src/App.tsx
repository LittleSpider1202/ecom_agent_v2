import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Login from './pages/Login'
import PrivateRoute from './components/PrivateRoute'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/executor/Dashboard'
import TaskList from './pages/executor/TaskList'
import HumanStep from './pages/executor/HumanStep'
import TaskDetail from './pages/executor/TaskDetail'
import TaskHistory from './pages/executor/TaskHistory'
import KnowledgeHome from './pages/executor/KnowledgeHome'
import KnowledgeDetail from './pages/executor/KnowledgeDetail'
import KnowledgeContribute from './pages/executor/KnowledgeContribute'
import ToolList from './pages/executor/ToolList'
import ToolExecutionDetail from './pages/executor/ToolExecutionDetail'
import DecisionCockpit from './pages/manager/DecisionCockpit'
import SuggestionDetail from './pages/manager/SuggestionDetail'
import FlowEditor from './pages/manager/FlowEditor'
import FlowList from './pages/manager/FlowList'
import FlowVersions from './pages/manager/FlowVersions'
import ToolManagement from './pages/manager/ToolManagement'
import ToolEditor from './pages/manager/ToolEditor'
import DepartmentManagement from './pages/manager/DepartmentManagement'
import TaskMonitor from './pages/manager/TaskMonitor'

function Placeholder({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
        <p className="text-gray-400 mt-2">开发中...</p>
        <a href="/" className="mt-4 inline-block text-blue-600 hover:underline">
          返回首页
        </a>
      </div>
    </div>
  )
}

function ProtectedLayout({ children, requiredRole }: { children: React.ReactNode; requiredRole?: 'manager' }) {
  return (
    <PrivateRoute requiredRole={requiredRole}>
      <AppLayout>{children}</AppLayout>
    </PrivateRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/executor/dashboard" replace />} />

          {/* 执行者工作台 */}
          <Route
            path="/executor/dashboard"
            element={<ProtectedLayout><Dashboard /></ProtectedLayout>}
          />
          <Route
            path="/executor/tasks"
            element={<ProtectedLayout><TaskList /></ProtectedLayout>}
          />
          <Route
            path="/executor/tasks/:taskId"
            element={<ProtectedLayout><TaskDetail /></ProtectedLayout>}
          />
          <Route
            path="/task/:taskId/step/:stepId"
            element={<ProtectedLayout><HumanStep /></ProtectedLayout>}
          />
          <Route
            path="/executor/history"
            element={<ProtectedLayout><TaskHistory /></ProtectedLayout>}
          />
          <Route
            path="/executor/knowledge"
            element={<ProtectedLayout><KnowledgeHome /></ProtectedLayout>}
          />
          <Route
            path="/executor/knowledge/contribute"
            element={<ProtectedLayout><KnowledgeContribute /></ProtectedLayout>}
          />
          <Route
            path="/executor/knowledge/:id"
            element={<ProtectedLayout><KnowledgeDetail /></ProtectedLayout>}
          />
          <Route
            path="/executor/tools"
            element={<ProtectedLayout><ToolList /></ProtectedLayout>}
          />
          <Route
            path="/executor/tools/:executionId"
            element={<ProtectedLayout><ToolExecutionDetail /></ProtectedLayout>}
          />

          {/* 管理工作台 — 需要 manager 角色 */}
          <Route
            path="/manage/dashboard"
            element={<ProtectedLayout requiredRole="manager"><DecisionCockpit /></ProtectedLayout>}
          />
          <Route
            path="/manage/flows"
            element={<ProtectedLayout requiredRole="manager"><FlowList /></ProtectedLayout>}
          />
          <Route
            path="/manage/flows/new"
            element={<ProtectedLayout requiredRole="manager"><FlowEditor /></ProtectedLayout>}
          />
          <Route
            path="/manage/flows/:flowId"
            element={<ProtectedLayout requiredRole="manager"><FlowEditor /></ProtectedLayout>}
          />
          <Route
            path="/manage/flows/:flowId/versions"
            element={<ProtectedLayout requiredRole="manager"><FlowVersions /></ProtectedLayout>}
          />
          <Route
            path="/manage/tools"
            element={<ProtectedLayout requiredRole="manager"><ToolManagement /></ProtectedLayout>}
          />
          <Route
            path="/manage/tools/new"
            element={<ProtectedLayout requiredRole="manager"><ToolEditor /></ProtectedLayout>}
          />
          <Route
            path="/manage/tools/:toolId"
            element={<ProtectedLayout requiredRole="manager"><ToolEditor /></ProtectedLayout>}
          />
          <Route
            path="/manage/departments"
            element={<ProtectedLayout requiredRole="manager"><DepartmentManagement /></ProtectedLayout>}
          />
          <Route
            path="/manage/roles"
            element={<ProtectedLayout requiredRole="manager"><Placeholder title="MW-08 角色权限" /></ProtectedLayout>}
          />
          <Route
            path="/manage/members"
            element={<ProtectedLayout requiredRole="manager"><Placeholder title="MW-09 成员管理" /></ProtectedLayout>}
          />
          <Route
            path="/manage/monitor"
            element={<ProtectedLayout requiredRole="manager"><TaskMonitor /></ProtectedLayout>}
          />
          <Route
            path="/manage/tasks/:taskId"
            element={<ProtectedLayout requiredRole="manager"><Placeholder title="MW-11 任务实例详情" /></ProtectedLayout>}
          />
          <Route
            path="/manage/analytics"
            element={<ProtectedLayout requiredRole="manager"><Placeholder title="MW-12 数据分析看板" /></ProtectedLayout>}
          />
          <Route
            path="/manage/suggestions"
            element={<ProtectedLayout requiredRole="manager"><Placeholder title="MW-13 AI决策建议" /></ProtectedLayout>}
          />
          <Route
            path="/manage/suggestions/:id"
            element={<ProtectedLayout requiredRole="manager"><SuggestionDetail /></ProtectedLayout>}
          />
          <Route
            path="/manage/integrations"
            element={<ProtectedLayout requiredRole="manager"><Placeholder title="MW-14 平台集成配置" /></ProtectedLayout>}
          />
          <Route
            path="/manage/logs"
            element={<ProtectedLayout requiredRole="manager"><Placeholder title="MW-15 系统日志" /></ProtectedLayout>}
          />

          <Route path="*" element={<Navigate to="/executor/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
