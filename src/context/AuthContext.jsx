import { createContext, useState, useEffect, useContext } from 'react';
import { MOCK_USERS, MOCK_AUDIT_LOG } from '../mock';

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
          
          MOCK_AUDIT_LOG.push({
            id: Date.now(),
            datetime: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ''),
            user: foundUser.login,
            role: foundUser.name,
            action: 'Вход в систему',
            ip,
            status: 'success'
          });
          resolve(sessionUser);
        } else {
          MOCK_AUDIT_LOG.push({
            id: Date.now(),
            datetime: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ''),
            user: loginName || 'unknown',
            role: '—',
            action: 'Попытка входа',
            ip,
            status: 'failed'
          });
          reject(new Error('Неверный логин или пароль'));
        }
      }, 800); // 800ms delay as requested
    });
  };

  const logout = () => {
    if (user) {
      MOCK_AUDIT_LOG.push({
        id: Date.now(),
        datetime: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ''),
        user: user.login,
        role: user.name,
        action: 'Выход из системы',
        ip: '127.0.0.1',
        status: 'success'
      });
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
