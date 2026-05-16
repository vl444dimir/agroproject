import { createContext, useState, useEffect, useContext } from 'react';
import backendClient from '../api/backendClient';
import { MOCK_AUDIT_LOG } from '../mock';
import { auditApi } from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('agro_user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      backendClient.get('/auth/me').then(meRes => {
        const me = meRes.data;
        const freshUser = {
          login: me.username || me.login || parsed.login,
          role: me.role || me.authorities?.[0]?.authority?.replace('ROLE_', '')?.toLowerCase() || parsed.role,
          name: me.name || me.username || parsed.name,
          id: me.id || parsed.id,
          organizationId: me.organizationId || parsed.organizationId,
          organizationName: me.organizationName || parsed.organizationName,
        };
        setUser(freshUser);
        localStorage.setItem('agro_user', JSON.stringify(freshUser));
      }).catch(() => {
        localStorage.removeItem('agro_user');
        localStorage.removeItem('token');
        setUser(null);
      });
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
      
      let sessionUser;
      try {
        const meRes = await backendClient.get('/auth/me');
        sessionUser = meRes.data;
        sessionUser = {
          login: sessionUser.username || sessionUser.login || username,
          role: sessionUser.role || sessionUser.authorities?.[0]?.authority?.replace('ROLE_', '')?.toLowerCase() || 'user',
          name: sessionUser.name || sessionUser.username || username,
          id: sessionUser.id,
          organizationId: sessionUser.organizationId,
          organizationName: sessionUser.organizationName,
        };
      } catch {
        sessionUser = { login: username, role: 'admin', name: username };
      }
      
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
  };

  return (
    <AuthContext.Provider value={{ user, role: user?.role, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
