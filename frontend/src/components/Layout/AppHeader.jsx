import { useState } from 'react';
import { Layout, Button, Typography, Space, Badge, Dropdown, Modal, Input, List } from 'antd';
import { LogoutOutlined, UserOutlined, BellOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MOCK_NOTIFICATIONS, MOCK_FERTILIZERS_REF, MOCK_PESTICIDES_REF, MOCK_MAP_DISTRICTS } from '../../mock';

const { Header } = Layout;
const { Text } = Typography;

const AppHeader = () => {
  const { role, user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const notificationItems = [
    ...notifications.map(n => ({
      key: n.id,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 250, opacity: n.read ? 0.6 : 1 }}>
          <Text>
            {n.type === 'error' && '🔴 '}
            {n.type === 'warning' && '⚠️ '}
            {n.type === 'success' && '✅ '}
            {n.type === 'info' && 'ℹ️ '}
            {n.text}
          </Text>
          {!n.read && (
            <Button type="text" size="small" onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}>×</Button>
          )}
        </div>
      )
    })),
    {
      key: 'mark_all',
      label: (
        <div style={{ textAlign: 'center', marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <Button type="link" size="small" onClick={markAllAsRead}>Отметить все прочитанными</Button>
        </div>
      )
    }
  ];

  const searchResults = () => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    const results = [];
    
    MOCK_FERTILIZERS_REF.forEach(f => {
      if (f.name.toLowerCase().includes(q) || f.composition.toLowerCase().includes(q)) {
        results.push({ type: 'Удобрение', text: f.name, link: '/references' });
      }
    });
    
    MOCK_PESTICIDES_REF.forEach(p => {
      if (p.name.toLowerCase().includes(q) || p.composition.toLowerCase().includes(q)) {
        results.push({ type: 'Пестицид', text: p.name, link: '/references' });
      }
    });
    
    MOCK_MAP_DISTRICTS.forEach(d => {
      if (d.name.toLowerCase().includes(q)) {
        results.push({ type: 'Район', text: d.name, link: '/' });
      }
    });

    return results;
  };

  return (
    <>
      <Header className="agro-header">
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <Text strong style={{ fontSize: 18, margin: 0 }}>
            <span style={{ color: '#1a7c3e' }}>Dala</span>Info
          </Text>
        </div>

        <Space size="large">
          <Button type="text" icon={<SearchOutlined style={{ fontSize: 18 }} />} onClick={() => setIsSearchVisible(true)} />
          
          <Dropdown menu={{ items: notificationItems }} placement="bottomRight" trigger={['click']}>
            <Badge count={unreadCount} offset={[-2, 2]} size="small">
              <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 18 }} />} />
            </Badge>
          </Dropdown>

          <Space size="small">
            <Text type="secondary" style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2', alignItems: 'flex-end', marginRight: 8 }}>
              <b>{user?.name || 'Гость'}</b>
              <small>{role}</small>
            </Text>
            <Button 
              type="primary" 
              danger 
              icon={<LogoutOutlined />} 
              onClick={logout}
            >
              Выйти
            </Button>
          </Space>
        </Space>
      </Header>

      <Modal
        title="Поиск по системе"
        open={isSearchVisible}
        onCancel={() => { setIsSearchVisible(false); setSearchQuery(''); }}
        footer={null}
        width={500}
      >
        <Input 
          autoFocus 
          size="large" 
          prefix={<SearchOutlined />} 
          placeholder="Найти удобрение, пестицид или район..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <List
          style={{ marginTop: 16 }}
          dataSource={searchResults()}
          renderItem={item => (
            <List.Item 
              style={{ cursor: 'pointer' }} 
              onClick={() => { navigate(item.link); setIsSearchVisible(false); setSearchQuery(''); }}
            >
              <Text type="secondary">[{item.type}]</Text> {item.text}
            </List.Item>
          )}
          locale={{ emptyText: searchQuery ? 'Ничего не найдено' : 'Введите текст для поиска' }}
        />
      </Modal>
    </>
  );
};

export default AppHeader;
