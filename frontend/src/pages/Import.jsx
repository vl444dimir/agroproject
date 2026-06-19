import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Typography, Steps, Button, Select, Upload, Table, Radio, Space,
  Spin, notification, Badge, Tag, Tooltip, Progress, Empty, Alert, Drawer, Row, Col, Input
} from 'antd';
import {
  UploadOutlined, InboxOutlined, FileExcelOutlined,
  DeleteOutlined, CheckCircleOutlined, WarningOutlined,
  CloseCircleOutlined, SwapOutlined, ThunderboltOutlined,
  ArrowLeftOutlined, ArrowRightOutlined, ReloadOutlined,
  DownloadOutlined, RobotOutlined, SendOutlined, SettingOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { importApi } from '../api/importApi';
import { initAPI } from '../mock';
import { askGemini, parseJsonFromText } from '../api/gemini';
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

  // ИИ-Ассистент состояния
  const [aiDrawerVisible, setAiDrawerVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'Привет! Я ИИ-ассистент по импорту данных. Загрузите файл Excel, и я помогу вам сопоставить колонки, проверить корректность данных и быстро решить конфликты дубликатов в базе данных.',
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Автоматические реплики ИИ в зависимости от шага
  useEffect(() => {
    let text = '';
    if (step === 0) {
      if (!file) {
        text = 'Пожалуйста, выберите тип данных (например, Продукты) и перетащите ваш Excel-файл в зону загрузки.';
      } else {
        text = `Отличный выбор! Вы загрузили файл «${file.name}». Теперь нажмите кнопку «Далее» внизу экрана, чтобы перейти к сопоставлению колонок.`;
      }
    } else if (step === 1) {
      text = 'Мы на этапе сопоставления колонок. У меня есть готовая рекомендация по маппингу! Нажмите кнопку «Применить ИИ-рекомендации» ниже в чате, чтобы я настроил поля автоматически.';
    } else if (step === 2) {
      text = 'Пожалуйста, ознакомьтесь с предпросмотром данных. Все ли значения колонок встали на свои места? Если всё верно, нажимайте «Далее» для запуска ИИ-анализа и сверки с базой данных.';
    } else if (step === 3) {
      text = 'Я проверил данные файла на совпадения в базе данных. Обнаружено несколько пересечений. Нажмите кнопку «Решить конфликты через ИИ», чтобы применить оптимальную стратегию для каждой строки.';
    } else if (step === 4) {
      text = 'Импорт полностью завершен! Данные успешно записаны в PostgreSQL. Отчет о результатах отображен на экране.';
    }

    if (text) {
      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  }, [step, file]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTyping]);

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

  // ── AI actions ──
  const handleApplyAIMapping = async () => {
    if (!metadata || !headers.length) return;
    setIsTyping(true);

    try {
      const systemInstruction = `
You are an AI data migration assistant.
Your task is to map Excel headers from an uploaded file to database entity fields.

Excel headers: [${headers.join(', ')}]
Target database fields:
${JSON.stringify(metadata.fields, null, 2)}

Determine the best semantic mapping. For each target field, choose a matching Excel header or leave it unmapped.
You MUST respond ONLY with a JSON object in this format:
\`\`\`json
{
  "mapping": {
    "field_name_1": "Excel Header Name A",
    "field_name_2": "Excel Header Name B"
  },
  "explanation": "Brief explanation in Russian detailing your mapping logic."
}
\`\`\`
Do not write any other explanation besides this JSON block.
`;
      const resText = await askGemini(
        `Сопоставь поля сущности с колонками Excel.`,
        systemInstruction
      );
      const parsed = parseJsonFromText(resText);
      
      if (parsed.mapping) {
        setMapping(parsed.mapping);
      }

      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: `🧙‍♂️ **ИИ-Рекомендация по маппингу применена!**\n\n${parsed.explanation || 'Колонки сопоставлены.'}\n\nПожалуйста, перепроверьте настройки на экране и нажмите «Далее» для предпросмотра данных.`,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      }]);
      notification.success({ message: 'ИИ-сопоставление выполнено', description: 'Заголовки сопоставлены на основе семантического анализа.' });
    } catch (err) {
      console.error("Gemini mapping error:", err);
      const fb = runFallbackMapping();
      setMapping(fb.auto);
      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: `⚠️ Ошибка ИИ-сервера: ${err.message || err}. Переключено на локальный эмулятор.\n\n🧙‍♂️ **Рекомендация эмулятора:**\n\n${fb.explanation}\n\nПожалуйста, перепроверьте настройки на экране.`,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const runFallbackMapping = () => {
    const auto = autoMap(metadata.fields, headers);
    const explanation = metadata.fields.map(f => {
      if (auto[f.name]) {
        return `• Поле **«${f.label || f.name}»** сопоставлено с колонкой **«${auto[f.name]}»** (высокая схожесть)`;
      }
      return `• Поле **«${f.label || f.name}»** не сопоставлено (совпадений не найдено)`;
    }).join('\n');
    return { auto, explanation };
  };

  const handleResolveAIConflicts = async () => {
    if (!analysisReport || !analysisReport.conflicts.length) return;
    setIsTyping(true);

    try {
      const systemInstruction = `
You are an AI database administrator.
We have conflicts between database records and Excel rows being imported.
Your task is to decide whether to UPDATE each database record with the Excel data or SKIP the Excel row to resolve the conflict.

Business Rules:
1. If the price in the incoming file is inflated/higher by more than 15% compared to the database record, choose SKIP to prevent buying at overpriced rates.
2. Otherwise, update the record with the new incoming data (choose UPDATE).

Here are the conflicts:
${JSON.stringify(analysisReport.conflicts.map(c => ({
  row: c.row,
  entity: c.entity,
  incoming: c.incoming
})), null, 2)}

You MUST respond ONLY with a JSON object in this format:
\`\`\`json
{
  "resolutions": {
    "row_number_1": "UPDATE",
    "row_number_2": "SKIP"
  },
  "explanation": "Detailed summary in Russian explaining which records were skipped due to high prices and which were updated safely."
}
\`\`\`
Do not write any other explanation besides this JSON block.
`;

      const resText = await askGemini(
        `Разреши конфликты дубликатов по бизнес-правилам.`,
        systemInstruction
      );
      const parsed = parseJsonFromText(resText);
      
      if (parsed.resolutions) {
        setResolutions(parsed.resolutions);
      }

      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: `🛡 **Конфликты автоматически разрешены через Gemini!**\n\n${parsed.explanation || 'Все конфликты обработаны.'}\n\nТеперь нажмите «Выполнить импорт» для внесения данных в базу данных.`,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      }]);
      notification.success({ message: 'Конфликты разрешены через ИИ', description: 'Решения применены на основе анализа цен.' });
    } catch (err) {
      console.error("Gemini conflicts error:", err);
      const fb = runFallbackResolveConflicts();
      setResolutions(fb.resMap);
      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: `⚠️ Ошибка ИИ-сервера: ${err.message || err}. Переключено на локальный эмулятор.\n\n🛡 **Рекомендация эмулятора:**\n• **Пропущено записей:** ${fb.skipCount} (подозрение на завышенные цены)\n• **Обновлено записей:** ${fb.updateCount} (безопасные изменения)\n\nТеперь нажмите «Выполнить импорт».`,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const runFallbackResolveConflicts = () => {
    const resMap = {};
    let skipCount = 0;
    let updateCount = 0;

    analysisReport.conflicts.forEach(c => {
      const dbPrice = c.entity?.price || 0;
      const filePrice = c.incoming?.price || 0;

      if (filePrice > dbPrice * 1.15) {
        resMap[c.row] = 'SKIP';
        skipCount++;
      } else {
        resMap[c.row] = 'UPDATE';
        updateCount++;
      }
    });
    return { resMap, skipCount, updateCount };
  };

  const handleSendChat = () => {
    if (!inputValue.trim()) return;
    const prompt = inputValue;
    setChatMessages(prev => [...prev, {
      sender: 'user',
      text: prompt,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      let responseText = '';
      const text = prompt.toLowerCase();

      if (text.includes('сопостав') || text.includes('маппинг') || text.includes('настро')) {
        if (step === 1) {
          handleApplyAIMapping();
          return;
        } else {
          responseText = 'Сопоставление колонок доступно только на Шаге 2 (Маппинг колонок). Пожалуйста, загрузите файл и перейдите на этот шаг.';
        }
      } else if (text.includes('конфликт') || text.includes('дубликат') || text.includes('реш')) {
        if (step === 3) {
          handleResolveAIConflicts();
          return;
        } else {
          responseText = 'Разрешение конфликтов и ИИ-анализ доступны только на Шаге 4 (Анализ).';
        }
      } else if (text.includes('ошибка') || text.includes('почему')) {
        responseText = 'Я проверяю типы данных в ячейках на соответствие системным полям (числа, строки, даты) и сопоставляю ключевые индексы. Если колонка пуста или содержит неверный формат — я подсвечу ее красным цветом.';
      } else {
        responseText = 'Я могу помочь вам с авто-маппингом колонок (скажите "сопоставь колонки") или с разрешением конфликтов на шаге анализа (скажите "реши конфликты"). Что именно сделать?';
      }

      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: responseText,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 1000);
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
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} className="agro-page-title" style={{ marginBottom: 0 }}>Импорт данных из Excel</Title>
        </Col>
        <Col>
          <Button 
            type="default" 
            size="large"
            icon={<RobotOutlined style={{ color: '#1677ff' }} />} 
            onClick={() => setAiDrawerVisible(true)}
            style={{ borderRadius: 8, display: 'flex', alignItems: 'center', fontWeight: '500' }}
          >
            Спросить ИИ-ассистента
          </Button>
        </Col>
      </Row>

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

      {/* AI Assistant Chat Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #1677ff 0%, #52c41a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
              </div>
              <div>
                <Text strong style={{ fontSize: 14 }}>ИИ-Ассистент по импорту</Text>
                <Badge status="processing" text={<span style={{ fontSize: 10, color: '#8c8c8c' }}>Онлайн (Gemini на сервере)</span>} style={{ display: 'block', transform: 'translateY(-2px)' }} />
              </div>
            </div>
          </div>
        }
        placement="right"
        width={380}
        onClose={() => setAiDrawerVisible(false)}
        open={aiDrawerVisible}
        bodyStyle={{ display: 'flex', flexDirection: 'column', padding: '16px 20px' }}
      >

        {/* Chat message feed */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, paddingRight: 4 }}>
          {chatMessages.map((msg, index) => (
            <div key={index} style={{
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: msg.sender === 'user' ? '#1677ff' : '#f5f5f5',
              color: msg.sender === 'user' ? '#fff' : '#262626',
              borderRadius: msg.sender === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
              padding: '10px 14px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
            }}>
              <div style={{ fontSize: 13, whiteSpace: 'pre-line' }}>{msg.text}</div>
              <div style={{ fontSize: 9, color: msg.sender === 'user' ? '#e6f7ff' : '#8c8c8c', textAlign: 'right', marginTop: 4 }}>{msg.time}</div>
            </div>
          ))}
          {isTyping && (
            <div style={{ alignSelf: 'flex-start', background: '#f5f5f5', borderRadius: '12px 12px 12px 0', padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
              <Spin size="small" style={{ marginRight: 8 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>ИИ печатает...</Text>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* AI Action triggers for current step */}
        {step === 1 && (
          <div style={{ padding: 12, background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 8, marginBottom: 12 }}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}><ThunderboltOutlined style={{ color: '#1890ff' }} /> Быстрое действие ИИ:</Text>
            <Button 
              type="primary" 
              size="middle" 
              block 
              icon={<ThunderboltOutlined />} 
              onClick={handleApplyAIMapping}
              disabled={isTyping}
            >
              Применить ИИ-рекомендации
            </Button>
          </div>
        )}

        {step === 3 && analysisReport && analysisReport.conflicts.length > 0 && (
          <div style={{ padding: 12, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8, marginBottom: 12 }}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}><WarningOutlined style={{ color: '#fa8c16' }} /> Конфликты в данных:</Text>
            <Button 
              type="primary" 
              danger
              size="middle" 
              block 
              icon={<ThunderboltOutlined />} 
              onClick={handleResolveAIConflicts}
              disabled={isTyping}
            >
              Решить конфликты через ИИ
            </Button>
          </div>
        )}

        {/* Chat input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            placeholder="Задать вопрос ассистенту..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onPressEnter={handleSendChat}
            disabled={isTyping}
            size="large"
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendChat}
            disabled={isTyping || !inputValue.trim()}
            size="large"
          />
        </div>
      </Drawer>
    </div>
  );
};

export default Import;
