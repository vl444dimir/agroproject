import { createContext, useState, useEffect, useContext } from 'react';
import { MOCK_USERS, MOCK_AUDIT_LOG } from '../mock';
import { auditApi } from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('agro_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (loginName, password) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const foundUser = MOCK_USERS.find(u => u.login === loginName && u.password === password);
        
        const ip = '127.0.0.1'; // Mock IP
        
        if (foundUser) {
          const sessionUser = { login: foundUser.login, role: foundUser.role, name: foundUser.name };
          setUser(sessionUser);
          localStorage.setItem('agro_user', JSON.stringify(sessionUser));
          
          const logEntry = {
            id: Date.now().toString(),
            datetime: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ''),
            user: foundUser.login,
            role: foundUser.name,
            action: 'Вход в систему',
            ip,
            status: 'success'
          };
          MOCK_AUDIT_LOG.push(logEntry);
          auditApi.createAuditLog(logEntry);
          resolve(sessionUser);
        } else {
          const failEntry = {
            id: Date.now().toString(),
            datetime: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ''),
            user: loginName || 'unknown',
            role: '—',
            action: 'Попытка входа',
            ip,
            status: 'failed'
          };
          MOCK_AUDIT_LOG.push(failEntry);
          auditApi.createAuditLog(failEntry);
          reject(new Error('Неверный логин или пароль'));
        }
      }, 800); // 800ms delay as requested
    });
  };

  const logout = () => {
    if (user) {
      const logEntry = {
        id: Date.now().toString(),
        datetime: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ''),
        user: user.login,
        role: user.name,
        action: 'Выход из системы',
        ip: '127.0.0.1',
        status: 'success'
      };
      MOCK_AUDIT_LOG.push(logEntry);
      auditApi.createAuditLog(logEntry);
    }
    setUser(null);
    localStorage.removeItem('agro_user');
  };

  return (
    <AuthContext.Provider value={{ user, role: user?.role, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
