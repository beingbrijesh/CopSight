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
import { ProtectedRoute } from './components/ProtectedRoute';
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
        
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/users" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserList />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/cases" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <CaseList />
          </ProtectedRoute>
        } />
        
        <Route path="/io" element={
          <ProtectedRoute allowedRoles={['investigating_officer']}>
            <IODashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/io/case/:caseId" element={
          <ProtectedRoute allowedRoles={['investigating_officer']}>
            <CaseDetail />
          </ProtectedRoute>
        } />
        
        <Route path="/io/case/:caseId/query" element={
          <ProtectedRoute allowedRoles={['investigating_officer']}>
            <QueryInterface />
          </ProtectedRoute>
        } />
        
        <Route path="/io/case/:caseId/bookmarks" element={
          <ProtectedRoute allowedRoles={['investigating_officer']}>
            <Bookmarks />
          </ProtectedRoute>
        } />
        
        <Route path="/io/case/:caseId/report" element={
          <ProtectedRoute allowedRoles={['investigating_officer', 'admin']}>
            <ReportGenerator />
          </ProtectedRoute>
        } />
        
        <Route path="/io/case/:caseId/entities" element={
          <ProtectedRoute allowedRoles={['investigating_officer']}>
            <EntitiesView />
          </ProtectedRoute>
        } />
        
        <Route path="/io/case/:caseId/network" element={
          <ProtectedRoute allowedRoles={['investigating_officer', 'admin', 'supervisor']}>
            <NetworkGraph />
          </ProtectedRoute>
        } />
        
        <Route path="/supervisor" element={
          <ProtectedRoute allowedRoles={['supervisor']}>
            <IODashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
