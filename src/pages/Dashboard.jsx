import { useState, useEffect } from 'react';
import { Typography, Row, Col, Drawer, Table, Skeleton } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import { MOCK_KPI, MOCK_TOP_FERTILIZERS, MOCK_TOP_PESTICIDES, MOCK_MAP_DISTRICTS } from '../mock';

const { Title } = Typography;

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
    { key: '1', district: 'Акмолинский район', volume: Math.floor(selectedItem.volume * 0.4), area: 120000 },
    { key: '2', district: 'Атбасарский район', volume: Math.floor(selectedItem.volume * 0.35), area: 95000 },
    { key: '3', district: 'Зерендинский район', volume: Math.floor(selectedItem.volume * 0.25), area: 65000 },
  ] : [];

  const formationColumns = [
    { title: 'Участок', dataIndex: 'plot', key: 'plot' },
    { title: 'Площадь (га)', dataIndex: 'area', key: 'area' },
    { title: 'Пользователь', dataIndex: 'user', key: 'user' },
    { title: 'Назначение', dataIndex: 'purpose', key: 'purpose' },
  ];

  const formationData = [
    { key: '1', plot: 'Поле 104-А', area: 1200, user: 'ТОО Агро-Север', purpose: 'Посев зерновых' },
    { key: '2', plot: 'Поле 22-Б', area: 850, user: 'КХ Степное', purpose: 'Пастбища' },
    { key: '3', plot: 'Участок 05', area: 2100, user: 'ТОО Целина', purpose: 'Посев масличных' },
    { key: '4', plot: 'Поле 11-В', area: 400, user: 'ИП Иванов', purpose: 'Овощеводство' },
    { key: '5', plot: 'Участок 88', area: 3400, user: 'АО Акмола-Астык', purpose: 'Посев зерновых' },
  ];

  if (loading) {
    return <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 14 }} /></div>;
  }

  return (
    <div>
      <Title level={2} className="agro-page-title">Статистика региона</Title>

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
              <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Карта с землями сельхозформирований</Title>
              <MapContainer center={[52.5, 68.5]} zoom={7} scrollWheelZoom={false} style={{ height: 300, marginBottom: 24 }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {MOCK_MAP_DISTRICTS.filter(d => d.name.includes("Акмолинская")).map((poly, idx) => (
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
