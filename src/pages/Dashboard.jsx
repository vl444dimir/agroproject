import { useState, useEffect } from 'react';
import { Typography, Row, Col, Drawer, Table, Skeleton, Button, Spin } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import { RobotOutlined, SyncOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { MOCK_KPI, MOCK_TOP_FERTILIZERS, MOCK_TOP_PESTICIDES, MOCK_MAP_DISTRICTS } from '../mock';

const { Title, Text } = Typography;

const Dashboard = () => {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [drillDownVisible, setDrillDownVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    // Simulate initial load delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleBarClick = (data, index) => {
    setSelectedItem(data);
    setDrillDownVisible(true);
  };

  const drillDownColumns = [
    { title: 'Район', dataIndex: 'district', key: 'district' },
    { title: 'Объем (т/л)', dataIndex: 'volume', key: 'volume' },
    { title: 'Охват (га)', dataIndex: 'area', key: 'area' },
  ];

  // Mock drilldown data generated on the fly
  const drillDownData = selectedItem ? [
    { key: '1', district: 'Район 1', volume: Math.floor(selectedItem.volume * 0.4), area: 120000 },
    { key: '2', district: 'Район 2', volume: Math.floor(selectedItem.volume * 0.35), area: 95000 },
    { key: '3', district: 'Район 3', volume: Math.floor(selectedItem.volume * 0.25), area: 65000 },
  ] : [];

  const formationColumns = [
    { title: 'Участок', dataIndex: 'plot', key: 'plot' },
    { title: 'Площадь (га)', dataIndex: 'area', key: 'area' },
    { title: 'Пользователь', dataIndex: 'user', key: 'user' },
    { title: 'Назначение', dataIndex: 'purpose', key: 'purpose' },
  ];

  const formationData = [
    { key: '1', plot: 'Участок 1', area: 1200, user: 'Компания 7', purpose: 'Посев культуры 1' },
    { key: '2', plot: 'Участок 2', area: 850, user: 'Компания 2', purpose: 'Пастбища' },
    { key: '3', plot: 'Участок 3', area: 2100, user: 'Компания 3', purpose: 'Посев культуры 2' },
    { key: '4', plot: 'Участок 4', area: 400, user: 'Пользователь 4', purpose: 'Овощеводство' },
    { key: '5', plot: 'Участок 5', area: 3400, user: 'Компания 5', purpose: 'Посев культуры 1' },
  ];

  if (loading) {
    return <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 14 }} /></div>;
  }

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={2} className="agro-page-title" style={{ margin: 0 }}>Статистика региона</Title>
      </Row>

      {/* KPI Cards */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <div className="agro-card" style={{ marginBottom: 0 }}>
            <div className="agro-kpi-value">{MOCK_KPI.landArea} га</div>
            <div className="agro-kpi-label">Площадь земель</div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="agro-card" style={{ marginBottom: 0 }}>
            <div className="agro-kpi-value">{MOCK_KPI.harvest} ц/га</div>
            <div className="agro-kpi-label">Урожай</div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="agro-card" style={{ marginBottom: 0 }}>
            <div className="agro-kpi-value">{MOCK_KPI.fertilizers} т</div>
            <div className="agro-kpi-label">Объём удобрений</div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="agro-card" style={{ marginBottom: 0 }}>
            <div className="agro-kpi-value">₸ {MOCK_KPI.subsidies}</div>
            <div className="agro-kpi-label">Субсидии</div>
          </div>
        </Col>
      </Row>

      {/* AI Recommendations */}
      <div className="agro-card" style={{ marginTop: 24, background: '#f0fdf4', borderColor: '#bbf7d0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -20, top: -20, opacity: 0.1, pointerEvents: 'none' }}>
           <RobotOutlined style={{ fontSize: 180, color: '#16a34a' }} />
        </div>
        <Title level={4} style={{ marginTop: 0, marginBottom: 16, color: '#166534', display: 'flex', alignItems: 'center' }}>
          <RobotOutlined style={{ marginRight: 8, fontSize: 24, color: '#22c55e' }} />
          Анализ и рекомендации модуля ИИ
        </Title>
        <Typography.Paragraph style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 0, position: 'relative', zIndex: 1 }}>
          <Text strong style={{ color: '#15803d' }}>Инсайт:</Text> Алгоритмы зафиксировали отклонение эффективности применения сульфата аммония на 12% ниже нормы на участках Северного региона. <br />
          Причина: несоответствие периодов опрыскивания текущим микроклиматическим изменениям.
          <br /><br />
          <Text strong style={{ color: '#15803d' }}>Рекомендация:</Text> Заменить 30% объема на <Text copyable>Карбамид (Марка Б)</Text> и сдвинуть обработку на вторую декаду мая. Ожидаемое повышение урожайности составит <strong>до +4 ц/га</strong>. Экономия бюджета с учетом субсидий: <strong>~2.4 млн ₸</strong>.
          <br />
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #bbf7d0' }}>
             <Button type="primary" size="small" style={{ background: '#16a34a' }} icon={<SyncOutlined />}>Применить в конструктор отчетов</Button>
             <Text type="secondary" style={{ marginLeft: 16, fontSize: 12 }}>
                * Текст сгенерирован LLM-моделью на основе базы ЭСФ (счета-фактуры) и исторических данных.
             </Text>
          </div>
        </Typography.Paragraph>
      </div>

      {/* General Map */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <div className="agro-card">
            <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Карта посевных площадей Казахстана</Title>
            <MapContainer center={[48.0, 68.0]} zoom={5} scrollWheelZoom={false}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {MOCK_MAP_DISTRICTS.map((poly, idx) => (
                <Polygon key={idx} pathOptions={{ color: '#1a7c3e', fillColor: '#1a7c3e', fillOpacity: 0.5 }} positions={poly.coordinates}>
                  <Popup>
                    <strong>{poly.name}</strong><br />
                    Площадь: {poly.area}<br />
                    Топ культура: {poly.topCrop}
                  </Popup>
                </Polygon>
              ))}
            </MapContainer>
          </div>
        </Col>
      </Row>

      {/* Role Gated Map */}
      {(role === 'employee' || role === 'admin') && (
        <Row gutter={[24, 24]}>
          <Col span={24}>
            <div className="agro-card">
              <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Детализация участков</Title>
              <MapContainer center={[52.5, 68.5]} zoom={7} scrollWheelZoom={false} style={{ height: 300, marginBottom: 24 }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {MOCK_MAP_DISTRICTS.filter(d => d.name.includes("Регион 1")).map((poly, idx) => (
                  <Polygon key={idx} pathOptions={{ color: '#fa8c16', fillColor: '#fa8c16', fillOpacity: 0.5 }} positions={poly.coordinates}>
                    <Popup>Детализация участков</Popup>
                  </Polygon>
                ))}
              </MapContainer>
              <Table 
                columns={formationColumns} 
                dataSource={formationData} 
                pagination={false}
                size="small"
                rowClassName={(record, index) => index % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
              />
            </div>
          </Col>
        </Row>
      )}

      {/* Top 10 Charts */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <div className="agro-card">
            <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Топ-10 удобрений (т)</Title>
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <BarChart data={MOCK_TOP_FERTILIZERS} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e8e8e8" />
                  <XAxis type="number" axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} style={{ fontSize: 11 }} />
                  <RechartsTooltip cursor={{ fill: 'rgba(26, 124, 62, 0.1)' }} />
                  <Bar dataKey="volume" fill="#1a7c3e" radius={[0, 4, 4, 0]} onClick={handleBarClick} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="agro-card">
            <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Топ-10 пестицидов (л)</Title>
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <BarChart data={MOCK_TOP_PESTICIDES} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e8e8e8" />
                  <XAxis type="number" axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} style={{ fontSize: 11 }} />
                  <RechartsTooltip cursor={{ fill: 'rgba(26, 124, 62, 0.1)' }} />
                  <Bar dataKey="volume" fill="#1a7c3e" radius={[0, 4, 4, 0]} onClick={handleBarClick} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>
      </Row>

      <Drawer
        title={`Детализация: ${selectedItem?.name || ''}`}
        placement="right"
        onClose={() => setDrillDownVisible(false)}
        open={drillDownVisible}
        width={400}
      >
        <Table 
          columns={drillDownColumns} 
          dataSource={drillDownData} 
          pagination={false}
          size="middle"
        />
      </Drawer>
    </div>
  );
};

export default Dashboard;
