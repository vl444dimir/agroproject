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
  StockOutlined,
  DollarOutlined,
  DatabaseOutlined,
  ImportOutlined,
  TeamOutlined,
  PartitionOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const Sider = Layout.Sider;

const AppSider = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();

  const menuItems = useMemo(() => {
    const allItems = [
      {
        key: '/',
        icon: <BarChartOutlined />,
        label: 'Главная / Статистика',
        roles: ['admin', 'staff', 'employee', 'user'],
      },
      {
        key: '/reports',
        icon: <FileTextOutlined />,
        label: 'Субсидии и отчёты',
        roles: ['admin', 'staff', 'employee', 'user'],
      },
      {
        key: '/subsidies',
        icon: <DollarOutlined />,
        label: 'Заявки на субсидии',
        roles: ['admin', 'staff', 'employee', 'user'],
      },
      {
        key: '/market-analysis',
        icon: <RiseOutlined />,
        label: 'Анализ рынка сбыта',
        roles: ['admin', 'staff', 'employee', 'user'],
      },
      {
        key: '/calculator',
        icon: <CalculatorOutlined />,
        label: 'Онлайн-калькулятор',
        roles: ['admin', 'staff', 'employee', 'user'],
      },
      {
        key: '/references',
        icon: <BookOutlined />,
        label: 'Справочники',
        roles: ['admin', 'staff', 'employee', 'user'],
      },
      {
        key: '/organizations',
        icon: <TeamOutlined />,
        label: 'Реестр контрагентов',
        roles: ['admin', 'staff', 'employee', 'user'],
      },
      {
        key: '/esf-records',
        icon: <PartitionOutlined />,
        label: 'Записи ЭСФ',
        roles: ['admin', 'staff', 'employee', 'user'],
      },
      {
        key: '/reporting',
        icon: <ContainerOutlined />,
        label: 'Формирование отчетов',
        roles: ['admin', 'staff', 'employee', 'user'],
      },
      {
        key: '/livestock',
        icon: <StockOutlined />,
        label: 'Поголовье скота',
        roles: ['admin', 'staff', 'employee', 'user'],
      },
      {
        key: '/products',
        icon: <AppstoreAddOutlined />,
        label: 'Реестр препаратов',
        roles: ['admin', 'staff', 'employee'],
      },
      {
        key: '/import',
        icon: <UploadOutlined />,
        label: 'Импорт из Excel',
        roles: ['admin', 'staff', 'employee'],
      },
      {
        key: '/audit',
        icon: <AuditOutlined />,
        label: 'Аудит событий',
        roles: ['admin'],
      },
    ];

    const currentRole = role || 'user';
    return allItems.filter(item => item.roles.includes(currentRole));
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
