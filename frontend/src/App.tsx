import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          电商智能运营平台 v2
        </h1>
        <p className="text-gray-500 mb-8">人机混合执行流程 · 让决策更高效</p>
        <div className="space-x-4">
          <a
            href="/executor/dashboard"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            执行者工作台
          </a>
          <a
            href="/manage/dashboard"
            className="inline-block bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors"
          >
            管理工作台
          </a>
        </div>
      </div>
    </div>
  )
}

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* 执行者工作台 */}
        <Route path="/executor/dashboard" element={<Placeholder title="EW-01 我的看板" />} />
        <Route path="/executor/tasks" element={<Placeholder title="EW-02 任务列表" />} />
        <Route path="/executor/tasks/:taskId" element={<Placeholder title="EW-03 任务详情（自动）" />} />
        <Route path="/task/:taskId/step/:stepId" element={<Placeholder title="EW-04 人工操作步骤" />} />
        <Route path="/executor/history" element={<Placeholder title="EW-05 任务历史" />} />
        <Route path="/executor/knowledge" element={<Placeholder title="EW-06 知识库" />} />
        <Route path="/executor/knowledge/contribute" element={<Placeholder title="EW-08 知识贡献" />} />
        <Route path="/executor/knowledge/:id" element={<Placeholder title="EW-07 知识词条详情" />} />
        <Route path="/executor/tools" element={<Placeholder title="EW-09 工具列表" />} />
        <Route path="/executor/tools/:executionId" element={<Placeholder title="EW-10 工具执行详情" />} />

        {/* 管理工作台 */}
        <Route path="/manage/dashboard" element={<Placeholder title="MW-01 决策驾驶舱" />} />
        <Route path="/manage/flows" element={<Placeholder title="MW-02 流程定义列表" />} />
        <Route path="/manage/flows/new" element={<Placeholder title="MW-03 流程编辑器（新建）" />} />
        <Route path="/manage/flows/:flowId" element={<Placeholder title="MW-03 流程编辑器" />} />
        <Route path="/manage/flows/:flowId/versions" element={<Placeholder title="MW-04 流程版本历史" />} />
        <Route path="/manage/tools" element={<Placeholder title="MW-05 工具库管理" />} />
        <Route path="/manage/tools/new" element={<Placeholder title="MW-06 工具上传" />} />
        <Route path="/manage/tools/:toolId" element={<Placeholder title="MW-06 工具编辑" />} />
        <Route path="/manage/departments" element={<Placeholder title="MW-07 部门管理" />} />
        <Route path="/manage/roles" element={<Placeholder title="MW-08 角色权限" />} />
        <Route path="/manage/members" element={<Placeholder title="MW-09 成员管理" />} />
        <Route path="/manage/monitor" element={<Placeholder title="MW-10 全局任务监控" />} />
        <Route path="/manage/tasks/:taskId" element={<Placeholder title="MW-11 任务实例详情" />} />
        <Route path="/manage/analytics" element={<Placeholder title="MW-12 数据分析看板" />} />
        <Route path="/manage/suggestions" element={<Placeholder title="MW-13 AI决策建议" />} />
        <Route path="/manage/suggestions/:id" element={<Placeholder title="MW-13 AI决策建议详情" />} />
        <Route path="/manage/integrations" element={<Placeholder title="MW-14 平台集成配置" />} />
        <Route path="/manage/logs" element={<Placeholder title="MW-15 系统日志" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
