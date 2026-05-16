import { useState, useEffect, useCallback } from 'react';
import {
  Typography, Row, Alert, Steps, Button, Select, Upload, Table,
  Card, Tag, Space, notification, Modal, Divider, Descriptions,
  InputNumber, Radio, Spin, Collapse, Empty, Flex, Progress
} from 'antd';
import {
  InboxOutlined, UploadOutlined, SettingOutlined,
  AuditOutlined, PlayCircleOutlined, CheckCircleOutlined,
  CloseCircleOutlined, WarningOutlined, ReloadOutlined,
  ExperimentOutlined, FileExcelOutlined
} from '@ant-design/icons';
import { importApi } from '../api/importApi';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { Panel } = Collapse;

const DEMO_ENTITIES = [
  { entity: 'category', displayName: 'Категории', fields: [
    { name: 'name', label: 'Название', type: 'string', required: true, businessKey: true },
  ]},
  { entity: 'culture', displayName: 'Культуры', fields: [
    { name: 'name', label: 'Название культуры', type: 'string', required: true, businessKey: true },
  ]},
  { entity: 'manufacturer', displayName: 'Производители', fields: [
    { name: 'name', label: 'Наименование', type: 'string', required: true, businessKey: true },
    { name: 'country', label: 'Страна', type: 'string', required: false, businessKey: false },
  ]},
  { entity: 'ingredient', displayName: 'Действующие вещества', fields: [
    { name: 'name', label: 'Название ДВ', type: 'string', required: true, businessKey: true },
  ]},
  { entity: 'district', displayName: 'Районы', fields: [
    { name: 'name', label: 'Название', type: 'string', required: true, businessKey: true },
  ]},
  { entity: 'organization', displayName: 'Организации', fields: [
    { name: 'name', label: 'Наименование', type: 'string', required: true, businessKey: true },
    { name: 'district', label: 'Район', type: 'string', required: true, businessKey: false, lookupEntity: 'district', lookupField: 'name' },
  ]},
  { entity: 'product', displayName: 'Препараты', fields: [
    { name: 'name', label: 'Название', type: 'string', required: true, businessKey: true },
    { name: 'category', label: 'Категория', type: 'string', required: true, businessKey: false, lookupEntity: 'category', lookupField: 'name' },
    { name: 'manufacturer', label: 'Производитель', type: 'string', required: true, businessKey: false, lookupEntity: 'manufacturer', lookupField: 'name' },
  ]},
];

const STRATEGY_LABELS = {
  SKIP: 'Пропускать дубликаты',
  UPDATE: 'Обновить существующие',
  REPLACE_ALL: 'Заменить все данные',
};

const Import = () => {
  const [step, setStep] = useState(0);
  const [backendAvailable, setBackendAvailable] = useState(true);

  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [entityMeta, setEntityMeta] = useState(null);

  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [preview, setPreview] = useState([]);
  const [parsing, setParsing] = useState(false);

  const [mapping, setMapping] = useState({});

  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [strategy, setStrategy] = useState('SKIP');
  const [rowDecisions, setRowDecisions] = useState({});
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState(null);

  const fetchEntities = useCallback(async () => {
    try {
      const res = await importApi.getEntities();
      const data = res.data || [];
      setEntities(data);
      setBackendAvailable(true);
    } catch {
      setBackendAvailable(false);
      setEntities(DEMO_ENTITIES);
    }
  }, []);

  useEffect(() => { fetchEntities(); }, [fetchEntities]);

  const handleEntitySelect = async (entityName) => {
    setSelectedEntity(entityName);
    setStep(0);
    setFile(null);
    setHeaders([]);
    setPreview([]);
    setMapping({});
    setAnalyzeResult(null);
    setExecuteResult(null);
    setStrategy('SKIP');
    setRowDecisions({});

    const cached = entities.find(e => e.entity === entityName);
    if (cached?.fields) {
      setEntityMeta(cached);
      return;
    }
    try {
      const res = await importApi.getMetadata(entityName);
      setEntityMeta(res.data);
    } catch {
      setEntityMeta(cached || null);
    }
  };

  const handleFileUpload = async (uploadedFile) => {
    setFile(uploadedFile);
    setParsing(true);
    setPreview([]);
    setHeaders([]);
    setMapping({});
    setAnalyzeResult(null);
    setExecuteResult(null);

    try {
      const res = await importApi.parseFile(uploadedFile);
      const { headers: h, preview: p } = res.data;
      setHeaders(h || []);
      setPreview(p || []);

      if (entityMeta?.fields && h?.length) {
        const auto = {};
        entityMeta.fields.forEach(f => {
          const match = h.find(col =>
            col.toLowerCase().includes(f.label.toLowerCase()) ||
            f.label.toLowerCase().includes(col.toLowerCase()) ||
            col.toLowerCase() === f.name.toLowerCase()
          );
          if (match) auto[f.name] = match;
        });
        setMapping(auto);
      }

      notification.success({ message: 'Файл загружен', description: `Найдено колонок: ${h?.length || 0}` });
      setStep(1);
    } catch (e) {
      const msg = e.response?.data?.error || 'Ошибка чтения файла';
      notification.error({ message: 'Ошибка', description: msg });
    } finally {
      setParsing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file || !selectedEntity) return;
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const res = await importApi.analyze(selectedEntity, file, mapping);
      setAnalyzeResult(res.data);
      setStep(2);
    } catch (e) {
      notification.error({ message: 'Ошибка анализа', description: e.response?.data?.error || e.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecute = async () => {
    if (!file || !selectedEntity) return;
    setExecuting(true);
    setExecuteResult(null);
    try {
      const request = { mapping, strategy, rowDecisions };
      const res = await importApi.execute(selectedEntity, file, request);
      setExecuteResult(res.data);
      setStep(3);
    } catch (e) {
      notification.error({ message: 'Ошибка импорта', description: e.response?.data?.error || e.message });
    } finally {
      setExecuting(false);
    }
  };

  const resetAll = () => {
    setStep(0);
    setFile(null);
    setHeaders([]);
    setPreview([]);
    setMapping({});
    setAnalyzeResult(null);
    setExecuteResult(null);
    setStrategy('SKIP');
    setRowDecisions({});
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

  const renderStep0 = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {!backendAvailable && (
        <Alert
          message="Бэкенд не запущен"
          description="Показаны демо-сущности. Запустите Spring Boot для реальной работы."
          type="warning" showIcon style={{ marginBottom: 8 }}
        />
      )}
      <Card title={<><ExperimentOutlined /> Выберите сущность для импорта</>}>
        <Select
          style={{ width: '100%' }}
          size="large"
          placeholder="Выберите справочник..."
          value={selectedEntity}
          onChange={handleEntitySelect}
          options={entities.map(e => ({
            label: <Space><FileExcelOutlined />{e.displayName} <Text type="secondary">({e.entity})</Text></Space>,
            value: e.entity,
          }))}
        />
        {entityMeta && (
          <div style={{ marginTop: 16 }}>
            <Text strong>Поля сущности:</Text>
            <Table
              dataSource={entityMeta.fields.map((f, i) => ({ ...f, key: i }))}
              columns={[
                { title: 'Поле', dataIndex: 'name', key: 'name', width: 120 },
                { title: 'Описание', dataIndex: 'label', key: 'label' },
                { title: 'Тип', dataIndex: 'type', key: 'type', width: 80, render: v => <Tag>{v}</Tag> },
                { title: 'Обязательное', dataIndex: 'required', key: 'required', width: 100, render: v => v ? <Tag color="red">Да</Tag> : <Tag>Нет</Tag> },
                { title: 'Ключ', dataIndex: 'businessKey', key: 'businessKey', width: 80, render: v => v ? <Tag color="blue">BK</Tag> : null },
              ]}
              pagination={false} size="small"
              locale={{ emptyText: 'Нет полей' }}
            />
          </div>
        )}
      </Card>

      {selectedEntity && (
        <Card title={<><UploadOutlined /> Загрузите Excel-файл</>}>
          <Dragger
            accept=".xlsx,.xls"
            maxCount={1}
            showUploadList={false}
            beforeUpload={(f) => { handleFileUpload(f); return false; }}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Нажмите или перетащите Excel-файл в эту область</p>
            <p className="ant-upload-hint">Поддерживаются .xlsx и .xls</p>
          </Dragger>
          {file && <Alert message={`Файл: ${file.name}`} type="success" showIcon style={{ marginTop: 12 }} />}
        </Card>
      )}
    </Space>
  );

  const renderStep1 = () => {
    const hasAnalysisResult = analyzeResult !== null;
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {file && (
          <Card
            title={<Space><FileExcelOutlined /> Предпросмотр: {file.name}</Space>}
            extra={<Button size="small" onClick={() => setStep(0)}>Выбрать другой файл</Button>}
          >
            <Table
              dataSource={preview.map((row, i) => ({ ...row, key: i, _rowNum: i + 1 }))}
              columns={[
                { title: '#', dataIndex: '_rowNum', key: '_rowNum', width: 50 },
                ...headers.map(h => ({
                  title: h, dataIndex: h, key: h,
                  ellipsis: true,
                  render: v => v?.toString() || null,
                })),
              ]}
              pagination={false} size="small" scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'Нет данных для предпросмотра' }}
            />
          </Card>
        )}

        {entityMeta && headers.length > 0 && (
          <Card title={<><SettingOutlined /> Сопоставление колонок</>}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Укажите, какая колонка Excel соответствует каждому полю сущности
            </Text>
            <Table
              dataSource={entityMeta.fields.map((f, i) => ({
                ...f, key: i, currentMapping: mapping[f.name] || '',
              }))}
              columns={[
                { title: 'Поле', dataIndex: 'label', key: 'label', width: 180 },
                { title: 'Обязательное', dataIndex: 'required', key: 'required', width: 100, render: v => v ? <Tag color="red">Да</Tag> : null },
                { title: 'Колонка в Excel', key: 'mapping', width: 300,
                  render: (_, record) => (
                    <Select
                      style={{ width: '100%' }}
                      value={mapping[record.name] || undefined}
                      placeholder="— не выбрано —"
                      allowClear
                      onChange={(val) => setMapping(prev => ({
                        ...prev, [record.name]: val || undefined
                      }))}
                      options={headers.map(h => ({ label: h, value: h }))}
                    />
                  ),
                },
              ]}
              pagination={false} size="small"
            />
          </Card>
        )}

        <Flex justify="space-between" align="center">
          <Button onClick={() => setStep(0)}>Назад</Button>
          <Button
            type="primary"
            size="large"
            icon={<AuditOutlined />}
            loading={analyzing}
            onClick={handleAnalyze}
            disabled={!Object.keys(mapping).length}
          >
            Анализировать (DRY RUN)
          </Button>
        </Flex>
      </Space>
    );
  };

  const renderStep2 = () => {
    if (!analyzeResult) return null;
    const {
      totalRows = 0, readyRows = 0, duplicateRows = 0, errorRows = 0,
      conflicts = [], errors = [], preview: resultPreview = [],
    } = analyzeResult;

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title={<><AuditOutlined /> Результат анализа (DRY RUN)</>}>
          <Flex gap="small" wrap="wrap" style={{ marginBottom: 16 }}>
            <Card size="small" style={{ flex: 1, minWidth: 120, textAlign: 'center' }}>
              <Text type="secondary">Всего строк</Text>
              <div><Text strong style={{ fontSize: 24 }}>{totalRows}</Text></div>
            </Card>
            <Card size="small" style={{ flex: 1, minWidth: 120, textAlign: 'center', borderColor: '#52c41a' }}>
              <Text type="secondary">Готово к импорту</Text>
              <div><Text strong style={{ fontSize: 24, color: '#52c41a' }}>{readyRows}</Text></div>
            </Card>
            <Card size="small" style={{ flex: 1, minWidth: 120, textAlign: 'center', borderColor: '#faad14' }}>
              <Text type="secondary">Дубликаты</Text>
              <div><Text strong style={{ fontSize: 24, color: '#faad14' }}>{duplicateRows}</Text></div>
            </Card>
            <Card size="small" style={{ flex: 1, minWidth: 120, textAlign: 'center', borderColor: '#ff4d4f' }}>
              <Text type="secondary">Ошибки</Text>
              <div><Text strong style={{ fontSize: 24, color: '#ff4d4f' }}>{errorRows}</Text></div>
            </Card>
          </Flex>

          {totalRows > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">Прогресс готовности</Text>
              <Progress percent={Math.round((readyRows / totalRows) * 100)} status={readyRows === totalRows ? 'success' : 'active'} />
            </div>
          )}
        </Card>

        {conflicts.length > 0 && (
          <Card title={<span><WarningOutlined /> Конфликты ({conflicts.length})</span>}>
            <Table
              dataSource={conflicts.map((c, i) => ({ ...c, key: i }))}
              columns={[
                { title: 'Строка', dataIndex: 'row', key: 'row', width: 70 },
                { title: 'Источник', dataIndex: 'source', key: 'source', width: 80, render: v => v === 'DB' ? <Tag color="orange">БД</Tag> : <Tag color="purple">Файл</Tag> },
                { title: 'Сообщение', dataIndex: 'message', key: 'message', ellipsis: true },
                { title: 'Данные Excel', key: 'excel', ellipsis: true, render: (_, r) => r.excelData ? Object.entries(r.excelData).filter(([k]) => !k.startsWith('__')).map(([k, v]) => `${k}: ${v}`).join(', ') : '—' },
                { title: 'Данные БД', key: 'db', ellipsis: true, render: (_, r) => r.dbData ? Object.entries(r.dbData).filter(([k]) => !k.startsWith('__')).map(([k, v]) => `${k}: ${v}`).join(', ') : '—' },
                {
                  title: 'Решение', key: 'decision', width: 120,
                  render: (_, record) => record.source === 'DB' ? (
                    <Select
                      size="small" style={{ width: 100 }}
                      value={rowDecisions[record.row] || strategy}
                      onChange={(val) => setRowDecisions(prev => ({ ...prev, [record.row]: val }))}
                      options={[
                        { label: 'Пропустить', value: 'SKIP' },
                        { label: 'Обновить', value: 'UPDATE' },
                      ]}
                    />
                  ) : <Tag>Пропустить</Tag>,
                },
              ]}
              pagination={false} size="small" scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'Нет конфликтов' }}
            />
          </Card>
        )}

        {errors.length > 0 && (
          <Card title={<span><CloseCircleOutlined /> Ошибки валидации ({errors.length})</span>}>
            <Table
              dataSource={errors.map((e, i) => ({ ...e, key: i }))}
              columns={[
                { title: 'Строка', dataIndex: 'row', key: 'row', width: 70 },
                { title: 'Поле', dataIndex: 'field', key: 'field', width: 140 },
                { title: 'Ошибка', dataIndex: 'message', key: 'message' },
              ]}
              pagination={false} size="small"
              locale={{ emptyText: 'Нет ошибок' }}
            />
          </Card>
        )}

        <Card title={<><PlayCircleOutlined /> Стратегия импорта</>}>
          <Radio.Group
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="large"
            options={[
              { label: STRATEGY_LABELS.SKIP, value: 'SKIP' },
              { label: STRATEGY_LABELS.UPDATE, value: 'UPDATE' },
              { label: STRATEGY_LABELS.REPLACE_ALL, value: 'REPLACE_ALL' },
            ]}
          />
          <div style={{ marginTop: 8 }}>
            {strategy === 'REPLACE_ALL' && (
              <Alert message="Все существующие записи будут удалены перед импортом!" type="error" showIcon />
            )}
            {strategy === 'SKIP' && (
              <Text type="secondary">Дубликаты (по бизнес-ключу) будут пропущены. Добавятся только новые записи.</Text>
            )}
            {strategy === 'UPDATE' && (
              <Text type="secondary">Существующие записи (по бизнес-ключу) будут обновлены. Новые — добавлены.</Text>
            )}
          </div>
        </Card>

        <Flex justify="space-between" align="center">
          <Button onClick={() => setStep(1)}>Назад</Button>
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            loading={executing}
            onClick={handleExecute}
            disabled={readyRows === 0 && conflicts.length === 0}
          >
            Выполнить импорт
          </Button>
        </Flex>
      </Space>
    );
  };

  const renderStep3 = () => {
    if (!executeResult) return (
      <Empty description="Результат импорта не получен">
        <Button onClick={resetAll} type="primary">Новый импорт</Button>
      </Empty>
    );

    const { created = 0, updated = 0, skipped = 0, failed = 0, message = '' } = executeResult;
    const total = created + updated + skipped + failed;

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
            <Title level={3} style={{ marginTop: 16 }}>Импорт завершён</Title>
            {message && <Text type="secondary">{message}</Text>}
          </div>

          <Flex gap="small" wrap="wrap" justify="center">
            <Card size="small" style={{ minWidth: 120, textAlign: 'center', borderColor: '#52c41a' }}>
              <Text type="secondary">Создано</Text>
              <div><Text strong style={{ fontSize: 28, color: '#52c41a' }}>{created}</Text></div>
            </Card>
            <Card size="small" style={{ minWidth: 120, textAlign: 'center', borderColor: '#1677ff' }}>
              <Text type="secondary">Обновлено</Text>
              <div><Text strong style={{ fontSize: 28, color: '#1677ff' }}>{updated}</Text></div>
            </Card>
            <Card size="small" style={{ minWidth: 120, textAlign: 'center', borderColor: '#faad14' }}>
              <Text type="secondary">Пропущено</Text>
              <div><Text strong style={{ fontSize: 28, color: '#faad14' }}>{skipped}</Text></div>
            </Card>
            <Card size="small" style={{ minWidth: 120, textAlign: 'center', borderColor: '#ff4d4f' }}>
              <Text type="secondary">Ошибок</Text>
              <div><Text strong style={{ fontSize: 28, color: '#ff4d4f' }}>{failed}</Text></div>
            </Card>
          </Flex>

          {total > 0 && (
            <Progress
              percent={Math.round(((created + updated) / total) * 100)}
              format={() => `${created + updated} / ${total}`}
              style={{ marginTop: 24 }}
            />
          )}
        </Card>

        <Flex justify="center" gap="middle">
          <Button size="large" icon={<ReloadOutlined />} onClick={resetAll}>
            Новый импорт
          </Button>
        </Flex>
      </Space>
    );
  };

  const steps = [
    { title: 'Сущность и файл', status: step > 0 ? 'finish' : step === 0 ? 'process' : 'wait' },
    { title: 'Маппинг колонок', status: step > 1 ? 'finish' : step === 1 ? 'process' : 'wait' },
    { title: 'Анализ', status: step > 2 ? 'finish' : step === 2 ? 'process' : 'wait' },
    { title: 'Результат', status: step === 3 ? 'process' : 'wait' },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={2} className="agro-page-title" style={{ margin: 0 }}>
          <FileExcelOutlined /> Импорт из Excel
        </Title>
        <Button icon={<ReloadOutlined />} onClick={resetAll}>Сбросить</Button>
      </Row>

      <Steps
        current={step}
        items={steps}
        style={{ marginBottom: 24 }}
        onChange={(s) => { if (s < step) setStep(s); }}
      />

      <div className="agro-card" style={{ padding: 24 }}>
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
};

export default Import;
