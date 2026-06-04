import { useState, useMemo } from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BarChartOutlined,
  FileTextOutlined,
  CalculatorOutlined,
  BookOutlined,
  FolderOutlined,
  ContainerOutlined,
  AuditOutlined,
  AppstoreAddOutlined,
  UploadOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const Sider = Layout.Sider;

const AppSider = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();

  const menuItems = useMemo(() => {
    const items = [
      {
        key: '/',
        icon: <BarChartOutlined />,
        label: 'Главная / Статистика',
      },
      {
        key: '/reports',
        icon: <FileTextOutlined />,
        label: 'Отчёты и аналитика',
      },
      {
        key: '/market-analysis',
        icon: <RiseOutlined />,
        label: 'Анализ рынка сбыта',
      },
      {
        key: '/calculator',
        icon: <CalculatorOutlined />,
        label: 'Онлайн-калькулятор',
      },
      {
        key: '/references',
        icon: <BookOutlined />,
        label: 'Справочники',
      },
      {
        key: '/reporting',
        icon: <ContainerOutlined />,
        label: 'Формирование отчетов',
      },
    ];

    if (role === 'employee' || role === 'admin' || role === 'staff') {
      items.push({
        key: '/products',
        icon: <AppstoreAddOutlined />,
        label: 'Продукты (Бэкэнд)',
      });
      // items.push({
      //   key: '/documents',
      //   icon: <FolderOutlined />,
      //   label: 'Управление документами',
      // });
      items.push({
        key: '/import',
        icon: <UploadOutlined />,
        label: 'Импорт из Excel',
      });
    }

    if (role === 'admin') {
      items.push({
        key: '/audit',
        icon: <AuditOutlined />,
        label: 'Аудит событий',
      });
    }

    return items;
  }, [role]);

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={(value) => setCollapsed(value)}
      width={220}
      className="agro-sider"
      theme="light"
      breakpoint="md" // Collapses on < 768px
    >
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{ borderRight: 0 }}
      />
    </Sider>
  );
};

export default AppSider;
