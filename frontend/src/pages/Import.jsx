import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Typography, Steps, Button, Select, Upload, Table, Radio, Space,
  Spin, notification, Badge, Tag, Tooltip, Progress, Empty, Alert,
} from 'antd';
import {
  UploadOutlined, InboxOutlined, FileExcelOutlined,
  DeleteOutlined, CheckCircleOutlined, WarningOutlined,
  CloseCircleOutlined, SwapOutlined, ThunderboltOutlined,
  ArrowLeftOutlined, ArrowRightOutlined, ReloadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { importApi } from '../api/importApi';
import { initAPI } from '../mock';
import '../styles/import.css';

const { Title, Text } = Typography;

// ─── Available entities (fallback — will be overridden by API) ───
const DEFAULT_ENTITIES = [
  { value: 'product', label: 'Продукты' },
  { value: 'category', label: 'Категории' },
  { value: 'culture', label: 'Культуры' },
  { value: 'district', label: 'Районы' },
];

// ─── Utility: human-readable file size ───
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// ─── Utility: try auto-map column by matching labels ───
const autoMap = (fields, excelHeaders) => {
  const mapping = {};
  fields.forEach((field) => {
    const label = (field.label || field.name).toLowerCase().trim();
    const name = field.name.toLowerCase().trim();
    const match = excelHeaders.find((h) => {
      const hl = h.toLowerCase().trim();
      return hl === label || hl === name || hl.includes(label) || label.includes(hl);
    });
    if (match) mapping[field.name] = match;
  });
  return mapping;
};

// ─────────────────────────────────────────────────────
// Step 1: Select Entity & Upload File
// ─────────────────────────────────────────────────────
const StepUpload = ({ entity, setEntity, file, setFile, headers, setHeaders, rows, setRows, entities }) => {
  const [dragging, setDragging] = useState(false);

  const parseFile = useCallback((fileObj) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (json.length === 0) {
          notification.warning({ message: 'Файл пустой или не содержит данных' });
          return;
        }
        const hdrs = json[0].map((h) => String(h).trim()).filter(Boolean);
        setHeaders(hdrs);
        // keep first 5 data rows for preview
        setRows(json.slice(1, 6).map((row, idx) => {
          const obj = { _key: idx };
          hdrs.forEach((h, i) => { obj[h] = row[i] ?? ''; });
          return obj;
        }));
        setFile(fileObj);
        notification.success({ message: `Файл «${fileObj.name}» прочитан`, description: `${hdrs.length} колонок, ~${json.length - 1} строк` });
      } catch {
        notification.error({ message: 'Не удалось прочитать файл. Убедитесь, что это Excel (.xlsx/.xls) или CSV.' });
      }
    };
    reader.readAsArrayBuffer(fileObj);
  }, [setFile, setHeaders, setRows]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) parseFile(droppedFile);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Выберите тип данных для импорта</Text>
        <Select
          id="import-entity-select"
          style={{ width: '100%', maxWidth: 400 }}
          placeholder="Выберите сущность..."
          options={entities}
          value={entity}
          onChange={setEntity}
          size="large"
        />
      </div>

      {!file ? (
        <div
          className={`import-upload-zone${dragging ? ' drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('import-file-input').click()}
        >
          <InboxOutlined className="upload-icon" />
          <div><Text strong style={{ fontSize: 16 }}>Перетащите файл сюда</Text></div>
          <div className="upload-hint">или нажмите, чтобы выбрать файл (.xlsx, .xls, .csv)</div>
          <input
            id="import-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files[0]) parseFile(e.target.files[0]); }}
          />
        </div>
      ) : (
        <div className="import-file-info">
          <FileExcelOutlined style={{ fontSize: 28, color: '#1a7c3e' }} />
          <div style={{ flex: 1 }}>
            <div className="file-name">{file.name}</div>
            <div className="file-size">{formatBytes(file.size)} • {headers.length} колонок</div>
          </div>
          <Button
            icon={<DeleteOutlined />}
            danger
            size="small"
            onClick={() => { setFile(null); setHeaders([]); setRows([]); }}
          >
            Удалить
          </Button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────
// Step 2: Column Mapping
// ─────────────────────────────────────────────────────
const StepMapping = ({ headers, metadata, mapping, setMapping, strategy, setStrategy }) => {
  const fields = metadata?.fields || [];
  const autoMapped = useRef(false);

  // Auto-map once
  if (!autoMapped.current && fields.length > 0 && headers.length > 0) {
    const auto = autoMap(fields, headers);
    if (Object.keys(auto).length > 0 && Object.keys(mapping).length === 0) {
      setMapping(auto);
    }
    autoMapped.current = true;
  }

  const usedHeaders = Object.values(mapping);

  return (
    <div>
      <table className="mapping-table">
        <thead>
          <tr>
            <th style={{ width: '40%' }}>Поле в системе</th>
            <th>Колонка из файла</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.name}>
              <td>
                <div className="mapping-field-name">
                  {field.required && <span className="field-required">*</span>}
                  {field.label || field.name}
                  {mapping[field.name] && autoMapped.current && (
                    <span className="mapping-auto-badge">авто</span>
                  )}
                </div>
                <div className="mapping-field-type">{field.type}</div>
              </td>
              <td>
                <Select
                  style={{ width: '100%' }}
                  placeholder="— не сопоставлено —"
                  allowClear
                  showSearch
                  value={mapping[field.name] || undefined}
                  onChange={(val) => {
                    setMapping((prev) => {
                      const next = { ...prev };
                      if (val) next[field.name] = val;
                      else delete next[field.name];
                      return next;
                    });
                  }}
                  options={headers.map((h) => ({
                    value: h,
                    label: h,
                    disabled: usedHeaders.includes(h) && mapping[field.name] !== h,
                  }))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="strategy-section">
        <div className="strategy-title">Что делать при совпадении данных?</div>
        <Radio.Group value={strategy} onChange={(e) => setStrategy(e.target.value)}>
          <Space direction="vertical">
            <Radio value="SKIP">Пропускать дубликаты</Radio>
            <Radio value="UPDATE">Обновлять существующие записи</Radio>
            <Radio value="REPLACE">
              Удалить текущие данные и загрузить новые
            </Radio>
          </Space>
        </Radio.Group>
        {strategy === 'REPLACE' && (
          <div className="strategy-danger-note">
            <WarningOutlined /> Внимание! Все текущие записи этой сущности будут удалены перед импортом.
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────
// Step 3: Preview
// ─────────────────────────────────────────────────────
const StepPreview = ({ headers, rows, mapping, metadata }) => {
  const fields = metadata?.fields || [];
  const mappedFields = fields.filter((f) => mapping[f.name]);

  const columns = mappedFields.map((f) => ({
    title: (
      <span>
        <Text strong>{f.label || f.name}</Text>
        <br />
        <Text type="secondary" style={{ fontSize: 11 }}>← {mapping[f.name]}</Text>
      </span>
    ),
    dataIndex: mapping[f.name],
    key: f.name,
    ellipsis: true,
  }));

  return (
    <div className="preview-section">
      {mappedFields.length === 0 ? (
        <Empty description="Нет сопоставленных колонок" />
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            message={`Предпросмотр первых ${rows.length} строк. Данные будут записаны в поля, указанные вверху каждой колонки.`}
            style={{ marginBottom: 16 }}
          />
          <Table
            dataSource={rows}
            columns={columns}
            pagination={false}
            rowKey="_key"
            size="small"
            scroll={{ x: true }}
            rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
          />
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────
// Step 4: Analysis & Conflict Resolution
// ─────────────────────────────────────────────────────
const StepAnalysis = ({ report, resolutions, setResolutions }) => {
  if (!report) return <Spin tip="Анализируем данные..." style={{ display: 'block', margin: '60px auto' }} />;

  const { summary, conflicts = [] } = report;

  const applyAll = (action) => {
    const all = {};
    conflicts.forEach((c) => { all[c.row] = action; });
    setResolutions(all);
  };

  return (
    <div>
      {/* Summary cards */}
      <div className="analysis-summary">
        <div className="analysis-stat-card stat-total">
          <div className="stat-value">{summary?.total ?? '—'}</div>
          <div className="stat-label">Всего строк</div>
        </div>
        <div className="analysis-stat-card stat-ready">
          <div className="stat-value">{summary?.ready ?? '—'}</div>
          <div className="stat-label">Готово к импорту</div>
        </div>
        <div className="analysis-stat-card stat-duplicates">
          <div className="stat-value">{summary?.duplicates ?? 0}</div>
          <div className="stat-label">Дубликаты</div>
        </div>
        <div className="analysis-stat-card stat-errors">
          <div className="stat-value">{summary?.errors ?? 0}</div>
          <div className="stat-label">Ошибки</div>
        </div>
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text strong style={{ fontSize: 16 }}>Конфликтные записи ({conflicts.length})</Text>
            <Space>
              <Button size="small" onClick={() => applyAll('UPDATE')} icon={<SwapOutlined />}>Обновить все</Button>
              <Button size="small" onClick={() => applyAll('SKIP')}>Пропустить все</Button>
            </Space>
          </div>
          {conflicts.map((c) => (
            <div className="conflict-card" key={c.row}>
              <div className="conflict-row-label">
                <Tag color={c.source === 'DB' ? 'orange' : 'blue'}>
                  {c.source === 'DB' ? 'Дубль с БД' : 'Дубль в файле'}
                </Tag>
                Строка #{c.row} — {c.message}
              </div>
              {c.entity && (
                <div className="conflict-comparison">
                  <div className="conflict-side side-db">
                    <div className="side-label">В базе данных</div>
                    {Object.entries(c.entity).map(([k, v]) => (
                      <div key={k}><Text type="secondary">{k}:</Text> {String(v)}</div>
                    ))}
                  </div>
                  <div className="conflict-side side-file">
                    <div className="side-label">Из файла</div>
                    {c.incoming && Object.entries(c.incoming).map(([k, v]) => (
                      <div key={k}><Text type="secondary">{k}:</Text> {String(v)}</div>
                    ))}
                  </div>
                </div>
              )}
              <div className="conflict-actions">
                <Button
                  size="small"
                  type={resolutions[c.row] === 'UPDATE' ? 'primary' : 'default'}
                  onClick={() => setResolutions((p) => ({ ...p, [c.row]: 'UPDATE' }))}
                >
                  Обновить
                </Button>
                <Button
                  size="small"
                  danger={resolutions[c.row] === 'SKIP'}
                  type={resolutions[c.row] === 'SKIP' ? 'primary' : 'default'}
                  onClick={() => setResolutions((p) => ({ ...p, [c.row]: 'SKIP' }))}
                >
                  Пропустить
                </Button>
              </div>
            </div>
          ))}
        </>
      )}

      {conflicts.length === 0 && (summary?.errors ?? 0) === 0 && (
        <Alert
          type="success"
          showIcon
          message="Конфликтов не обнаружено. Все строки готовы к импорту!"
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────
// Step 5: Execution Result
// ─────────────────────────────────────────────────────
const StepResult = ({ result, onReset }) => {
  if (!result) return <Spin tip="Выполняем импорт..." style={{ display: 'block', margin: '60px auto' }} />;

  const hasErrors = (result.errors ?? 0) > 0;
  const iconCls = hasErrors ? 'partial' : 'success';

  return (
    <div className="import-result">
      <div className={`result-icon ${iconCls}`}>
        {hasErrors ? <WarningOutlined /> : <CheckCircleOutlined />}
      </div>
      <div className="result-title">
        {hasErrors ? 'Импорт завершён с предупреждениями' : 'Импорт успешно завершён!'}
      </div>
      <div className="result-desc">
        Успешно: {result.imported ?? 0} • Пропущено: {result.skipped ?? 0} • Ошибок: {result.errors ?? 0}
      </div>
      {result.errorDetails && result.errorDetails.length > 0 && (
        <div style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto 24px' }}>
          <Text strong>Строки с ошибками:</Text>
          <Table
            size="small"
            pagination={false}
            dataSource={result.errorDetails.map((e, i) => ({ ...e, _key: i }))}
            rowKey="_key"
            columns={[
              { title: 'Строка', dataIndex: 'row', width: 80 },
              { title: 'Ошибка', dataIndex: 'message' },
            ]}
            rowClassName="agro-row-failed"
            style={{ marginTop: 8 }}
          />
        </div>
      )}
      <Space>
        <Button type="primary" icon={<ReloadOutlined />} onClick={onReset}>Новый импорт</Button>
      </Space>
    </div>
  );
};

// ═════════════════════════════════════════════════════
// Main Import Page
// ═════════════════════════════════════════════════════
const Import = () => {
  // Wizard state
  const [step, setStep] = useState(0);

  // Step 1
  const [entity, setEntity] = useState(null);
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [entities, setEntities] = useState(DEFAULT_ENTITIES);

  // Step 2
  const [metadata, setMetadata] = useState(null);
  const [mapping, setMapping] = useState({});
  const [strategy, setStrategy] = useState('SKIP');
  const [metaLoading, setMetaLoading] = useState(false);

  // Step 4
  const [analysisReport, setAnalysisReport] = useState(null);
  const [resolutions, setResolutions] = useState({});
  const [analyzing, setAnalyzing] = useState(false);

  // Step 5
  const [importResult, setImportResult] = useState(null);
  const [executing, setExecuting] = useState(false);

  // ── Fetch available entities on mount ──
  useEffect(() => {
    const loadEntities = async () => {
      try {
        const res = await importApi.getEntities();
        if (res.data) {
          const mapped = res.data.map(item => ({
            value: item.entity || item.value,
            label: item.displayName || item.label
          }));
          setEntities(mapped);
        }
      } catch (err) {
        console.error("Failed to fetch import entities", err);
      }
    };
    loadEntities();
  }, []);

  // ── Fetch metadata when entering step 2 ──
  const fetchMetadata = useCallback(async () => {
    if (!entity) return;
    setMetaLoading(true);
    try {
      const res = await importApi.getMetadata(entity);
      setMetadata(res.data);
    } catch {
      // Fallback mock metadata for development
      notification.warning({ message: 'Бэкенд недоступен', description: 'Используются демонстрационные метаданные.' });
      setMetadata({
        entity,
        fields: [
          { name: 'name', label: 'Название', type: 'string', required: true },
          { name: 'description', label: 'Описание', type: 'string', required: false },
          { name: 'price', label: 'Цена', type: 'number', required: true },
          { name: 'quantity', label: 'Количество', type: 'number', required: false },
        ],
      });
    } finally {
      setMetaLoading(false);
    }
  }, [entity]);

  // ── Run analysis ──
  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAnalysisReport(null);
    try {
      const res = await importApi.analyze(entity, file, mapping, strategy);
      setAnalysisReport(res.data);
    } catch {
      // Fallback: pretend everything is ok
      notification.warning({ message: 'Бэкенд недоступен', description: 'Используется демо-отчёт анализа.' });
      setAnalysisReport({
        summary: { total: rows.length || 5, ready: rows.length || 5, duplicates: 0, errors: 0 },
        conflicts: [],
      });
    } finally {
      setAnalyzing(false);
    }
  }, [entity, file, mapping, strategy, rows]);

  // ── Execute import ──
  const runExecute = useCallback(async () => {
    setExecuting(true);
    setImportResult(null);
    try {
      const res = await importApi.execute(entity, file, mapping, strategy, resolutions);
      setImportResult(res.data);
      
      // Re-run initAPI to reload live seeded records into all charts and tables
      try {
        await initAPI();
      } catch (err) {
        console.error("Failed to re-fetch live data after import", err);
      }
    } catch {
      notification.warning({ message: 'Бэкенд недоступен', description: 'Используется демо-результат.' });
      setImportResult({
        imported: analysisReport?.summary?.ready ?? 0,
        skipped: analysisReport?.summary?.duplicates ?? 0,
        errors: 0,
        errorDetails: [],
      });
    } finally {
      setExecuting(false);
    }
  }, [entity, file, mapping, strategy, resolutions, analysisReport]);

  // ── Step transition handlers ──
  const canNext = useMemo(() => {
    switch (step) {
      case 0: return !!entity && !!file && headers.length > 0;
      case 1: {
        const requiredFields = (metadata?.fields || []).filter((f) => f.required);
        return requiredFields.every((f) => mapping[f.name]);
      }
      case 2: return true; // preview is informational
      case 3: return !!analysisReport;
      default: return false;
    }
  }, [step, entity, file, headers, metadata, mapping, analysisReport]);

  const goNext = async () => {
    const nextStep = step + 1;
    if (step === 0) {
      // fetch metadata before entering mapping step
      await fetchMetadata();
    }
    if (step === 2) {
      // entering analysis step — run analysis
      runAnalysis();
    }
    if (step === 3) {
      // entering execution step
      runExecute();
    }
    setStep(nextStep);
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const resetWizard = () => {
    setStep(0);
    setEntity(null);
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMetadata(null);
    setMapping({});
    setStrategy('SKIP');
    setAnalysisReport(null);
    setResolutions({});
    setImportResult(null);
  };

  // ── Steps config ──
  const stepsConfig = [
    { title: 'Загрузка файла' },
    { title: 'Маппинг колонок' },
    { title: 'Предпросмотр' },
    { title: 'Анализ' },
    { title: 'Результат' },
  ];

  return (
    <div>
      <Title level={2} className="agro-page-title">Импорт данных из Excel</Title>

      <div className="agro-card import-wizard">
        <Steps
          current={step}
          items={stepsConfig}
          size="small"
          style={{ marginBottom: 32 }}
        />

        {/* Step content */}
        {step === 0 && (
          <StepUpload
            entity={entity} setEntity={setEntity}
            file={file} setFile={setFile}
            headers={headers} setHeaders={setHeaders}
            rows={rows} setRows={setRows}
            entities={entities}
          />
        )}
        {step === 1 && (
          metaLoading
            ? <Spin tip="Загрузка метаданных..." style={{ display: 'block', margin: '40px auto' }} />
            : <StepMapping
                headers={headers}
                metadata={metadata}
                mapping={mapping} setMapping={setMapping}
                strategy={strategy} setStrategy={setStrategy}
              />
        )}
        {step === 2 && (
          <StepPreview headers={headers} rows={rows} mapping={mapping} metadata={metadata} />
        )}
        {step === 3 && (
          <StepAnalysis report={analysisReport} resolutions={resolutions} setResolutions={setResolutions} />
        )}
        {step === 4 && (
          <StepResult result={importResult} onReset={resetWizard} />
        )}

        {/* Navigation */}
        {step < 4 && (
          <div className="wizard-nav">
            <Button disabled={step === 0} onClick={goBack} icon={<ArrowLeftOutlined />}>
              Назад
            </Button>
            <Button
              type="primary"
              disabled={!canNext}
              loading={analyzing || executing}
              onClick={goNext}
              icon={step === 3 ? <ThunderboltOutlined /> : <ArrowRightOutlined />}
            >
              {step === 3 ? 'Выполнить импорт' : 'Далее'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Import;
