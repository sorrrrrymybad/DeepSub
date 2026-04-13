import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import TasksPage from './pages/TasksPage'
import NewTaskPage from './pages/NewTaskPage'
import SettingsPage from './pages/SettingsPage'
import HistoryPage from './pages/HistoryPage'
import { WebSocketProvider } from './context/WebSocketContext'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/tasks" replace />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="tasks/new" element={<NewTaskPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="history" element={<HistoryPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WebSocketProvider>
    </QueryClientProvider>
  )
}
