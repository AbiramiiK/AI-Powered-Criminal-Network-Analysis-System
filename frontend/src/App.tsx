import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppLayout } from './layouts/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CasesPage } from './pages/CasesPage'
import { CaseDetailPage } from './pages/CaseDetailPage'
import { NetworkPage } from './pages/NetworkPage'
import { EntitiesPage } from './pages/EntitiesPage'
import { PersonProfilePage } from './pages/PersonProfilePage'
import { EntityResolutionPage } from './pages/EntityResolutionPage'
import { DataSourcesPage } from './pages/DataSourcesPage'
import { TimelinePage } from './pages/TimelinePage'
import { PatternAnalysisPage } from './pages/PatternAnalysisPage'
import { FinancialAnalysisPage } from './pages/FinancialAnalysisPage'
import { CommunicationsAnalysisPage } from './pages/CommunicationsAnalysisPage'
import { LocationsAnalysisPage } from './pages/LocationsAnalysisPage'
import { AiAnalysisPage } from './pages/AiAnalysisPage'
import { RiskAnalysisPage } from './pages/RiskAnalysisPage'
import { AlertsPage } from './pages/AlertsPage'
import { ReportsPage } from './pages/ReportsPage'
import { AuditPage } from './pages/AuditPage'
import { AdminPage } from './pages/AdminPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/cases" element={<CasesPage />} />
        <Route path="/cases/:caseId" element={<CaseDetailPage />} />
        <Route path="/network" element={<NetworkPage />} />
        <Route path="/network/:personId" element={<NetworkPage />} />
        <Route path="/entities" element={<EntitiesPage />} />
        <Route path="/entities/person/:personId" element={<PersonProfilePage />} />
        <Route path="/entity-resolution" element={<EntityResolutionPage />} />
        <Route path="/data-sources" element={<DataSourcesPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/analytics/patterns" element={<PatternAnalysisPage />} />
        <Route path="/analytics/financial" element={<FinancialAnalysisPage />} />
        <Route path="/analytics/communications" element={<CommunicationsAnalysisPage />} />
        <Route path="/analytics/locations" element={<LocationsAnalysisPage />} />
        <Route path="/ai-analysis" element={<AiAnalysisPage />} />
        <Route path="/analytics/risk" element={<RiskAnalysisPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
