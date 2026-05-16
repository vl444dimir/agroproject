import { useState, useEffect, useCallback } from 'react';
import { Typography, Table, Button, Modal, Form, Select, InputNumber, Input, Space, Tag, notification, Row, Spin, Alert, Descriptions, Collapse, Divider } from 'antd';
import { PlusOutlined, ReloadOutlined, EyeOutlined, WarningOutlined, CheckCircleOutlined, CloseCircleOutlined, ExperimentOutlined, FileExcelOutlined, BarChartOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { subsidiesApi } from '../api/subsidiesApi';
import { culturesApi } from '../api/culturesApi';
import { productsApi } from '../api/productsApi';
import { districtsApi } from '../api/districtsApi';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const DEMO_SUBSIDIES = [
  { id: 1, organizationName: 'ТОО "Агро-1"', districtName: 'Абайский', totalAmount: 480000, status: 'NEW', applicationDate: '2026-04-01T10:00:00', items: [{ cultureName: 'Пшеница', productName: 'Удобрение 1', cadastralNumber: '12-345-678-901', quantityUsed: 1200, uom: 'кг', calculatedSum: 480000 }] },
  { id: 2, organizationName: 'ТОО "Заря"', districtName: 'Нуринский', totalAmount: 925000, status: 'APPROVED', applicationDate: '2026-03-15T14:30:00', items: [{ cultureName: 'Пшеница', productName: 'Удобрение 2', cadastralNumber: '23-456-789-012', quantityUsed: 2500, uom: 'кг', calculatedSum: 925000 }] },
  { id: 3, organizationName: 'ТОО "Восток"', districtName: 'Бухар-Жырауский', totalAmount: 576000, status: 'REJECTED', applicationDate: '2026-02-20T09:15:00', items: [{ cultureName: 'Кукуруза', productName: 'Пестицид 1', cadastralNumber: '34-567-890-123', quantityUsed: 180, uom: 'л', calculatedSum: 576000 }] },
];

const FALLBACK_DISTRICTS = [
  { id: 1, name: 'Абайский' },
  { id: 2, name: 'Нуринский' },
  { id: 3, name: 'Бухар-Жырауский' },
  { id: 4, name: 'Каркаралинский' },
  { id: 5, name: 'Осакаровский' },
];

const FALLBACK_CULTURES = [
  { id: 1, name: 'Пшеница' },
  { id: 2, name: 'Ячмень' },
  { id: 3, name: 'Кукуруза' },
  { id: 4, name: 'Подсолнечник' },
  { id: 5, name: 'Рапс' },
];

const FALLBACK_PRODUCTS = [
  { id: 1, name: 'Удобрение 1', categoryName: 'Удобрение' },
  { id: 2, name: 'Удобрение 2', categoryName: 'Удобрение' },
  { id: 3, name: 'Пестицид 1', categoryName: 'Пестицид' },
  { id: 4, name: 'Пестицид 2', categoryName: 'Пестицид' },
];

const Subsidies = () => {
  const { role, user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(true);

  const [cultures, setCultures] = useState([]);
  const [products, setProducts] = useState([]);
  const [districts, setDistricts] = useState([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [exporting, setExporting] = useState(false);

  const handleExportFlat = async () => {
    setExporting(true);
    try {
      const res = await subsidiesApi.exportFlatExcel();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'subsidies-flat.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      notification.success({ message: 'Excel-отчёт (сводный) скачан' });
    } catch {
      notification.error({ message: 'Ошибка при выгрузке сводного отчёта' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportGrouped = async () => {
    setExporting(true);
    try {
      const res = await subsidiesApi.exportGroupedExcel();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'subsidies-grouped.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      notification.success({ message: 'Excel-отчёт (группировка) скачан' });
    } catch {
      notification.error({ message: 'Ошибка при выгрузке группированного отчёта' });
    } finally {
      setExporting(false);
    }
  };

  const fetchRefs = useCallback(async () => {
    try {
      const [cultRes, prodRes, distRes] = await Promise.all([
        culturesApi.getAll(),
        productsApi.getProducts(),
        districtsApi.getAll(),
      ]);
      setCultures(cultRes.data || []);
      setProducts(prodRes.data || []);
      setDistricts(distRes.data || []);
    } catch {
      setCultures(FALLBACK_CULTURES);
      setProducts(FALLBACK_PRODUCTS);
      setDistricts(FALLBACK_DISTRICTS);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await subsidiesApi.getAll();
      setData(response.data || []);
      setBackendAvailable(true);
    } catch {
      setBackendAvailable(false);
      setData(DEMO_SUBSIDIES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRefs();
    fetchData();
  }, [fetchRefs, fetchData]);

  const handleCreate = async (values) => {
    setCreating(true);
    try {
      const dto = {
        organizationId: user?.organizationId || 1,
        districtId: values.districtId,
        items: [
          {
            cultureId: values.cultureId,
            productId: values.productId,
            cadastralNumber: values.cadastralNumber || '',
            areaTreated: values.areaTreated || 0,
            quantityUsed: values.quantityUsed || 0,
            uom: values.uom || 'л',
          },
        ],
      };
      await subsidiesApi.create(dto);
      notification.success({ message: 'Заявка на субсидию создана' });
      setModalVisible(false);
      form.resetFields();
      fetchData();
    } catch {
      const districtName = districts.find(d => d.id === values.districtId)?.name || 'Неизвестно';
      const cultureName = cultures.find(c => c.id === values.cultureId)?.name || 'Неизвестно';
      const productName = products.find(p => p.id === values.productId)?.name || 'Неизвестно';
      const demoEntry = {
        id: Date.now(),
        organizationName: user?.organizationName || 'Моя организация',
        districtName,
        totalAmount: (values.quantityUsed || 0) * 400,
        status: 'NEW',
        applicationDate: new Date().toISOString(),
        items: [{ cultureName, productName, cadastralNumber: values.cadastralNumber || '', quantityUsed: values.quantityUsed || 0, uom: values.uom || 'л', calculatedSum: (values.quantityUsed || 0) * 400 }],
      };
      setData(prev => [demoEntry, ...prev]);
      notification.success({ message: 'Заявка добавлена локально (демо-режим)' });
      setModalVisible(false);
      form.resetFields();
    } finally {
      setCreating(false);
    }
  };

  const statusTag = (status) => {
    const map = {
      NEW: <Tag color="processing"><WarningOutlined /> Новая</Tag>,
      APPROVED: <Tag color="success"><CheckCircleOutlined /> Одобрена</Tag>,
      REJECTED: <Tag color="error"><CloseCircleOutlined /> Отклонена</Tag>,
      PAID: <Tag color="blue"><CheckCircleOutlined /> Выплачена</Tag>,
    };
    return map[status] || <Tag>{status}</Tag>;
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Организация', dataIndex: 'organizationName', key: 'organizationName', ellipsis: true },
    { title: 'Район', dataIndex: 'districtName', key: 'districtName', width: 140 },
    { title: 'Сумма (₸)', dataIndex: 'totalAmount', key: 'totalAmount', width: 140, render: v => v?.toLocaleString() || '—', sorter: (a, b) => (a.totalAmount || 0) - (b.totalAmount || 0) },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 130, render: statusTag },
    { title: 'Дата', dataIndex: 'applicationDate', key: 'applicationDate', width: 140, render: v => v ? new Date(v).toLocaleDateString('ru-RU') : '—' },
    {
      title: 'Детали',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelectedRow(record); setDetailVisible(true); }} />
      ),
    },
  ];

  const canCreate = role === 'admin' || role === 'staff' || role === 'employee';

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={2} className="agro-page-title" style={{ margin: 0 }}>Заявки на субсидии</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Обновить</Button>
          <Button icon={<FileExcelOutlined />} onClick={handleExportFlat} loading={exporting}>
            Выгрузить сводный
          </Button>
          <Button icon={<BarChartOutlined />} onClick={handleExportGrouped} loading={exporting}>
            Выгрузить с группировкой
          </Button>
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalVisible(true); }}>
              Новая заявка
            </Button>
          )}
        </Space>
      </Row>

      {!backendAvailable && (
        <Alert
          message="Бэкенд не запущен"
          description="Показаны демо-данные. Запустите Spring Boot для работы с реальными субсидиями."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div className="agro-card">
        <Table
          columns={columns}
          dataSource={data.map((r, i) => ({ ...r, key: r.id || i }))}
          loading={loading}
          size="middle"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: 'Нет заявок на субсидии' }}
          rowClassName={(r, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
          scroll={{ x: 900 }}
        />
      </div>

      <Modal
        title="Новая заявка на субсидию"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="districtId" label="Район" rules={[{ required: true, message: 'Выберите район' }]}>
            <Select placeholder="Выберите район" showSearch optionFilterProp="children" size="large">
              {districts.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
            </Select>
          </Form.Item>

          <Divider orientation="left" plain><ExperimentOutlined /> Позиция заявки</Divider>

          <Form.Item name="cultureId" label="Культура" rules={[{ required: true, message: 'Выберите культуру' }]}>
            <Select placeholder="Выберите культуру" showSearch optionFilterProp="children" size="large">
              {cultures.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item name="productId" label="Препарат" rules={[{ required: true, message: 'Выберите препарат' }]}>
            <Select placeholder="Выберите препарат" showSearch optionFilterProp="children" size="large">
              {products.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item name="cadastralNumber" label="Кадастровый номер">
            <Input placeholder="12-345-678-901" size="large" />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="areaTreated" label="Площадь (га)" rules={[{ required: true, message: 'Обязательно' }]} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="450" size="large" />
            </Form.Item>
            <Form.Item name="quantityUsed" label="Объём" rules={[{ required: true, message: 'Обязательно' }]} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="1200" size="large" />
            </Form.Item>
            <Form.Item name="uom" label="Ед. изм." rules={[{ required: true, message: 'Выберите' }]} style={{ width: 100 }}>
              <Select size="large">
                <Option value="л">л</Option>
                <Option value="кг">кг</Option>
                <Option value="т">т</Option>
              </Select>
            </Form.Item>
          </Space>

          <Button type="primary" htmlType="submit" block size="large" loading={creating} style={{ marginTop: 16 }}>
            Отправить заявку
          </Button>
        </Form>
      </Modal>

      <Modal
        title={`Детали заявки #${selectedRow?.id || ''}`}
        open={detailVisible}
        onCancel={() => { setDetailVisible(false); setSelectedRow(null); }}
        footer={null}
        width={700}
        destroyOnClose
      >
        {selectedRow && (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Организация">{selectedRow.organizationName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Район">{selectedRow.districtName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Статус">{statusTag(selectedRow.status)}</Descriptions.Item>
              <Descriptions.Item label="Общая сумма">{selectedRow.totalAmount?.toLocaleString()} ₸</Descriptions.Item>
              <Descriptions.Item label="Дата подачи" span={2}>{selectedRow.applicationDate ? new Date(selectedRow.applicationDate).toLocaleString('ru-RU') : '—'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Позиции</Divider>

            {selectedRow.items?.length > 0 ? (
              <Table
                dataSource={selectedRow.items.map((item, i) => ({ ...item, key: i }))}
                columns={[
                  { title: 'Культура', dataIndex: 'cultureName', key: 'cultureName' },
                  { title: 'Препарат', dataIndex: 'productName', key: 'productName' },
                  { title: 'Кадастр', dataIndex: 'cadastralNumber', key: 'cadastralNumber' },
                  { title: 'Объём', key: 'volume', render: (_, r) => `${r.quantityUsed} ${r.uom}` },
                  { title: 'Сумма (₸)', dataIndex: 'calculatedSum', key: 'calculatedSum', render: v => v?.toLocaleString() || '—' },
                ]}
                pagination={false}
                size="small"
              />
            ) : (
              <Text type="secondary">Нет позиций</Text>
            )}

            {selectedRow.items?.some(i => i.risk) && (
              <Alert
                message="Обнаружены риски"
                description={selectedRow.items.filter(i => i.risk).map(i => i.riskComment).join('; ')}
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default Subsidies;
