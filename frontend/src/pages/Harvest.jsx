import { useState, useEffect, useCallback } from 'react';
import { Typography, Row, Col, Table, Button, Modal, Form, Select, InputNumber, DatePicker, Space, Tag, notification } from 'antd';
import { PlusOutlined, ReloadOutlined, BarChartOutlined, TableOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { harvestApi } from '../api/harvestApi';
import { culturesApi } from '../api/culturesApi';
import { districtsApi } from '../api/districtsApi';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

const FALLBACK_DISTRICTS = [
  { id: 1, name: 'Абайский' },
  { id: 2, name: 'Нуринский' },
  { id: 3, name: 'Бухар-Жырауский' },
  { id: 4, name: 'Каркаралинский' },
  { id: 5, name: 'Осакаровский' },
];

const Harvest = () => {
  const { role, user } = useAuth();
  const [data, setData] = useState([]);
  const [cultures, setCultures] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [districtFilter, setDistrictFilter] = useState(null);
  const [viewMode, setViewMode] = useState('table');

  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await harvestApi.getAllRecords(districtFilter);
      setData(response.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [districtFilter]);

  const fetchCultures = useCallback(async () => {
    try {
      const response = await culturesApi.getAll();
      setCultures(response.data || []);
    } catch {
      setCultures([]);
    }
  }, []);

  const fetchDistricts = useCallback(async () => {
    try {
      const response = await districtsApi.getAll();
      setDistricts(response.data || []);
    } catch {
      setDistricts(FALLBACK_DISTRICTS);
    }
  }, []);

  useEffect(() => {
    fetchCultures();
    fetchDistricts();
  }, [fetchCultures, fetchDistricts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (values) => {
    try {
      const dto = {
        organizationId: user?.organizationId || null,
        districtId: values.districtId,
        cultureId: values.cultureId,
        harvestYear: values.harvestYear,
        area: values.area,
        yield: values.yield,
        totalHarvest: values.area * values.yield,
      };
      await harvestApi.createOrUpdateRecord(dto);
      notification.success({ message: 'Запись урожая добавлена' });
      setModalVisible(false);
      form.resetFields();
      fetchData();
    } catch {
      // handled globally
    }
  };

  const columns = [
    { title: 'Район', dataIndex: 'districtName', key: 'districtName', sorter: (a, b) => (a.districtName || '').localeCompare(b.districtName || '') },
    { title: 'Культура', dataIndex: 'cultureName', key: 'cultureName', sorter: (a, b) => (a.cultureName || '').localeCompare(b.cultureName || '') },
    { title: 'Год', dataIndex: 'harvestYear', key: 'harvestYear', sorter: (a, b) => a.harvestYear - b.harvestYear },
    { title: 'Площадь (га)', dataIndex: 'area', key: 'area', render: v => v?.toLocaleString() || '—' },
    { title: 'Урожайность (ц/га)', dataIndex: 'yield', key: 'yield', render: v => v != null ? v.toFixed(1) : '—', sorter: (a, b) => (a.yield || 0) - (b.yield || 0) },
    { title: 'Всего (ц)', dataIndex: 'totalHarvest', key: 'totalHarvest', render: v => v?.toLocaleString() || '—' },
    {
      title: 'Субсидируется',
      dataIndex: 'subsidized',
      key: 'subsidized',
      render: v => v ? <Tag color="green">Да</Tag> : <Tag>Нет</Tag>,
    },
  ];

  const chartData = (() => {
    const yearsSet = new Set();
    const districtsSet = new Set();
    data.forEach(r => {
      yearsSet.add(r.harvestYear);
      districtsSet.add(r.districtName);
    });
    const years = Array.from(yearsSet).sort();
    const districtNames = Array.from(districtsSet);
    return years.map(y => {
      const point = { year: y };
      districtNames.forEach(d => {
        const rows = data.filter(r => r.harvestYear === y && r.districtName === d);
        if (rows.length > 0) {
          point[d] = parseFloat((rows.reduce((sum, r) => sum + (r.yield || 0), 0) / rows.length).toFixed(2));
        } else {
          point[d] = null;
        }
      });
      return point;
    });
  })();

  const chartColors = ['#1a7c3e', '#fa8c16', '#1890ff', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96'];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={2} className="agro-page-title" style={{ margin: 0 }}>Учёт урожая</Title>
        <Space>
          <Button
            icon={viewMode === 'table' ? <BarChartOutlined /> : <TableOutlined />}
            onClick={() => setViewMode(viewMode === 'table' ? 'chart' : 'table')}
          >
            {viewMode === 'table' ? 'График' : 'Таблица'}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Обновить</Button>
          {(role === 'admin' || role === 'staff' || role === 'employee') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalVisible(true); }}>
              Добавить запись
            </Button>
          )}
        </Space>
      </Row>

      <div className="agro-card" style={{ marginBottom: 24 }}>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="Фильтр по району"
            allowClear
            style={{ width: 200 }}
            onChange={v => setDistrictFilter(v || null)}
            value={districtFilter}
          >
            {districts.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
          </Select>
          <Text type="secondary">Всего записей: {data.length}</Text>
        </Space>

        {viewMode === 'table' ? (
          <Table
            columns={columns}
            dataSource={data.map((r, i) => ({ ...r, key: r.id || i }))}
            size="middle"
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            locale={{ emptyText: 'Нет данных об урожае. Добавьте первую запись.' }}
            rowClassName={(r, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
            scroll={{ x: 900 }}
          />
        ) : (
          <div style={{ width: '100%', height: 400 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {Object.keys(chartData[0]).filter(k => k !== 'year').map((district, idx) => (
                    <Line
                      key={district}
                      type="monotone"
                      dataKey={district}
                      stroke={chartColors[idx % chartColors.length]}
                      strokeWidth={2}
                      activeDot={{ r: 8 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', paddingTop: 80 }}>
                <Text type="secondary">Нет данных для графика</Text>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        title="Добавить запись урожая"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="districtId" label="Район" rules={[{ required: true, message: 'Выберите район' }]}>
            <Select placeholder="Выберите район" showSearch optionFilterProp="children">
            {districts.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="cultureId" label="Культура" rules={[{ required: true, message: 'Выберите культуру' }]}>
            <Select placeholder="Выберите культуру" showSearch optionFilterProp="children">
              {cultures.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="harvestYear" label="Год урожая" rules={[{ required: true, message: 'Укажите год' }]}>
            <Select placeholder="Выберите год">
              {[2026, 2025, 2024, 2023, 2022].map(y => <Option key={y} value={y}>{y}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="area" label="Площадь (га)" rules={[{ required: true, message: 'Укажите площадь' }]}>
            <InputNumber style={{ width: '100%' }} min={0} placeholder="Например: 45000" />
          </Form.Item>
          <Form.Item name="yield" label="Урожайность (ц/га)" rules={[{ required: true, message: 'Укажите урожайность' }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="Например: 22.5" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">
            Сохранить
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default Harvest;
