import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UserList } from './pages/admin/UserList';
import { CaseList } from './pages/admin/CaseList';
import { IODashboard } from './pages/io/IODashboard';
import { CaseDetail } from './pages/io/CaseDetail';
import { QueryInterface } from './pages/io/QueryInterface';
import { Bookmarks } from './pages/io/Bookmarks';
import { ReportGenerator } from './pages/io/ReportGenerator';
import { EntitiesView } from './pages/io/EntitiesView';
import { NetworkGraph } from './pages/io/NetworkGraph';
import { SupervisorDashboard } from './pages/supervisor/SupervisorDashboard';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { EvidenceDetailPanel } from './components/EvidenceDetailPanel';
import { useAuthStore } from './store/authStore';

function App() {
  const { isAuthenticated, user } = useAuthStore();

  const getDefaultRoute = () => {
    if (!isAuthenticated) return '/login';
    if (user?.role === 'admin') return '/admin';
    if (user?.role === 'investigating_officer') return '/io';
    if (user?.role === 'supervisor') return '/supervisor';
    return '/login';
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to={getDefaultRoute()} replace /> : <Login />
        } />
        
        <Route element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AppShell />
          </ProtectedRoute>
        }>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UserList />} />
          <Route path="/admin/cases" element={<CaseList />} />
        </Route>

        <Route element={
          <ProtectedRoute allowedRoles={['investigating_officer']}>
            <AppShell />
          </ProtectedRoute>
        }>
          <Route path="/io" element={<IODashboard />} />
          <Route path="/io/case/:caseId" element={<CaseDetail />} />
          <Route path="/io/case/:caseId/query" element={<QueryInterface />} />
          <Route path="/io/case/:caseId/bookmarks" element={<Bookmarks />} />
          <Route path="/io/case/:caseId/report" element={<ReportGenerator />} />
          <Route path="/io/case/:caseId/entities" element={<EntitiesView />} />
          <Route path="/io/case/:caseId/network" element={<NetworkGraph />} />
        </Route>

        <Route element={
          <ProtectedRoute allowedRoles={['supervisor']}>
            <AppShell />
          </ProtectedRoute>
        }>
          <Route path="/supervisor" element={<SupervisorDashboard />} />
          <Route path="/supervisor/cases" element={<CaseList />} />
          <Route path="/supervisor/case/:caseId" element={<CaseDetail />} />
          <Route path="/supervisor/case/:caseId/query" element={<QueryInterface />} />
          <Route path="/supervisor/case/:caseId/bookmarks" element={<Bookmarks />} />
          <Route path="/supervisor/case/:caseId/report" element={<ReportGenerator />} />
          <Route path="/supervisor/case/:caseId/entities" element={<EntitiesView />} />
          <Route path="/supervisor/case/:caseId/network" element={<NetworkGraph />} />
        </Route>
        
        <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <EvidenceDetailPanel />
    </BrowserRouter>
  );
}

export default App;
