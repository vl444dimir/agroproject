import { createContext, useState, useEffect, useContext } from 'react';
import backendClient from '../api/backendClient';
import { 
  initAPI,
  MOCK_USERS, 
  MOCK_KPI, 
  MOCK_TOP_FERTILIZERS, 
  MOCK_TOP_PESTICIDES, 
  MOCK_REPORTS, 
  MOCK_FERTILIZERS_REF, 
  MOCK_PESTICIDES_REF, 
  MOCK_DOCUMENTS, 
  MOCK_SUPPLY_CHAIN, 
  MOCK_AUDIT_LOG, 
  MOCK_NOTIFICATIONS, 
  CALC_NORMS, 
  MOCK_MAP_DISTRICTS 
} from '../mock';
import { auditApi } from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('agro_user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    } else {
      localStorage.removeItem('agro_user');
      localStorage.removeItem('token');
    }
    setLoading(false);
  }, []);

    const login = async (username, password) => {
    try {
      const response = await backendClient.post('/auth/login', { username, password });
      const { token } = response.data;
      
      localStorage.setItem('token', token);
      
      // Fetch actual user profile and role from backend
      const meResponse = await backendClient.get('/auth/me');
      const userProfile = meResponse.data;
      
      const sessionUser = { 
        id: userProfile.id,
        login: userProfile.username, 
        role: userProfile.role.replace('ROLE_', '').toLowerCase(), 
        name: userProfile.username,
        organizationId: userProfile.organizationId,
        organizationName: userProfile.organizationName
      }; 
      
      // Re-run initAPI so all global tables and KPIs are fetched using the valid token
      await initAPI();
      
      setUser(sessionUser);
      localStorage.setItem('agro_user', JSON.stringify(sessionUser));
      
      const ip = '127.0.0.1';
      const logEntry = {
        id: Date.now().toString(),
        datetime: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ''),
        user: username,
        role: sessionUser.name,
        action: 'Вход в систему (Бэкэнд)',
        ip,
        status: 'success'
      };
      MOCK_AUDIT_LOG.push(logEntry);
      auditApi.createAuditLog(logEntry);
      
      return sessionUser;
    } catch (error) {
      const failEntry = {
        id: Date.now().toString(),
        datetime: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ''),
        user: username || 'unknown',
        role: '—',
        action: 'Попытка входа (Бэкэнд)',
        ip: '127.0.0.1',
        status: 'failed'
      };
      MOCK_AUDIT_LOG.push(failEntry);
      auditApi.createAuditLog(failEntry);
      throw new Error('Неверный логин или пароль');
    }
  };

  const register = async (username, password) => {
    try {
      await backendClient.post('/auth/register', { username, password });
      return true;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Ошибка регистрации');
    }
  };

  const logout = async () => {
    if (user) {
      try {
        await backendClient.post(`/auth/logout?username=${user.login}`);
      } catch (e) {
        console.error('Logout error on backend', e);
      }
      
      const logEntry = {
        id: Date.now().toString(),
        datetime: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ''),
        user: user.login,
        role: user.name,
        action: 'Выход из системы (Бэкэнд)',
        ip: '127.0.0.1',
        status: 'success'
      };
      MOCK_AUDIT_LOG.push(logEntry);
      auditApi.createAuditLog(logEntry);
    }
    setUser(null);
    localStorage.removeItem('agro_user');
    localStorage.removeItem('token');
    
    // Clear all mock/fetched global lists to ensure clean session state
    MOCK_USERS.length = 0;
    MOCK_KPI.landArea = '';
    MOCK_KPI.sownArea = '';
    MOCK_KPI.harvest = '';
    MOCK_KPI.fertilizers = '';
    MOCK_KPI.pesticides = '';
    MOCK_KPI.subsidies = '';
    MOCK_TOP_FERTILIZERS.length = 0;
    MOCK_TOP_PESTICIDES.length = 0;
    MOCK_REPORTS.length = 0;
    MOCK_FERTILIZERS_REF.length = 0;
    MOCK_PESTICIDES_REF.length = 0;
    MOCK_DOCUMENTS.length = 0;
    MOCK_SUPPLY_CHAIN.length = 0;
    MOCK_NOTIFICATIONS.length = 0;
    Object.keys(CALC_NORMS).forEach(key => delete CALC_NORMS[key]);
    MOCK_MAP_DISTRICTS.length = 0;
  };

  return (
    <AuthContext.Provider value={{ user, role: user?.role, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
