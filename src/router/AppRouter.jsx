import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/Layout/AppLayout';

// Pages
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Reports from '../pages/Reports';
import Calculator from '../pages/Calculator';
import References from '../pages/References';
import Documents from '../pages/Documents';
import Reporting from '../pages/Reporting';
import Audit from '../pages/Audit';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { role, loading } = useAuth();

  if (loading) {
    return null; // or a loading spinner
  }

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="calculator" element={<Calculator />} />
        <Route path="references" element={<References />} />
        <Route path="documents" element={<Documents />} />
        <Route path="reporting" element={<Reporting />} />
        
        {/* Admin only route */}
        <Route 
          path="audit" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Audit />
            </ProtectedRoute>
          } 
        />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
