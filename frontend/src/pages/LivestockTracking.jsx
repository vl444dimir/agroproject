import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select,
  Space, Tag, Typography, Row, Col, Popconfirm, message, Empty, Spin,
  Upload, Steps, Alert, Progress, notification, Radio
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  LineChartOutlined, TableOutlined, ReloadOutlined,
  UploadOutlined, FileExcelOutlined, InboxOutlined,
  CheckCircleOutlined, WarningOutlined
} from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart
} from 'recharts';
import * as XLSX from 'xlsx';
import { livestockApi } from '../api/livestockApi';
import { importApi } from '../api/importApi';

const { Title, Text } = Typography;
const { Option } = Select;

/* ── Premium color palette for chart lines ── */
const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#e11d48', '#7c3aed', '#0ea5e9', '#d946ef', '#22c55e',
];

const LivestockTracking = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [activeView, setActiveView] = useState('table'); // 'table' | 'chart'
  const [selectedEnterprises, setSelectedEnterprises] = useState([]);
  const [form] = Form.useForm();

  /* ── Excel Import state ── */
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState(0); // 0=upload, 1=mapping, 2=importing, 3=result
  const [importFile, setImportFile] = useState(null);
  const [importHeaders, setImportHeaders] = useState([]);
  const [importPreviewRows, setImportPreviewRows] = useState([]);
  const [importMapping, setImportMapping] = useState({});
  const [importStrategy, setImportStrategy] = useState('SKIP');
  const [importProgress, setImportProgress] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  /* ── Livestock DB field definitions for mapping ── */
  const LIVESTOCK_FIELDS = [
    { name: 'enterpriseName', label: 'Предприятие', required: true },
    { name: 'region', label: 'Область', required: true },
    { name: 'district', label: 'Район', required: true },
    { name: 'livestockCount', label: 'Поголовье скота', required: true },
    { name: 'period', label: 'Период', required: true },
  ];

  /* ── Load data ── */
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await livestockApi.getAll();
      setRecords(res.data || []);
    } catch {
      // error notification handled by backendClient interceptor
    } finally {
      setLoading(false);
    }
  };

  /* ── Excel Import handlers ── */
  const handleImportFileSelect = useCallback((fileObj) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (json.length === 0) {
          message.warning('Файл пустой');
          return;
        }
        const hdrs = json[0].map(h => String(h).trim()).filter(Boolean);
        setImportHeaders(hdrs);
        setImportPreviewRows(json.slice(1, 6).map((row, idx) => {
          const obj = { _key: idx };
          hdrs.forEach((h, i) => { obj[h] = row[i] ?? ''; });
          return obj;
        }));
        setImportFile(fileObj);
        // Auto-map columns
        const autoMapping = {};
        LIVESTOCK_FIELDS.forEach(field => {
          const fl = field.label.toLowerCase();
          const fn = field.name.toLowerCase();
          const match = hdrs.find(h => {
            const hl = h.toLowerCase().trim();
            return hl === fl || hl === fn || hl.includes(fl) || fl.includes(hl);
          });
          if (match) autoMapping[field.name] = match;
        });
        setImportMapping(autoMapping);
        setImportStep(1);
        message.success(`Файл «${fileObj.name}» прочитан: ${hdrs.length} колонок, ~${json.length - 1} строк`);
      } catch {
        message.error('Не удалось прочитать файл');
      }
    };
    reader.readAsArrayBuffer(fileObj);
  }, []);

  const executeImport = useCallback(async () => {
    setImporting(true);
    setImportStep(2);
    try {
      const res = await importApi.execute('livestock', importFile, importMapping, importStrategy, {});
      setImportResult(res.data);
      setImportStep(3);
      fetchRecords();
    } catch {
      message.error('Ошибка при импорте');
      setImportStep(1);
    } finally {
      setImporting(false);
    }
  }, [importFile, importMapping, importStrategy]);

  const resetImport = () => {
    setImportStep(0);
    setImportFile(null);
    setImportHeaders([]);
    setImportPreviewRows([]);
    setImportMapping({});
    setImportResult(null);
    setImportStrategy('SKIP');
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    resetImport();
  };

  const canImport = LIVESTOCK_FIELDS.filter(f => f.required).every(f => importMapping[f.name]);

  useEffect(() => { fetchRecords(); }, []);

  /* ── Derived unique values for filters ── */
  const uniqueEnterprises = useMemo(() => [...new Set(records.map(r => r.enterpriseName))].sort(), [records]);
  const uniqueRegions = useMemo(() => [...new Set(records.map(r => r.region))].sort(), [records]);
  const uniqueDistricts = useMemo(() => [...new Set(records.map(r => r.district))].sort(), [records]);
  const uniquePeriods = useMemo(() => [...new Set(records.map(r => r.period))].sort(), [records]);

  /* ── Auto-select first 5 enterprises for chart ── */
  useEffect(() => {
    if (uniqueEnterprises.length > 0 && selectedEnterprises.length === 0) {
      setSelectedEnterprises(uniqueEnterprises.slice(0, 5));
    }
  }, [uniqueEnterprises]);

  /* ── Chart data transformation ── */
  const chartData = useMemo(() => {
    const targetEnterprises = selectedEnterprises.length > 0 ? selectedEnterprises : uniqueEnterprises.slice(0, 5);
    const periodMap = {};

    records
      .filter(r => targetEnterprises.includes(r.enterpriseName))
      .forEach(r => {
        if (!periodMap[r.period]) {
          periodMap[r.period] = { period: r.period };
        }
        periodMap[r.period][r.enterpriseName] = r.livestockCount;
      });

    return Object.values(periodMap).sort((a, b) => a.period.localeCompare(b.period));
  }, [records, selectedEnterprises, uniqueEnterprises]);

  /* ── CRUD handlers ── */
  const handleCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await livestockApi.delete(id);
      message.success('Запись удалена');
      fetchRecords();
    } catch {
      // handled by interceptor
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await livestockApi.update(editingRecord.id, values);
        message.success('Запись обновлена');
      } else {
        await livestockApi.create(values);
        message.success('Запись добавлена');
      }
      setModalOpen(false);
      form.resetFields();
      fetchRecords();
    } catch {
      // validation or network error
    }
  };

  /* ── Table columns ── */
  const columns = [
    {
      title: 'Предприятие',
      dataIndex: 'enterpriseName',
      key: 'enterpriseName',
      sorter: (a, b) => a.enterpriseName.localeCompare(b.enterpriseName),
      filters: uniqueEnterprises.map(e => ({ text: e, value: e })),
      onFilter: (value, record) => record.enterpriseName === value,
      render: (text) => <Text strong style={{ color: '#6366f1' }}>{text}</Text>,
    },
    {
      title: 'Область',
      dataIndex: 'region',
      key: 'region',
      sorter: (a, b) => a.region.localeCompare(b.region),
      filters: uniqueRegions.map(r => ({ text: r, value: r })),
      onFilter: (value, record) => record.region === value,
      render: (text) => <Tag color="cyan">{text}</Tag>,
    },
    {
      title: 'Район',
      dataIndex: 'district',
      key: 'district',
      sorter: (a, b) => a.district.localeCompare(b.district),
      filters: uniqueDistricts.map(d => ({ text: d, value: d })),
      onFilter: (value, record) => record.district === value,
      render: (text) => <Tag color="geekblue">{text}</Tag>,
    },
    {
      title: 'Поголовье скота',
      dataIndex: 'livestockCount',
      key: 'livestockCount',
      sorter: (a, b) => a.livestockCount - b.livestockCount,
      render: (val) => (
        <Text strong style={{ fontSize: 15 }}>
          {val?.toLocaleString('ru-RU')} <span style={{ color: '#8b8b8b', fontWeight: 400, fontSize: 12 }}>голов</span>
        </Text>
      ),
    },
    {
      title: 'Период',
      dataIndex: 'period',
      key: 'period',
      sorter: (a, b) => a.period.localeCompare(b.period),
      filters: uniquePeriods.map(p => ({ text: p, value: p })),
      onFilter: (value, record) => record.period === value,
      render: (text) => <Tag color="purple">{text}</Tag>,
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Удалить эту запись?" onConfirm={() => handleDelete(record.id)} okText="Да" cancelText="Нет">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /* ── Custom chart tooltip ── */
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: 12,
        padding: '12px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <p style={{ color: '#e2e8f0', margin: 0, fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
          📅 Период: {label}
        </p>
        {payload.map((entry, idx) => (
          <p key={idx} style={{ color: entry.color, margin: '4px 0', fontSize: 12 }}>
            🐄 {entry.name}: <strong>{Number(entry.value).toLocaleString('ru-RU')}</strong> голов
          </p>
        ))}
      </div>
    );
  };

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <Title level={3} style={{ margin: 0, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🐄 Поголовье скота
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Отслеживание изменений поголовья скота по предприятиям, областям и районам
          </Text>
        </div>
        <Space>
          <Button
            icon={activeView === 'table' ? <LineChartOutlined /> : <TableOutlined />}
            onClick={() => setActiveView(activeView === 'table' ? 'chart' : 'table')}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              color: '#fff', border: 'none', borderRadius: 8,
            }}
          >
            {activeView === 'table' ? 'График' : 'Таблица'}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchRecords} style={{ borderRadius: 8 }}>
            Обновить
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setImportModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff', border: 'none', borderRadius: 8,
            }}
          >
            Импорт из Excel
          </Button>
          <Button
            type="primary" icon={<PlusOutlined />} onClick={handleCreate}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none', borderRadius: 8,
            }}
          >
            Добавить запись
          </Button>
        </Space>
      </div>

      {/* Content */}
      {activeView === 'table' ? (
        <Card
          style={{
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            border: '1px solid rgba(99, 102, 241, 0.1)',
          }}
          bodyStyle={{ padding: 0 }}
        >
          <Table
            columns={columns}
            dataSource={records}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              pageSizeOptions: ['10', '15', '25', '50'],
              showTotal: (total) => `Всего записей: ${total}`,
            }}
            locale={{ emptyText: <Empty description="Нет данных. Добавьте первую запись о поголовье скота." /> }}
            scroll={{ x: 800 }}
            style={{ borderRadius: 16, overflow: 'hidden' }}
          />
        </Card>
      ) : (
        <Card
          style={{
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            border: '1px solid rgba(99, 102, 241, 0.1)',
          }}
        >
          {/* Chart enterprise filter */}
          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col span={24}>
              <Text strong style={{ display: 'block', marginBottom: 8, color: '#64748b' }}>
                Выберите предприятия для графика:
              </Text>
              <Select
                mode="multiple"
                allowClear
                placeholder="Выберите предприятия..."
                value={selectedEnterprises}
                onChange={setSelectedEnterprises}
                maxTagCount="responsive"
                style={{ width: '100%' }}
              >
                {uniqueEnterprises.map(e => <Option key={e} value={e}>{e}</Option>)}
              </Select>
            </Col>
          </Row>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={480}>
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <defs>
                  {(selectedEnterprises.length > 0 ? selectedEnterprises : uniqueEnterprises.slice(0, 5)).map((ent, idx) => (
                    <linearGradient key={ent} id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[idx % CHART_COLORS.length]} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={CHART_COLORS[idx % CHART_COLORS.length]} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis
                  dataKey="period"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}к` : v}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
                  iconType="circle"
                />
                {(selectedEnterprises.length > 0 ? selectedEnterprises : uniqueEnterprises.slice(0, 5)).map((ent, idx) => (
                  <Area
                    key={ent}
                    type="monotone"
                    dataKey={ent}
                    name={ent}
                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                    strokeWidth={2.5}
                    fill={`url(#grad-${idx})`}
                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 2 }}
                    connectNulls
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Empty description="Нет данных для построения графика. Добавьте записи о поголовье." />
          )}
        </Card>
      )}

      {/* Add / Edit Modal */}
      <Modal
        title={editingRecord ? '✏️ Редактировать запись' : '➕ Новая запись о поголовье'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={handleSubmit}
        okText={editingRecord ? 'Сохранить' : 'Добавить'}
        cancelText="Отмена"
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="enterpriseName"
            label="Предприятие"
            rules={[{ required: true, message: 'Введите название предприятия' }]}
          >
            <Input placeholder='Например: ТОО "Агрофирма Родина"' />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="region"
                label="Область"
                rules={[{ required: true, message: 'Введите область' }]}
              >
                <Input placeholder="Например: Костанайская" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="district"
                label="Район"
                rules={[{ required: true, message: 'Введите район' }]}
              >
                <Input placeholder="Например: Карасуский" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="livestockCount"
                label="Поголовье скота (голов)"
                rules={[{ required: true, message: 'Введите количество' }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="1500"
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                  parser={(value) => value.replace(/\s/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="period"
                label="Период"
                rules={[{ required: true, message: 'Введите период' }]}
              >
                <Input placeholder="Например: 2024-Q1 или 2024-01" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Excel Import Modal */}
      <Modal
        title="📥 Импорт поголовья скота из Excel"
        open={importModalOpen}
        onCancel={closeImportModal}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Steps
          current={importStep}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: 'Загрузка' },
            { title: 'Маппинг' },
            { title: 'Импорт' },
            { title: 'Результат' },
          ]}
        />

        {/* Step 0: Upload */}
        {importStep === 0 && (
          <div
            style={{
              border: '2px dashed #d9d9d9', borderRadius: 12, padding: 40,
              textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.3s',
            }}
            onClick={() => document.getElementById('livestock-import-input').click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#6366f1'; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = '#d9d9d9'; }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#d9d9d9';
              if (e.dataTransfer.files[0]) handleImportFileSelect(e.dataTransfer.files[0]);
            }}
          >
            <InboxOutlined style={{ fontSize: 48, color: '#6366f1', marginBottom: 12 }} />
            <div><Text strong style={{ fontSize: 15 }}>Перетащите Excel-файл сюда</Text></div>
            <div><Text type="secondary">или нажмите для выбора (.xlsx, .xls, .csv)</Text></div>
            <div style={{ marginTop: 16 }}>
              <Alert
                type="info"
                showIcon
                message="Ожидаемые колонки: Предприятие, Область, Район, Поголовье скота, Период"
                style={{ textAlign: 'left' }}
              />
            </div>
            <input
              id="livestock-import-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files[0]) handleImportFileSelect(e.target.files[0]); }}
            />
          </div>
        )}

        {/* Step 1: Mapping + Preview */}
        {importStep === 1 && (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <FileExcelOutlined style={{ fontSize: 22, color: '#1a7c3e' }} />
              <Text strong>{importFile?.name}</Text>
              <Tag color="blue">{importHeaders.length} колонок</Tag>
            </div>

            <Text strong style={{ display: 'block', marginBottom: 8 }}>Сопоставление колонок:</Text>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', width: '40%' }}>Поле</th>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>Колонка из Excel</th>
                </tr>
              </thead>
              <tbody>
                {LIVESTOCK_FIELDS.map(field => (
                  <tr key={field.name} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '6px 0' }}>
                      {field.required && <span style={{ color: '#ef4444', marginRight: 4 }}>*</span>}
                      {field.label}
                      {importMapping[field.name] && (
                        <Tag color="green" style={{ marginLeft: 6, fontSize: 10 }}>авто</Tag>
                      )}
                    </td>
                    <td style={{ padding: '6px 0' }}>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="— не выбрано —"
                        allowClear
                        showSearch
                        value={importMapping[field.name] || undefined}
                        onChange={(val) => setImportMapping(prev => {
                          const next = { ...prev };
                          if (val) next[field.name] = val;
                          else delete next[field.name];
                          return next;
                        })}
                        options={importHeaders.map(h => ({ value: h, label: h }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Text strong style={{ display: 'block', marginBottom: 8 }}>При совпадении данных:</Text>
            <Radio.Group value={importStrategy} onChange={(e) => setImportStrategy(e.target.value)} style={{ marginBottom: 16 }}>
              <Space direction="vertical">
                <Radio value="SKIP">Пропускать дубликаты</Radio>
                <Radio value="UPDATE">Обновлять существующие</Radio>
              </Space>
            </Radio.Group>

            {importPreviewRows.length > 0 && (
              <>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Предпросмотр (первые {importPreviewRows.length} строк):</Text>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={importPreviewRows}
                  rowKey="_key"
                  scroll={{ x: true }}
                  columns={LIVESTOCK_FIELDS.filter(f => importMapping[f.name]).map(f => ({
                    title: <span>{f.label}<br /><Text type="secondary" style={{ fontSize: 10 }}>← {importMapping[f.name]}</Text></span>,
                    dataIndex: importMapping[f.name],
                    key: f.name,
                    ellipsis: true,
                  }))}
                />
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <Button onClick={() => { resetImport(); }}>Назад</Button>
              <Button
                type="primary"
                disabled={!canImport}
                loading={importing}
                onClick={executeImport}
                icon={<UploadOutlined />}
                style={{
                  background: canImport ? 'linear-gradient(135deg, #10b981, #059669)' : undefined,
                  border: 'none', borderRadius: 8,
                }}
              >
                Импортировать
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Importing */}
        {importStep === 2 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" tip="Импортируем данные..." />
          </div>
        )}

        {/* Step 3: Result */}
        {importStep === 3 && importResult && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 56, color: '#10b981', marginBottom: 16 }} />
            <Title level={4} style={{ margin: '0 0 8px' }}>Импорт завершён!</Title>
            <Space size="large" style={{ marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>{importResult.imported ?? 0}</div>
                <Text type="secondary">Импортировано</Text>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{importResult.skipped ?? 0}</div>
                <Text type="secondary">Пропущено</Text>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{importResult.errors ?? 0}</div>
                <Text type="secondary">Ошибок</Text>
              </div>
            </Space>
            {importResult.errorDetails?.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message={`${importResult.errorDetails.length} строк с ошибками`}
                description={importResult.errorDetails.slice(0, 5).map(e => `Строка ${e.row}: ${e.message}`).join('\n')}
                style={{ textAlign: 'left', marginBottom: 16 }}
              />
            )}
            <div>
              <Button type="primary" onClick={closeImportModal} style={{ borderRadius: 8 }}>
                Закрыть
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LivestockTracking;
