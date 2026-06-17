import { useState, useRef, useEffect, useMemo } from 'react';
import { Typography, Form, Select, Checkbox, Button, Row, Col, Card, Spin, Result, Space, Divider, message, Input, Tag, Badge, Table, Statistic } from 'antd';
import { FileTextOutlined, FilterOutlined, RobotOutlined, SettingOutlined, SendOutlined, ThunderboltOutlined, FileExcelOutlined, FilePdfOutlined, FileWordOutlined, CopyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { MOCK_MAP_DISTRICTS, CALC_NORMS } from '../mock';
import { askGemini, parseJsonFromText } from '../api/gemini';
import { referencesApi } from '../api/references';
import { reportsApi } from '../api/reports';

const { Title, Text } = Typography;
const { Option } = Select;

const Reporting = () => {
  const [form] = Form.useForm();
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultId, setResultId] = useState(null);
  const navigate = useNavigate();

  // ИИ-Ассистент состояния
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'Привет! Я ваш ИИ-ассистент аналитики. Опишите своими словами, какой отчет вы хотите сформировать, и я настрою фильтры автоматически. Например: "Сделай отчет по пшенице за 2022 и 2023 годы, добавь сравнение районов и ИИ-анализ рисков".',
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // БД состояния
  const [dbCultures, setDbCultures] = useState([]);
  const [dbDistricts, setDbDistricts] = useState([]);
  const [rawReports, setRawReports] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loadingDb, setLoadingDb] = useState(false);
  
  // Состояния текстового отчета ИИ
  const [aiReportSummary, setAiReportSummary] = useState('');
  const [isGeneratingTextReport, setIsGeneratingTextReport] = useState(false);

  // Состояния для серверной пагинации и агрегации
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [loadingTable, setLoadingTable] = useState(false);
  const [activeFilters, setActiveFilters] = useState(null);
  const [summaryStats, setSummaryStats] = useState({ totalArea: 0, totalAmount: 0, warningsCount: 0 });
  const [chartData, setChartData] = useState([]);

  // Достаем уникальные районы и культуры из моков для выпадающих списков (как фоллбэк)
  const districts = MOCK_MAP_DISTRICTS.map(d => d.name);
  const crops = Object.keys(CALC_NORMS || { "Пшеница": 1, "Ячмень": 1, "Кукуруза": 1 });

  const activeDistricts = dbDistricts.length > 0 ? dbDistricts.map(d => d.name) : districts;
  const activeCrops = dbCultures.length > 0 ? dbCultures.map(c => c.name) : crops;

  // Загружаем справочники
  useEffect(() => {
    const loadReferences = async () => {
      setLoadingDb(true);
      try {
        const [cultRes, distRes] = await Promise.all([
          referencesApi.getCultures(),
          referencesApi.getDistricts()
        ]);
        
        if (cultRes?.data) setDbCultures(cultRes.data);
        if (distRes?.data) setDbDistricts(distRes.data);
      } catch (e) {
        console.error("Failed to load reference data from database", e);
        message.warning("Не удалось загрузить некоторые данные из бэкенда. Используются резервные моки.");
      } finally {
        setLoadingDb(false);
      }
    };
    loadReferences();
  }, []);

  const fetchPageData = async (pageNumber, size, filters) => {
    if (!filters) return;
    setLoadingTable(true);
    try {
      const params = {
        page: pageNumber - 1,
        size: size,
        crops: filters.crops && filters.crops.length > 0 ? filters.crops.join(",") : undefined,
        districts: filters.districts && filters.districts.length > 0 ? filters.districts.join(",") : undefined,
        years: filters.years && filters.years.length > 0 ? filters.years.join(",") : undefined
      };
      
      const res = await reportsApi.getPaginatedReports(params);
      if (res?.data) {
        setFilteredData(res.data.content || []);
        setTotalElements(res.data.totalElements || 0);
      }
    } catch (e) {
      console.error("Failed to fetch page data", e);
      message.error("Не удалось загрузить данные страницы отчета.");
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTyping]);

  const handleGenerate = async (values) => {
    setIsGenerating(true);
    setResultId(null);
    setAiReportSummary('');
    setCurrentPage(1);

    const { crops: selectedCrops, districts: selectedDistricts, years, include_pesticides, calc_economics, ai_analysis } = values;
    const filters = { crops: selectedCrops, districts: selectedDistricts, years };
    setActiveFilters(filters);

    const newId = `REP-${Math.floor(1000 + Math.random() * 9000)}-${new Date().getFullYear()}`;

    try {
      const summaryParams = {
        crops: selectedCrops && selectedCrops.length > 0 ? selectedCrops.join(",") : undefined,
        districts: selectedDistricts && selectedDistricts.length > 0 ? selectedDistricts.join(",") : undefined,
        years: years && years.length > 0 ? years.join(",") : undefined
      };
      
      const [summaryRes, pageRes] = await Promise.all([
        reportsApi.getReportsSummary(summaryParams),
        reportsApi.getPaginatedReports({ page: 0, size: pageSize, ...summaryParams })
      ]);

      let stats = { totalArea: 0, totalAmount: 0, warningsCount: 0 };
      let charts = [];
      let content = [];
      let total = 0;

      if (summaryRes?.data) {
        stats = {
          totalArea: summaryRes.data.totalArea || 0,
          totalAmount: summaryRes.data.totalAmount || 0,
          warningsCount: summaryRes.data.warningsCount || 0
        };
        charts = summaryRes.data.chartData || [];
      }

      if (pageRes?.data) {
        content = pageRes.data.content || [];
        total = pageRes.data.totalElements || 0;
      }

      setSummaryStats(stats);
      setChartData(charts);
      setFilteredData(content);
      setTotalElements(total);
      setResultId(newId);
      
      message.success('Аналитический отчет успешно сформирован по реальным данным БД!');

      if (ai_analysis) {
        setIsGeneratingTextReport(true);
        try {
          const statsPrompt = `
Сформируй подробный текстовый аналитический отчет на русском языке на основе следующих отфильтрованных данных АПК:
- Период (годы): ${years.join(', ')}
- Выбранные районы: ${selectedDistricts && selectedDistricts.length > 0 ? selectedDistricts.join(', ') : 'Все регионы'}
- Выбранные культуры: ${selectedCrops && selectedCrops.length > 0 ? selectedCrops.join(', ') : 'Все культуры'}
- Общая обработанная площадь: ${stats.totalArea.toFixed(1)} га
- Общая сумма субсидий: ${stats.totalAmount.toLocaleString('ru-RU')} ₸
- Обнаружено отклонений/рисков: ${stats.warningsCount}

Краткая сводка записей:
${JSON.stringify(content.slice(0, 15).map(item => ({
  too: item.tooName,
  district: item.districtName,
  culture: item.cultureName,
  product: item.productName,
  quantity: item.quantityUsed,
  sum: item.calculatedSum,
  status: item.status
})), null, 2)}

Структурируй отчет по следующим разделам:
1. 📈 Вводный обзор текущих показателей (площади, выплаты).
2. 🛡 Оценка рисков и аномалий (анализ отклонений, предупреждения о мошенничестве при завышении цен).
3. 🌾 Агрономические рекомендации по оптимизации выплат и севооборота.
Ответ должен быть написан в деловом и аналитическом стиле. Не пиши код и markdown блоки \`\`\` json, выдай красивый форматированный текст.
`;

          const responseText = await askGemini(statsPrompt, "You are a professional agricultural analyst and risk assessment manager.");
          setAiReportSummary(responseText);
        } catch (e) {
          console.error("Failed to generate AI report summary:", e);
          setAiReportSummary(`[Автогенерация] Отчет сформирован по выбранным параметрам.\n\n📈 Период: ${years.join(', ')}.\nОбщая площадь обработанных угодий составила ${stats.totalArea.toFixed(1)} га с суммой субсидий ${stats.totalAmount.toLocaleString('ru-RU')} ₸. Было проанализировано ${total} транзакций.\n\n🛡 Риски и аномалии:\nВыявлено ${stats.warningsCount} подозрительных записей с отклонениями от нормативных цен.\n\n🌾 Рекомендации:\nОптимизировать закупки препаратов и усилить контроль ценообразования.`);
        } finally {
          setIsGeneratingTextReport(false);
        }
      }
    } catch (err) {
      console.error("Failed to load report data:", err);
      message.error("Ошибка при генерации отчета: бэкенд недоступен.");
    } finally {
      setIsGenerating(false);
    }
  };

  const reportStats = summaryStats;

  const handleCopyText = () => {
    if (!aiReportSummary) return;
    navigator.clipboard.writeText(aiReportSummary);
    message.success("Текст отчета скопирован в буфер обмена!");
  };

  const handleGenerateAiReportOnly = async () => {
    if (filteredData.length === 0) {
      message.warning("Нет данных для анализа!");
      return;
    }
    setIsGeneratingTextReport(true);
    setAiReportSummary('');
    try {
      const selectedCrops = form.getFieldValue('crops');
      const selectedDistricts = form.getFieldValue('districts');
      const years = form.getFieldValue('years') || ['2023', '2022'];

      const statsPrompt = `
Сформируй подробный текстовый аналитический отчет на русском языке на основе следующих отфильтрованных данных АПК:
- Период (годы): ${years.join(', ')}
- Выбранные районы: ${selectedDistricts && selectedDistricts.length > 0 ? selectedDistricts.join(', ') : 'Все регионы'}
- Выбранные культуры: ${selectedCrops && selectedCrops.length > 0 ? selectedCrops.join(', ') : 'Все культуры'}
- Общая обработанная площадь: ${summaryStats.totalArea.toFixed(1)} га
- Общая сумма субсидий: ${summaryStats.totalAmount.toLocaleString('ru-RU')} ₸
- Обнаружено отклонений/рисков: ${summaryStats.warningsCount}

Краткая сводка записей:
${JSON.stringify(filteredData.slice(0, 15).map(item => ({
  too: item.tooName,
  district: item.districtName,
  culture: item.cultureName,
  product: item.productName,
  quantity: item.quantityUsed,
  sum: item.calculatedSum,
  status: item.status
})), null, 2)}

Структурируй отчет по следующим разделам:
1. 📈 Вводный обзор текущих показателей (площади, выплаты).
2. 🛡 Оценка рисков и аномалий (анализ отклонений, предупреждения о мошенничестве при завышении цен).
3. 🌾 Агрономические рекомендации по оптимизации выплат и севооборота.
Ответ должен быть написан в деловом и аналитическом стиле. Не пиши код и markdown блоки \`\`\` json, выдай красивый форматированный текст.
`;

      const responseText = await askGemini(statsPrompt, "You are a professional agricultural analyst and risk assessment manager.");
      setAiReportSummary(responseText);
    } catch (e) {
      console.error("Failed to generate AI report summary:", e);
      setAiReportSummary(`[Автогенерация] Отчет сформирован по выбранным параметрам.\n\n📈 Период: ${form.getFieldValue('years')?.join(', ') || 'указанный'}.\nОбщая площадь обработанных угодий составила ${summaryStats.totalArea.toFixed(1)} га с суммой субсидий ${summaryStats.totalAmount.toLocaleString('ru-RU')} ₸. Было проанализировано ${totalElements} транзакций.\n\n🛡 Риски и аномалии:\nВыявлено ${summaryStats.warningsCount} подозрительных записей с отклонениями от нормативных цен.\n\n🌾 Рекомендации:\nОптимизировать закупки препаратов и усилить контроль ценообразования.`);
    } finally {
      setIsGeneratingTextReport(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      message.warning("Нет данных для экспорта!");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(filteredData.map(row => ({
      'ТОО': row.tooName || '—',
      'Район': row.districtName || '—',
      'Кадастровый номер': row.cadastralNumber || '—',
      'Культура': row.cultureName || '—',
      'Год': row.rotationYear || '—',
      'Препарат': row.productName || '—',
      'Объем': `${row.quantityUsed || 0} ${row.uom || ''}`,
      'Площадь (га)': row.areaTreated || 0,
      'Сумма (₸)': row.calculatedSum || 0,
      'Статус': row.status || '—'
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Отчет");
    XLSX.writeFile(workbook, `report_${resultId}.xlsx`);
    message.success("Отчет успешно экспортирован в Excel!");
  };

  const handleExportPDF = () => {
    if (filteredData.length === 0) {
      message.warning("Нет данных для экспорта!");
      return;
    }
    const doc = new jsPDF();
    doc.text(`Аналитический отчет: ${resultId}`, 14, 15);
    const statusMap = {
      'NEW': 'Новая',
      'PENDING': 'В обработке',
      'APPROVED': 'Одобрена',
      'REJECTED': 'Отклонена'
    };
    autoTable(doc, {
      head: [['ТОО', 'Район', 'Кадастр', 'Культура', 'Год', 'Препарат', 'Объем', 'Площадь (га)', 'Сумма (₸)', 'Статус']],
      body: filteredData.map(row => [
        row.tooName || '—', 
        row.districtName || '—', 
        row.cadastralNumber || '—', 
        row.cultureName || '—', 
        row.rotationYear || '—',
        row.productName || '—', 
        `${row.quantityUsed || 0} ${row.uom || ''}`, 
        row.areaTreated != null ? row.areaTreated.toLocaleString('ru-RU') : '0',
        row.calculatedSum != null ? row.calculatedSum.toLocaleString('ru-RU') : '0',
        statusMap[row.status] || row.status || '—'
      ]),
      startY: 20
    });

    if (aiReportSummary) {
      doc.addPage();
      doc.text("ИИ-Аналитика и рекомендации:", 14, 15);
      const splitText = doc.splitTextToSize(aiReportSummary, 180);
      doc.text(splitText, 14, 25);
    }

    doc.save(`report_${resultId}.pdf`);
    message.success("Отчет успешно экспортирован в PDF!");
  };

  const handleExportWord = () => {
    if (filteredData.length === 0) {
      message.warning("Нет данных для экспорта!");
      return;
    }
    const statusMap = {
      'NEW': 'Новая',
      'PENDING': 'В обработке',
      'APPROVED': 'Одобрена',
      'REJECTED': 'Отклонена'
    };
    const tableRows = [
      new TableRow({
        children: ['ТОО', 'Район', 'Кадастр', 'Культура', 'Год', 'Препарат', 'Объем', 'Площадь (га)', 'Сумма (₸)', 'Статус'].map(h => new TableCell({ children: [new Paragraph(h)] })),
      }),
      ...filteredData.map(row => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(row.tooName || '—')] }),
          new TableCell({ children: [new Paragraph(row.districtName || '—')] }),
          new TableCell({ children: [new Paragraph(row.cadastralNumber || '—')] }),
          new TableCell({ children: [new Paragraph(row.cultureName || '—')] }),
          new TableCell({ children: [new Paragraph((row.rotationYear || '—').toString())] }),
          new TableCell({ children: [new Paragraph(row.productName || '—')] }),
          new TableCell({ children: [new Paragraph(`${row.quantityUsed || 0} ${row.uom || ''}`)] }),
          new TableCell({ children: [new Paragraph((row.areaTreated || 0).toLocaleString('ru-RU'))] }),
          new TableCell({ children: [new Paragraph((row.calculatedSum || 0).toLocaleString('ru-RU'))] }),
          new TableCell({ children: [new Paragraph(statusMap[row.status] || row.status || '—')] }),
        ]
      }))
    ];

    const docChildren = [
      new Paragraph({ text: `Аналитический отчет: ${resultId}`, heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: `Дата формирования: ${new Date().toLocaleDateString('ru-RU')}` }),
      new Paragraph({ text: `Общая площадь: ${reportStats.totalArea.toFixed(1)} га | Общая сумма: ${reportStats.totalAmount.toLocaleString('ru-RU')} тенге` }),
      new Paragraph({ text: "" }),
      new DocxTable({ rows: tableRows })
    ];

    if (aiReportSummary) {
      docChildren.push(new Paragraph({ text: "" }));
      docChildren.push(new Paragraph({ text: "ИИ-Аналитика и рекомендации:", heading: HeadingLevel.HEADING_2 }));
      aiReportSummary.split('\n').forEach(line => {
        if (line.trim().length > 0) {
          docChildren.push(new Paragraph({ text: line }));
        }
      });
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren,
      }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `report_${resultId}.docx`);
      message.success("Отчет успешно экспортирован в Word DOCX!");
    });
  };

  const reportColumns = [
    { title: 'ТОО', dataIndex: 'tooName', key: 'tooName', sorter: (a,b) => (a.tooName || '').localeCompare(b.tooName || '') },
    { title: 'Район', dataIndex: 'districtName', key: 'districtName', render: (val) => val || '—' },
    { title: 'Кадастр', dataIndex: 'cadastralNumber', key: 'cadastralNumber' },
    { title: 'Культура', dataIndex: 'cultureName', key: 'cultureName' },
    { title: 'Год', dataIndex: 'rotationYear', key: 'rotationYear' },
    { title: 'Препарат', dataIndex: 'productName', key: 'productName' },
    { title: 'Объем', key: 'volume', render: (_, r) => `${r.quantityUsed || 0} ${r.uom || ''}` },
    { title: 'Площадь (га)', dataIndex: 'areaTreated', key: 'areaTreated', render: (val) => val?.toLocaleString('ru-RU') || 0 },
    { title: 'Сумма (₸)', dataIndex: 'calculatedSum', key: 'calculatedSum', render: (val) => val?.toLocaleString('ru-RU') || 0 },
    { 
      title: 'Статус', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => {
        if (!status) return <Tag color="default">—</Tag>;
        const statusMap = {
          'NEW': { color: 'cyan', text: 'Новая' },
          'PENDING': { color: 'orange', text: 'В обработке' },
          'APPROVED': { color: 'green', text: 'Одобрена' },
          'REJECTED': { color: 'red', text: 'Отклонена' }
        };
        const config = statusMap[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    }
  ];

  const parseAIChatPrompt = (promptText) => {
    const text = promptText.toLowerCase();
    const updates = {};
    
    // Years matching
    const years = [];
    if (text.includes('2023')) years.push('2023');
    if (text.includes('2022')) years.push('2022');
    if (text.includes('2021')) years.push('2021');
    if (text.includes('2020')) years.push('2020');
    if (years.length > 0) updates.years = years;
    
    // Crop matching dynamically
    const selectedCrops = [];
    activeCrops.forEach(c => {
      const stem = c.toLowerCase().substring(0, Math.min(c.length, 6));
      if (text.includes(stem)) {
        selectedCrops.push(c);
      }
    });
    if (selectedCrops.length > 0) updates.crops = selectedCrops;

    // District matching dynamically
    const selectedDistricts = [];
    activeDistricts.forEach(d => {
      const stem = d.toLowerCase().substring(0, Math.min(d.length, 6));
      if (text.includes(stem)) {
        selectedDistricts.push(d);
      }
    });
    if (selectedDistricts.length > 0) updates.districts = selectedDistricts;
    
    // Checkboxes
    if (text.includes('пестицид') || text.includes('колебан') || text.includes('внесен')) {
      updates.include_pesticides = true;
    } else {
      updates.include_pesticides = false;
    }
    if (text.includes('район') || text.includes('сравн')) {
      updates.compare_districts = true;
    } else {
      updates.compare_districts = false;
    }
    if (text.includes('эконом') || text.includes('себестоимост') || text.includes('затрат')) {
      updates.calc_economics = true;
    } else {
      updates.calc_economics = false;
    }
    if (text.includes('ии') || text.includes('риск') || text.includes('аномал') || text.includes('llm') || text.includes('оценк')) {
      updates.ai_analysis = true;
    } else {
      updates.ai_analysis = false;
    }
    
    return updates;
  };

  const runFallbackParsing = (promptText) => {
    const parsedFilters = parseAIChatPrompt(promptText);
    
    // Накладываем фильтры на форму
    const currentValues = form.getFieldsValue();
    const nextValues = { ...currentValues, ...parsedFilters };
    form.setFieldsValue(nextValues);

    // Формируем сводку изменений для ответа ИИ
    const changelog = [];
    if (parsedFilters.crops) changelog.push(`🌾 Культуры: ${parsedFilters.crops.join(', ')}`);
    if (parsedFilters.districts) changelog.push(`📍 Районы: ${parsedFilters.districts.join(', ')}`);
    if (parsedFilters.years) changelog.push(`📅 Годы: ${parsedFilters.years.join(', ')}`);
    if (parsedFilters.include_pesticides) changelog.push(`✔ Учет пестицидов: включен`);
    if (parsedFilters.compare_districts) changelog.push(`✔ Сравнение районов: включено`);
    if (parsedFilters.calc_economics) changelog.push(`✔ Экономический срез: включен`);
    if (parsedFilters.ai_analysis) changelog.push(`🛡 ИИ-оценка рисков и аномалий: включена`);

    if (changelog.length > 0) {
      return `Я успешно настроил форму под ваш запрос:\n${changelog.join('\n')}\n\nВы можете проверить настройки в левой панели и нажать «Сгенерировать отчет».`;
    } else {
      return 'Я проанализировал ваш запрос, но не нашел конкретных параметров фильтрации (например, названия культур, годов или признаков ИИ-анализа). Пожалуйста, уточните ваш запрос.';
    }
  };

  const handleSendChat = async (textToSend) => {
    const prompt = textToSend || inputValue;
    if (!prompt.trim()) return;

    const userMessage = {
      sender: 'user',
      text: prompt,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMessage]);
    if (!textToSend) setInputValue('');
    setIsTyping(true);

    try {
      const systemInstruction = `
You are an AI assistant for a Russian agricultural management platform.
Your task is to help the user configure a custom analytical report by parsing their natural language request and returning the correct form filter values.

The available filter values are:
- districts: array of strings. Available options: [${activeDistricts.join(', ')}]. If they ask for "сравнение районов" or similar, include multiple districts or all of them.
- crops: array of strings. Available options: [${activeCrops.join(', ')}].
- years: array of strings. Available options: ["2023", "2022", "2021", "2020"].
- format: string. Must be exactly "dynamic", "summary", or "monthly".
- include_pesticides: boolean. Set to true if the user asks for pesticides/chemicals.
- compare_districts: boolean. Set to true if the user asks for district comparisons.
- calc_economics: boolean. Set to true if the user asks for cost, price, or economic analysis.
- ai_analysis: boolean. Set to true if the user asks for AI risks or anomalies.

You MUST respond ONLY with a JSON object containing two fields:
1. "filters": an object containing only the fields you wish to update/change.
2. "response": a clear, helpful reply in Russian explaining what changes you made to the filters and why.

Example response format:
\`\`\`json
{
  "filters": {
    "crops": ["Пшеница"],
    "years": ["2022", "2023"],
    "calc_economics": true
  },
  "response": "Я обновил фильтры: выбрал пшеницу за 2022 и 2023 годы и включил экономический срез."
}
\`\`\`
Do not write anything else besides this JSON block.
`;

      const responseText = await askGemini(prompt, systemInstruction);
      const parsed = parseJsonFromText(responseText);

      if (parsed.filters) {
        const currentValues = form.getFieldsValue();
        form.setFieldsValue({ ...currentValues, ...parsed.filters });
      }

      const aiMessage = {
        sender: 'ai',
        text: parsed.response || 'Настройки формы обновлены.',
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error("Gemini API error:", err);
      const fallbackText = runFallbackParsing(prompt);
      const errorMessage = {
        sender: 'ai',
        text: `⚠️ Ошибка ИИ-сервера: ${err.message || err}. Переключено на локальный эмулятор.\n\n${fallbackText}`,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickPrompts = [
    { text: 'Экономический срез по пшенице за 2022-2023 гг.', label: '📊 Экономика пшеницы' },
    { text: 'Сравнительный анализ районов с ИИ-оценкой рисков', label: '🛡 Сравнение районов + ИИ' },
    { text: 'Влияние пестицидов на урожай кукурузы за 2023 год', label: '🌾 Пестициды кукурузы' }
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} className="agro-page-title" style={{ marginBottom: 0 }}>
            Конструктор кастомных аналитических отчетов
          </Title>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={15}>
          <div className="agro-card" style={{ height: '100%' }}>
            <Title level={4} style={{ marginTop: 0, marginBottom: 24 }}><FilterOutlined /> Параметры и фильтры запроса</Title>
            <Form 
              form={form} 
              layout="vertical" 
              onFinish={handleGenerate}
              initialValues={{ years: ['2023', '2022'], ai_analysis: true, compare_districts: false, include_pesticides: false, calc_economics: false }}
            >
              <Row gutter={16} align="bottom">
                <Col xs={24} sm={12}>
                  <Form.Item 
                    name="districts" 
                    label="Районы" 
                    tooltip="Оставьте поле пустым, чтобы включить в отчет весь регион целиком"
                  >
                    <Select mode="multiple" placeholder="Выберите районы" allowClear size="large">
                      {activeDistricts.map(d => <Option key={d} value={d}>{d}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="crops" label="Сельскохозяйственные культуры">
                    <Select mode="multiple" placeholder="Выберите культуры" allowClear size="large">
                      {activeCrops.map(c => <Option key={c} value={c}>{c}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="years" label="Отчетные годы" rules={[{ required: true, message: 'Выберите как минимум один год' }]}>
                    <Select mode="multiple" placeholder="Выбрать годы" size="large">
                      <Option value="2023">2023 год</Option>
                      <Option value="2022">2022 год</Option>
                      <Option value="2021">2021 год</Option>
                      <Option value="2020">2020 год</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="format" label="Группировка" initialValue="dynamic">
                    <Select size="large">
                      <Option value="dynamic">В динамике по годам</Option>
                      <Option value="summary">Сводный за весь период</Option>
                      <Option value="monthly">Помесячная разбивка (сезонки)</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" style={{ margin: '16px 0' }}><SettingOutlined /> Параметры анализа</Divider>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Form.Item name="include_pesticides" valuePropName="checked" style={{ marginBottom: 8 }}>
                    <Checkbox>Учесть объемы внесенных пестицидов (корреляция спада урожая)</Checkbox>
                  </Form.Item>
                  <Form.Item name="compare_districts" valuePropName="checked" style={{ marginBottom: 8 }}>
                    <Checkbox>Включить сравнительный анализ показателей по районам</Checkbox>
                  </Form.Item>
                  <Form.Item name="calc_economics" valuePropName="checked" style={{ marginBottom: 8 }}>
                    <Checkbox>Запросить экономический срез (себестоимость га/урожая)</Checkbox>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Card size="small" style={{ background: '#f0f5ff', borderColor: '#adc6ff', borderRadius: 8 }}>
                    <Form.Item name="ai_analysis" valuePropName="checked" style={{ marginBottom: 0 }}>
                      <Checkbox style={{ fontWeight: 'bold' }}>
                        <RobotOutlined style={{ color: '#1677ff', marginRight: 8 }} />
                        Применить ИИ-оценку рисков по фиктивным ЭСФ и цепочкам поставок
                      </Checkbox>
                    </Form.Item>
                    <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                      Большая языковая модель (LLM) на стороне бэкенда найдет аномалии ценообразования. Операция может занять больше времени.
                    </Text>
                  </Card>
                </Col>
              </Row>

              <Form.Item style={{ marginTop: 32, marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" size="large" icon={<SettingOutlined />} loading={isGenerating}>
                  Сгенерировать отчет
                </Button>
                <Button type="default" onClick={() => form.resetFields()} size="large" style={{ marginLeft: 16 }}>
                  Сбросить
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Col>

        <Col xs={24} lg={9}>
          <div className="agro-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 520 }}>
            {isGenerating ? (
              <div style={{ padding: '80px 0', textAlign: 'center', margin: 'auto' }}>
                <Spin size="large" />
                <Title level={5} style={{ marginTop: 24, fontWeight: 'normal' }}>
                  Сервер обрабатывает данные...<br />
                  <span style={{ fontSize: 14, color: '#888' }}>Подключение ИИ для поиска аномалий</span>
                </Title>
              </div>
            ) : resultId ? (
              <div style={{ margin: 'auto', width: '100%' }}>
                <Result
                  status="success"
                  title="Отчет успешно сгенерирован!"
                  subTitle={`Документ сохранен в базе под номером: ${resultId}`}
                  extra={[
                    <Button type="primary" key="console" icon={<FileTextOutlined />} onClick={() => navigate('/reports')} style={{ marginBottom: 8 }}>
                      Перейти в реестр отчетов
                    </Button>,
                    <br key="br"/>,
                    <Button key="buy" onClick={() => setResultId(null)}>Создать новый</Button>,
                  ]}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
                {/* Header of AI copilot */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #f0f0f0', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #1677ff 0%, #52c41a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <RobotOutlined style={{ color: '#fff', fontSize: 18 }} />
                    </div>
                    <div>
                      <Text strong style={{ fontSize: 15, display: 'block' }}>ИИ-Ассистент Аналитика</Text>
                      <Badge status="processing" text={<span style={{ fontSize: 11, color: '#8c8c8c' }}>Онлайн (Gemini на сервере)</span>} />
                    </div>
                  </div>
                </div>

                {/* Message list */}
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 310, paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {chatMessages.map((msg, index) => (
                    <div key={index} style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      background: msg.sender === 'user' ? '#1677ff' : '#f5f5f5',
                      color: msg.sender === 'user' ? '#fff' : '#262626',
                      borderRadius: msg.sender === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                      padding: '10px 14px',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                      position: 'relative'
                    }}>
                      <div style={{ fontSize: 13, whiteSpace: 'pre-line' }}>{msg.text}</div>
                      <div style={{ fontSize: 9, color: msg.sender === 'user' ? '#e6f7ff' : '#8c8c8c', textAlign: 'right', marginTop: 4 }}>{msg.time}</div>
                    </div>
                  ))}
                  {isTyping && (
                    <div style={{ alignSelf: 'flex-start', background: '#f5f5f5', borderRadius: '12px 12px 12px 0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Spin size="small" style={{ marginRight: 8 }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>ИИ анализирует запрос...</Text>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick Prompts */}
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}><ThunderboltOutlined style={{ color: '#faad14' }} /> Готовые сценарии ИИ:</Text>
                  <Space wrap size={[4, 6]}>
                    {quickPrompts.map((qp, idx) => (
                      <Tag 
                        key={idx} 
                        color="blue" 
                        style={{ cursor: 'pointer', borderRadius: 4, padding: '3px 8px', fontSize: 11 }}
                        onClick={() => handleSendChat(qp.text)}
                      >
                        {qp.label}
                      </Tag>
                    ))}
                  </Space>
                </div>

                {/* Input area */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input 
                    placeholder="Напишите запрос ИИ..." 
                    value={inputValue} 
                    onChange={e => setInputValue(e.target.value)}
                    onPressEnter={() => handleSendChat()}
                    disabled={isTyping}
                    size="large"
                  />
                  <Button 
                    type="primary" 
                    icon={<SendOutlined />} 
                    onClick={() => handleSendChat()} 
                    disabled={isTyping || !inputValue.trim()}
                    size="large"
                  />
                </div>
              </div>
            )}
          </div>
        </Col>
      </Row>

      {resultId && (
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card 
              className="agro-card" 
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: 16, fontWeight: 'bold' }}>
                    <FileTextOutlined style={{ color: '#1677ff', marginRight: 8 }} />
                    Сформированный отчет: {resultId}
                  </span>
                  <Space>
                    <Button 
                      type="primary" 
                      icon={<FileExcelOutlined />} 
                      onClick={handleExportExcel}
                      style={{ background: '#107c41', borderColor: '#107c41' }}
                    >
                      Скачать Excel
                    </Button>
                    <Button 
                      type="primary" 
                      icon={<FileWordOutlined />} 
                      onClick={handleExportWord}
                      style={{ background: '#2b579a', borderColor: '#2b579a' }}
                    >
                      Скачать Word
                    </Button>
                    <Button 
                      type="primary" 
                      danger 
                      icon={<FilePdfOutlined />} 
                      onClick={handleExportPDF}
                    >
                      Скачать PDF
                    </Button>
                  </Space>
                </div>
              }
            >
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                  <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f', borderRadius: 8 }}>
                    <Statistic 
                      title="Общая обработанная площадь" 
                      value={reportStats.totalArea} 
                      precision={1} 
                      suffix=" га" 
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card size="small" style={{ background: '#e6f7ff', borderColor: '#91d5ff', borderRadius: 8 }}>
                    <Statistic 
                      title="Сумма субсидий по отчету" 
                      value={reportStats.totalAmount} 
                      precision={0} 
                      suffix=" ₸" 
                      valueStyle={{ color: '#096dd9' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card size="small" style={{ background: reportStats.warningsCount > 0 ? '#fff2e8' : '#f6ffed', borderColor: reportStats.warningsCount > 0 ? '#ffbb96' : '#b7eb8f', borderRadius: 8 }}>
                    <Statistic 
                      title="Выявленные отклонения / риски" 
                      value={reportStats.warningsCount} 
                      valueStyle={{ color: reportStats.warningsCount > 0 ? '#d4380d' : '#3f8600' }}
                    />
                  </Card>
                </Col>
              </Row>

              {(aiReportSummary || isGeneratingTextReport || filteredData.length > 0) && (
                <Card 
                  style={{ 
                    marginBottom: 24, 
                    background: 'linear-gradient(135deg, #f0f5ff 0%, #ffffff 100%)', 
                    borderColor: '#adc6ff', 
                    borderRadius: 12,
                    boxShadow: '0 4px 12px rgba(22, 119, 255, 0.05)'
                  }}
                  bodyStyle={{ padding: '20px 24px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }}>
                      <RobotOutlined style={{ color: '#1677ff', marginRight: 8, fontSize: 20 }} />
                      Аналитический ИИ-отчет и рекомендации
                    </span>
                    {aiReportSummary && (
                      <Button 
                        type="text" 
                        icon={<CopyOutlined />} 
                        onClick={handleCopyText}
                        style={{ color: '#1677ff' }}
                      >
                        Копировать отчет
                      </Button>
                    )}
                  </div>

                  {isGeneratingTextReport ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <Spin size="default" style={{ marginRight: 8 }} />
                      <Text type="secondary">ИИ-аналитик генерирует текстовый отчет на основе данных...</Text>
                    </div>
                  ) : aiReportSummary ? (
                    <div style={{ 
                      fontSize: 14, 
                      lineHeight: '1.6', 
                      color: '#262626', 
                      whiteSpace: 'pre-line',
                      background: 'rgba(255, 255, 255, 0.8)',
                      padding: 16,
                      borderRadius: 8,
                      border: '1px solid #f0f0f0'
                    }}>
                      {aiReportSummary}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                        Текстовый аналитический отчет не сформирован. Вы можете запустить его генерацию на основе отфильтрованных данных.
                      </Text>
                      <Button 
                        type="primary" 
                        ghost
                        icon={<RobotOutlined />} 
                        onClick={handleGenerateAiReportOnly}
                      >
                        Сгенерировать ИИ-отчет
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              <Row gutter={[24, 24]}>
                <Col xs={24} md={16}>
                  <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Спецификация выплат и расхода</Title>
                  <Table 
                    columns={reportColumns} 
                    dataSource={filteredData} 
                    rowKey={(record, idx) => `${record.subsidyId || idx}-${idx}`} 
                    pagination={{
                      current: currentPage,
                      pageSize: pageSize,
                      total: totalElements,
                      showSizeChanger: true,
                      pageSizeOptions: ['5', '10', '20', '50'],
                      onChange: (page, size) => {
                        setCurrentPage(page);
                        setPageSize(size);
                        fetchPageData(page, size, activeFilters);
                      }
                    }}
                    loading={loadingTable}
                    size="middle"
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Распределение выплат по культурам</Title>
                  {chartData.length > 0 ? (
                    <div style={{ width: '100%', height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <RechartsTooltip formatter={(val) => [`${val.toLocaleString()} ₸`, 'Выплаты']} />
                          <Bar dataKey="amount" fill="#1677ff" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '80px 0', border: '1px dashed #d9d9d9', borderRadius: 8 }}>
                      <Text type="secondary">Нет данных для построения графика</Text>
                    </div>
                  )}
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default Reporting;
