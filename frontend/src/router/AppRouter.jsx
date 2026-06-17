import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/Layout/AppLayout';

// Динамический импорт (Code-Splitting) для критического ускорения загрузки приложения при слабом интернете
const Login = lazy(() => import('../pages/Login'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Reports = lazy(() => import('../pages/Reports'));
const Calculator = lazy(() => import('../pages/Calculator'));
const References = lazy(() => import('../pages/References'));
const Documents = lazy(() => import('../pages/Documents'));
const Reporting = lazy(() => import('../pages/Reporting'));
const Audit = lazy(() => import('../pages/Audit'));
const Products = lazy(() => import('../pages/Products'));
const Import = lazy(() => import('../pages/Import'));
const MarketAnalysis = lazy(() => import('../pages/MarketAnalysis'));
const LivestockTracking = lazy(() => import('../pages/LivestockTracking'));

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { role, loading } = useAuth();

  if (loading) {
    return <div style={{ display:'flex', height:'100vh', justifyContent:'center', alignItems:'center' }}><Spin size="large" /></div>;
  }

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Заглушка, которая отображается пока качается JavaScript бандл конкретной страницы
const PageLoader = () => (
  <div style={{ padding: 40, textAlign: 'center' }}>
    <Spin tip="Идет загрузка модуля..." size="large" />
  </div>
);

const AppRouter = () => {
  return (
    <Suspense fallback={<PageLoader />}>
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
          <Route path="market-analysis" element={<MarketAnalysis />} />
          <Route path="calculator" element={<Calculator />} />
          <Route path="references" element={<References />} />
          <Route path="documents" element={<Documents />} />
          <Route path="reporting" element={<Reporting />} />
          <Route path="products" element={<Products />} />
          <Route path="import" element={<Import />} />
          <Route path="livestock" element={<LivestockTracking />} />
          
          <Route 
            path="audit" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Audit />
              </ProtectedRoute>
            } 
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
