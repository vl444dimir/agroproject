import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppRouter from './router/AppRouter';
import { initAPI } from './mock';
import { Spin } from 'antd';

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initAPI().then(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" tip="Загрузка данных с сервера..." />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
