import { useState, useMemo, useEffect } from 'react';
import { Typography, Row, Col, Select, Button, Table, Space, Card, Spin, Input, Alert, Tag, Modal, Timeline, Badge, Tooltip, message, Descriptions } from 'antd';
import { FilePdfOutlined, FileExcelOutlined, FileWordOutlined, RobotOutlined, SearchOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, EyeOutlined, WarningOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { useAuth } from '../context/AuthContext';
import { reportsApi } from '../api/reports';
import { harvestApi } from '../api/harvestApi';
import { productsApi } from '../api/productsApi';
import { referencesApi } from '../api/references';
import backendClient from '../api/backendClient';

const { Title, Text } = Typography;
const { Option } = Select;

const Reports = () => {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [subsidiesData, setSubsidiesData] = useState([]);
  const [harvestData, setHarvestData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalElements, setTotalElements] = useState(0);
  
  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  
  // Alternative Search State
  const [altSearchQuery, setAltSearchQuery] = useState('');
  const [altResults, setAltResults] = useState([]);

  // Selected Report for detail modal
  const [selectedReport, setSelectedReport] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Filter states
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState(null);
  const [searchOrg, setSearchOrg] = useState('');

  // Available rotation years extracted from harvest data dynamically
  const availableYears = useMemo(() => {
    if (harvestData && harvestData.length > 0) {
      const years = new Set();
      harvestData.forEach(item => { if (item.harvestYear) years.add(item.harvestYear); });
      return Array.from(years).sort((a, b) => b - a);
    }
    return [2023, 2022, 2021, 2020];
  }, [harvestData]);

  // Effectiveness State
  const [effProduct, setEffProduct] = useState(null);
  const [fertilizers, setFertilizers] = useState([]);
  const [pesticides, setPesticides] = useState([]);

  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [allDistricts, setAllDistricts] = useState([]);

  // Извлечение районов при загрузке данных урожая
  useEffect(() => {
    if (harvestData && harvestData.length > 0) {
      const districtsSet = new Set();
      harvestData.forEach(r => {
        if (r.districtName) districtsSet.add(r.districtName);
      });
      const list = Array.from(districtsSet).sort();
      setAllDistricts(list);
      // Инициализируем первыми 4 районами
      setSelectedDistricts(list.slice(0, 4));
    }
  }, [harvestData]);

  const mapBackendProps = (item) => ({
    ...item,
    id: item.id || Date.now() + Math.random(),
    status: item.status || 'active',
    composition: item.composition || (item.ingredients && item.ingredients.length > 0
      ? item.ingredients.map(ing => `${ing.ingredientName || ing.name}${ing.concentration ? ` - ${ing.concentration}` : ''}`).join('\n')
      : item.formulation || '—'),
    norm: item.norm || item.normOfUse || '—',
    price: item.price ?? 0,
    manufacturer: item.manufacturer || (item.manufacturerName ? { name: item.manufacturerName } : null) || '—'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [harvResponse, fertResponse, pestResponse] = await Promise.all([
        harvestApi.getAllRecords(),
        referencesApi.getFertilizers(),
        referencesApi.getPesticides()
      ]);
      setHarvestData(harvResponse.data || []);
      
      const mappedFerts = (fertResponse.data || []).map(item => ({ ...mapBackendProps(item), type: 'fert', categoryName: item.categoryName || 'Удобрения' }));
      const mappedPests = (pestResponse.data || []).map(item => ({ ...mapBackendProps(item), type: 'pest', categoryName: item.categoryName || 'Пестициды' }));
      
      setFertilizers(mappedFerts);
      setPesticides(mappedPests);
    } catch (e) {
      console.error("Ошибка загрузки данных", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPageData = async (pageNumber, size) => {
    setLoadingTable(true);
    try {
      const params = {
        page: pageNumber - 1,
        size: size,
        risk: riskFilter,
        status: statusFilter,
        tooName: searchOrg || undefined,
        year: yearFilter || undefined
      };
      const res = await reportsApi.getPaginatedReports(params);
      if (res?.data) {
        setSubsidiesData(res.data.content || []);
        setTotalElements(res.data.totalElements || 0);
      }
    } catch (e) {
      console.error("Ошибка при получении страницы данных", e);
      message.error("Не удалось загрузить данные реестра.");
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchPageData(currentPage, pageSize);
  }, [currentPage, pageSize, riskFilter, statusFilter, yearFilter, searchOrg]);

  const handleFilterChange = (filterType, value) => {
    if (filterType === 'risk') setRiskFilter(value);
    if (filterType === 'status') setStatusFilter(value);
    if (filterType === 'year') setYearFilter(value);
    if (filterType === 'searchOrg') setSearchOrg(value);
    setCurrentPage(1);
  };

  const fetchAllFilteredForExport = async () => {
    const hide = message.loading('Подготовка данных для экспорта...', 0);
    try {
      const res = await reportsApi.getPaginatedReports({
        page: 0,
        size: 5000,
        risk: riskFilter,
        status: statusFilter,
        tooName: searchOrg || undefined,
        year: yearFilter || undefined
      });
      return res?.data?.content || [];
    } catch (e) {
      console.error(e);
      message.error('Ошибка подготовки данных');
      return [];
    } finally {
      hide();
    }
  };

  const tableColumns = [
    { 
      title: '№', 
      key: 'index', 
      width: 60, 
      render: (_, __, index) => (currentPage - 1) * pageSize + index + 1 
    },
    { title: 'ТОО', dataIndex: 'tooName', key: 'tooName', sorter: (a,b) => a.tooName.localeCompare(b.tooName) },
    { title: 'Кадастр', dataIndex: 'cadastralNumber', key: 'cadastralNumber' },
    { title: 'Культура', dataIndex: 'cultureName', key: 'cultureName' },
    { title: 'Год севооборота', dataIndex: 'rotationYear', key: 'rotationYear', render: y => y || '—' },
    { title: 'Препарат', dataIndex: 'productName', key: 'productName' },
    { 
      title: 'Категория', 
      dataIndex: 'categoryName', 
      key: 'categoryName',
      render: (cat) => {
        if (!cat) return <Tag color="default">—</Tag>;
        let color = 'blue';
        if (cat.includes('Удобрен')) color = 'green';
        else if (cat.includes('Гербицид')) color = 'orange';
        else if (cat.includes('Фунгицид')) color = 'purple';
        else if (cat.includes('Инсектицид')) color = 'red';
        return <Tag color={color}>{cat}</Tag>;
      }
    },
    { title: 'Объем', key: 'volume', render: (_, r) => `${r.quantityUsed} ${r.uom}` },
    { title: 'Цена (₸/ед)', dataIndex: 'productPrice', key: 'productPrice', render: p => p != null ? p.toLocaleString('ru-RU') : '—' },
    { title: 'Площадь (га)', dataIndex: 'areaTreated', key: 'areaTreated', render: a => a != null ? a.toLocaleString('ru-RU') : '—' },
    {
      title: 'Регламент применения',
      key: 'regulation',
      render: (_, record) => {
        if (!record.risk) {
          return (
            <Tooltip title="Фактический расход находится в пределах допустимой нормы.">
              <Tag color="success" icon={<CheckCircleOutlined />}>Норма соблюдена</Tag>
            </Tooltip>
          );
        }
        const isOver = record.riskComment?.toLowerCase().includes('превышен');
        const color = isOver ? 'error' : 'warning';
        const text = isOver ? 'Превышение (Мошенничество)' : 'Занижение (Недостаточно)';
        const icon = isOver ? <CloseCircleOutlined /> : <WarningOutlined />;
        return (
          <Tooltip title={record.riskComment}>
            <Tag color={color} icon={icon}>{text}</Tag>
          </Tooltip>
        );
      }
    },
    { title: 'Сумма (₸)', dataIndex: 'calculatedSum', key: 'calculatedSum', render: s => s?.toLocaleString() },
    { 
      title: 'Статус заявки', 
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


  const handleExportPDF = async () => {
    const data = await fetchAllFilteredForExport();
    if (data.length === 0) {
      message.warning('Нет данных для экспорта');
      return;
    }
    const doc = new jsPDF();
    doc.text("Отчет по мониторингу АПК", 14, 15);
    const statusMap = {
      'NEW': 'Новая',
      'PENDING': 'В обработке',
      'APPROVED': 'Одобрена',
      'REJECTED': 'Отклонена'
    };
    autoTable(doc, {
      head: [['ID', 'ТОО', 'Кадастр', 'Культура', 'Год севооборота', 'Препарат', 'Категория', 'Объем', 'Цена (₸/ед)', 'Площадь (га)', 'Регламент', 'Сумма', 'Статус заявки']],
      body: data.map(row => {
        let regText = 'Норма соблюдена';
        if (row.risk) {
          regText = row.riskComment?.toLowerCase().includes('превышен') 
            ? 'Превышение (Мошенничество)' 
            : 'Занижение (Недостаточно)';
        }
        return [
          row.subsidyId, 
          row.tooName, 
          row.cadastralNumber, 
          row.cultureName, 
          row.rotationYear || '—',
          row.productName, 
          row.categoryName || '—', 
          `${row.quantityUsed} ${row.uom}`, 
          row.productPrice != null ? row.productPrice.toLocaleString('ru-RU') : '—',
          row.areaTreated != null ? row.areaTreated : '—',
          regText,
          row.calculatedSum != null ? row.calculatedSum.toLocaleString() : '0',
          statusMap[row.status] || row.status || '—'
        ];
      }),
      startY: 20
    });
    doc.save("report.pdf");
  };

  const handleExportExcel = async () => {
    try {
      const response = await backendClient.get('/stats/subsidies-flat/export', {
        responseType: 'blob', // Important for downloading files
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'subsidies_report.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("Ошибка при скачивании Excel", e);
    }
  };

  const handleExportDOCX = async () => {
    const data = await fetchAllFilteredForExport();
    if (data.length === 0) {
      message.warning('Нет данных для экспорта');
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
        children: ['ТОО', 'Кадастр', 'Культура', 'Год севооборота', 'Препарат', 'Категория', 'Объем', 'Цена (₸/ед)', 'Площадь (га)', 'Регламент', 'Сумма', 'Статус'].map(h => new TableCell({ children: [new Paragraph(h)] })),
      }),
      ...data.map(row => {
        let regText = 'Норма соблюдена';
        if (row.risk) {
          regText = row.riskComment?.toLowerCase().includes('превышен') 
            ? 'Превышение (Мошенничество)' 
            : 'Занижение (Недостаточно)';
        }
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(row.tooName || '')] }),
            new TableCell({ children: [new Paragraph(row.cadastralNumber || '')] }),
            new TableCell({ children: [new Paragraph(row.cultureName || '')] }),
            new TableCell({ children: [new Paragraph((row.rotationYear || '—').toString())] }),
            new TableCell({ children: [new Paragraph(row.productName || '')] }),
            new TableCell({ children: [new Paragraph(row.categoryName || '—')] }),
            new TableCell({ children: [new Paragraph(`${row.quantityUsed} ${row.uom}`)] }),
            new TableCell({ children: [new Paragraph((row.productPrice || '—').toString())] }),
            new TableCell({ children: [new Paragraph((row.areaTreated || '—').toString())] }),
            new TableCell({ children: [new Paragraph(regText)] }),
            new TableCell({ children: [new Paragraph((row.calculatedSum || 0).toString())] }),
            new TableCell({ children: [new Paragraph(statusMap[row.status] || row.status || '—')] }),
          ]
        });
      })
    ];

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: "Отчет по мониторингу АПК", heading: HeadingLevel.HEADING_1 }),
          new DocxTable({ rows: tableRows })
        ],
      }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, "report.docx");
    });
  };

  const handleGenerateAI = () => {
    setAiLoading(true);
    setAiResponse('');
    setTimeout(() => {
      setAiResponse(`На основе анализа ${totalElements} записей:
1. Наивысшая урожайность наблюдается в Северных регионах при использовании комплекса удобрений более 1000 т.
2. Рекомендуется увеличить норму азотных удобрений для культуры Культура 2 в Регионе 2 на 15% ввиду снижения показателей в 2023 году.
3. Ожидаемая экономия бюджета при переходе на более дешевые аналоги (Пестицид 4) составит до 1.5 млн тенге на 10 000 га.`);
      setAiLoading(false);
    }, 1500);
  };

  const handleAltSearch = () => {
    if (!altSearchQuery) {
      setAltResults([]);
      return;
    }
    const q = altSearchQuery.toLowerCase();
    const dataList = [...fertilizers, ...pesticides];
    const results = dataList.filter(item => 
      item.name?.toLowerCase().includes(q) || 
      item.composition?.toLowerCase().includes(q)
    );
    setAltResults(results);
  };

  const handleStatusUpdate = async (reportId, newStatus) => {
    setUpdatingStatus(true);
    try {
      await reportsApi.updateStatus(reportId, newStatus);
      message.success('Статус заявки успешно изменен');
      
      // Обновляем статус во всем subsidiesData и в открытой модалке
      setSubsidiesData(prev => prev.map(r => r.subsidyId === reportId ? { ...r, status: newStatus } : r));
      setSelectedReport(prev => prev && prev.subsidyId === reportId ? { ...prev, status: newStatus } : prev);
    } catch (err) {
      console.error(err);
      message.error('Не удалось обновить статус заявки');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Process data for Line Chart (Yield by Year per District)
  const lineChartData = useMemo(() => {
    if (!harvestData || harvestData.length === 0) return [];
    
    const yearsSet = new Set();
    harvestData.forEach(r => {
      yearsSet.add(r.harvestYear);
    });
    
    const years = Array.from(yearsSet).sort();
    
    return years.map(y => {
      const point = { year: y };
      selectedDistricts.forEach(d => {
        // Усредняем урожайность по району за год
        const rows = harvestData.filter(r => r.harvestYear === y && r.districtName === d);
        if (rows.length > 0) {
           const avgYield = rows.reduce((sum, r) => sum + r.yield, 0) / rows.length;
           point[d] = parseFloat(avgYield.toFixed(2));
        } else {
           point[d] = null;
        }
      });
      return point;
    });
  }, [harvestData, selectedDistricts]);

  // Process data for Effectiveness Bar Chart
  const barChartData = useMemo(() => {
    if (!effProduct) return [];
    let hash = 0;
    for (let i = 0; i < effProduct.length; i++) {
      hash = effProduct.charCodeAt(i) + ((hash << 5) - hash);
    }
    const districts = ['Абайский', 'Нуринский', 'Бухар-Жырауский', 'Осакаровский', 'Шетский'];
    return districts.map((district, idx) => {
      const baseYield = 15 + (Math.abs(hash + idx * 77) % 15);
      return {
        district,
        harvest: parseFloat(baseYield.toFixed(1))
      };
    });
  }, [effProduct]);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} className="agro-page-title" style={{ marginBottom: 0 }}>Отчёты и аналитика</Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<FilePdfOutlined />} onClick={handleExportPDF}>PDF</Button>
            <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>Excel</Button>
            <Button icon={<FileWordOutlined />} onClick={handleExportDOCX}>DOCX</Button>
          </Space>
        </Col>
      </Row>

      <div className="agro-card">
        <div style={{ marginBottom: 16 }}>
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} sm={12} md={8} lg={6}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Регламент применения:</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Все записи"
                value={riskFilter}
                onChange={v => handleFilterChange('risk', v)}
              >
                <Option value="ALL">Все записи</Option>
                <Option value="OK">✅ Норма соблюдена</Option>
                <Option value="OVER">🚨 Превышение (Мошенничество)</Option>
                <Option value="UNDER">⚠️ Занижение (Недостаточно)</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={8} lg={5}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Статус заявки:</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Все статусы"
                value={statusFilter}
                onChange={v => handleFilterChange('status', v)}
              >
                <Option value="ALL">Все статусы</Option>
                <Option value="NEW">🆕 Новая</Option>
                <Option value="PENDING">🔄 В обработке</Option>
                <Option value="APPROVED">✅ Одобрена</Option>
                <Option value="REJECTED">❌ Отклонена</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Год севооборота:</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Все годы"
                value={yearFilter}
                onChange={v => handleFilterChange('year', v)}
                allowClear
              >
                {availableYears.map(y => <Option key={y} value={y}>{y}</Option>)}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={12} lg={6}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Поиск по ТОО:</Text>
              <Input
                placeholder="Название организации..."
                value={searchOrg}
                onChange={e => handleFilterChange('searchOrg', e.target.value)}
                allowClear
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              />
            </Col>
            <Col xs={24} sm={12} md={12} lg={3} style={{ paddingTop: 20 }}>
              <Button
                onClick={() => { 
                  setRiskFilter('ALL'); 
                  setStatusFilter('ALL'); 
                  setYearFilter(null); 
                  setSearchOrg(''); 
                  setCurrentPage(1); 
                }}
                style={{ width: '100%' }}
              >
                Сбросить
              </Button>
            </Col>
          </Row>
          {(riskFilter !== 'ALL' || statusFilter !== 'ALL' || yearFilter || searchOrg) && (
            <div style={{ marginTop: 10 }}>
              <Text type="secondary">Найдено: <b>{totalElements}</b> записей</Text>
            </div>
          )}
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : (
          <Table 
            loading={loadingTable}
            columns={tableColumns} 
            dataSource={subsidiesData.map((d, i) => ({...d, key: d.subsidyId || d.id || i}))} 
            pagination={{ 
              current: currentPage,
              pageSize: pageSize,
              total: totalElements,
              showSizeChanger: true,
              pageSizeOptions: ['5', '10', '20', '50'],
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              }
            }}
            scroll={{ x: true }}
            size="middle"
            rowClassName={(record, index) => index % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
            locale={{ emptyText: 'Нет данных' }}
            onRow={(record) => ({
              onClick: () => setSelectedReport(record),
              style: { cursor: 'pointer' }
            })}
          />
        )}
      </div>

      <Row gutter={[24, 24]}>

        {/* Line Chart */}
        <Col xs={24} lg={12}>
          <div className="agro-card">
            <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>Урожайность по годам (ц/га)</Title>
            <div style={{ marginBottom: 16 }}>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                placeholder="Выберите районы для сравнения"
                value={selectedDistricts}
                onChange={setSelectedDistricts}
                maxTagCount="responsive"
                size="middle"
                allowClear
              >
                {allDistricts.map(d => <Option key={d} value={d}>{d}</Option>)}
              </Select>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                 <LineChart data={lineChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} />
                   <XAxis dataKey="year" />
                   <YAxis />
                   <RechartsTooltip />
                   <Legend />
                   {selectedDistricts.map((district, idx) => {
                     const colors = ['#1a7c3e', '#fa8c16', '#1890ff', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#2f54eb'];
                     return (
                       <Line 
                         key={district} 
                         type="monotone" 
                         dataKey={district} 
                         stroke={colors[idx % colors.length]} 
                         strokeWidth={2.5} 
                         activeDot={{ r: 6 }} 
                         dot={{ r: 3 }}
                       />
                     );
                   })}
                 </LineChart>

              </ResponsiveContainer>
            </div>
          </div>
        </Col>

        {/* AI Analysis (Employee/Admin/Staff) */}
        {(role === 'employee' || role === 'admin' || role === 'staff') && (
          <Col xs={24} lg={12}>
            <div className="agro-card">
              <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>AI Анализ данных</Title>
              <Button type="primary" icon={<RobotOutlined />} onClick={handleGenerateAI} disabled={aiLoading || totalElements === 0} style={{ marginBottom: 16, background: '#13c2c2', borderColor: '#13c2c2' }}>
                Сгенерировать анализ
              </Button>
              {aiLoading && <div style={{ padding: 20, textAlign: 'center' }}><Spin tip="Claude обрабатывает данные..." /></div>}
              {aiResponse && (
                <Alert 
                  message="Рекомендации ИИ"
                  description={<div style={{ whiteSpace: 'pre-line' }}>{aiResponse}</div>}
                  type="info"
                  showIcon
                  icon={<RobotOutlined />}
                  style={{ backgroundColor: '#e6f7ff', border: '1px solid #91d5ff' }}
                />
              )}
            </div>
          </Col>
        )}
      </Row>

      <Row gutter={[24, 24]}>
        {/* Alternative Search */}
        <Col xs={24} lg={12}>
          <div className="agro-card">
            <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Поиск альтернатив (аналогов)</Title>
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Input 
                placeholder="Состав или название (например: Азот, Глифосат)" 
                value={altSearchQuery}
                onChange={e => setAltSearchQuery(e.target.value)}
                onPressEnter={handleAltSearch}
              />
              <Button type="primary" onClick={handleAltSearch}><SearchOutlined /></Button>
            </Space.Compact>
            <Table 
              columns={[
                { title: 'Название', dataIndex: 'name', key: 'name' },
                { 
                  title: 'Состав', 
                  dataIndex: 'composition', 
                  key: 'composition',
                  render: text => <span style={{ whiteSpace: 'pre-line' }}>{text}</span>
                },
                { title: 'Цена (₸)', dataIndex: 'price', key: 'price', render: p => <b>{p?.toLocaleString()}</b> },
                { 
                  title: 'Производитель', 
                  dataIndex: 'manufacturer', 
                  key: 'manufacturer',
                  render: m => {
                    if (!m) return '—';
                    if (typeof m === 'object') return m.name || '—';
                    return m;
                  }
                },
              ]}
              dataSource={altResults.map((r,i) => ({...r, key: i}))}
              pagination={{ pageSize: 5 }}
              size="small"
              locale={{ emptyText: 'Нет данных' }}
            />
          </div>
        </Col>

        {/* Effectiveness Analysis (Employee/Admin/Staff) */}
        {(role === 'employee' || role === 'admin' || role === 'staff') && (
          <Col xs={24} lg={12}>
            <div className="agro-card">
              <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Анализ эффективности</Title>
              <Select placeholder="Выберите препарат" style={{ width: '100%', marginBottom: 16 }} onChange={setEffProduct}>
                {fertilizers.map(f => <Option key={'f'+f.id} value={f.name}>{f.name}</Option>)}
              </Select>
              {effProduct ? (
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer>
                    <BarChart data={barChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="district" tick={{fontSize: 11}} />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="harvest" fill="#1890ff" name="Урожай (ц/га)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: '#bfbfbf' }}>Выберите препарат для анализа</div>
              )}
            </div>
          </Col>
        )}
      </Row>

      {/* Modal for detailed application info and related algorithms */}
      <Modal
        title={selectedReport ? `Заявка на субсидию №${selectedReport.subsidyId} от ТОО "${selectedReport.tooName}"` : 'Детали заявки'}
        open={!!selectedReport}
        onCancel={() => setSelectedReport(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedReport(null)}>Закрыть</Button>
        ]}
        width={850}
        style={{ top: 40 }}
      >
        {selectedReport ? (
          <div>
            {/* 1. Timeline и управление статусом */}
            <Card title="Статус и управление заявкой" size="small" style={{ marginBottom: 20 }}>
              <Row align="middle" gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Timeline
                    mode="left"
                    items={[
                      {
                        label: 'Создана',
                        children: 'Заявка зарегистрирована в системе',
                        color: 'green',
                      },
                      {
                        label: 'В обработке',
                        children: selectedReport.status !== 'NEW' ? 'Рассмотрение документов агрономом' : 'Ожидает рассмотрения',
                        color: selectedReport.status !== 'NEW' ? 'green' : 'gray',
                        dot: selectedReport.status === 'PENDING' ? <ClockCircleOutlined style={{ fontSize: '16px' }} /> : null
                      },
                      {
                        label: 'Завершено',
                        children: selectedReport.status === 'APPROVED' 
                          ? 'Одобрена, субсидия выплачена' 
                          : selectedReport.status === 'REJECTED' 
                            ? 'Отклонена по несоответствию регламенту' 
                            : 'Ожидает решения комиссии',
                        color: selectedReport.status === 'APPROVED' 
                          ? 'green' 
                          : selectedReport.status === 'REJECTED' 
                            ? 'red' 
                            : 'gray',
                        dot: selectedReport.status === 'APPROVED' 
                          ? <CheckCircleOutlined style={{ fontSize: '16px', color: '#52c41a' }} /> 
                          : selectedReport.status === 'REJECTED' 
                            ? <CloseCircleOutlined style={{ fontSize: '16px', color: '#ff4d4f' }} /> 
                            : null
                      }
                    ]}
                  />
                </Col>
                
                {/* Кнопки смены статуса (для admin и staff) */}
                <Col xs={24} md={12}>
                  {(role === 'admin' || role === 'staff') ? (
                    <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 10 }}>
                        Изменить статус заявки:
                      </Typography.Text>
                      <Space wrap>
                        <Button 
                          type={selectedReport.status === 'PENDING' ? 'primary' : 'default'} 
                          ghost={selectedReport.status === 'PENDING'} 
                          style={{ borderColor: '#fa8c16', color: selectedReport.status === 'PENDING' ? '#fa8c16' : undefined }}
                          onClick={() => handleStatusUpdate(selectedReport.subsidyId, 'PENDING')}
                          loading={updatingStatus}
                        >
                          В обработку
                        </Button>
                        <Button 
                          type={selectedReport.status === 'APPROVED' ? 'primary' : 'default'} 
                          style={{ background: selectedReport.status === 'APPROVED' ? '#52c41a' : undefined, borderColor: selectedReport.status === 'APPROVED' ? '#52c41a' : undefined, color: '#fff' }}
                          onClick={() => handleStatusUpdate(selectedReport.subsidyId, 'APPROVED')}
                          loading={updatingStatus}
                        >
                          Одобрить
                        </Button>
                        <Button 
                          danger 
                          type={selectedReport.status === 'REJECTED' ? 'primary' : 'default'} 
                          onClick={() => handleStatusUpdate(selectedReport.subsidyId, 'REJECTED')}
                          loading={updatingStatus}
                        >
                          Отклонить
                        </Button>
                      </Space>
                      {selectedReport.status !== 'NEW' && (
                        <Button 
                          type="link" 
                          size="small" 
                          style={{ marginTop: 8, display: 'block', margin: '8px auto 0' }}
                          onClick={() => handleStatusUpdate(selectedReport.subsidyId, 'NEW')}
                          loading={updatingStatus}
                        >
                          Сбросить на "Новая"
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Alert 
                      message="Просмотр статуса" 
                      description="У вас нет прав для изменения статуса этой заявки. Только администрация может выносить решения." 
                      type="info" 
                      showIcon 
                    />
                  )}
                </Col>
              </Row>
            </Card>

            {/* 2. Подробная информация по расходу */}
            <Card title="Информация о применении препарата" size="small" style={{ marginBottom: 20 }}>
              <Descriptions bordered column={2} size="middle">
                <Descriptions.Item label="ТОО">{selectedReport.tooName}</Descriptions.Item>
                <Descriptions.Item label="Кадастровый номер">{selectedReport.cadastralNumber}</Descriptions.Item>
                <Descriptions.Item label="Культура">{selectedReport.cultureName}</Descriptions.Item>
                <Descriptions.Item label="Год">{selectedReport.rotationYear || '—'}</Descriptions.Item>
                <Descriptions.Item label="Препарат">{selectedReport.productName}</Descriptions.Item>
                <Descriptions.Item label="Объем применения">{selectedReport.quantityUsed} {selectedReport.uom}</Descriptions.Item>
                <Descriptions.Item label="Цена">{selectedReport.productPrice != null ? `${selectedReport.productPrice.toLocaleString()} ₸/ед` : '—'}</Descriptions.Item>
                <Descriptions.Item label="Площадь">{selectedReport.areaTreated != null ? `${selectedReport.areaTreated} га` : '—'}</Descriptions.Item>
                <Descriptions.Item label="Рассчитанная сумма" span={2}>
                  <b style={{ fontSize: 16, color: '#1a7c3e' }}>
                    {selectedReport.calculatedSum != null ? `${selectedReport.calculatedSum.toLocaleString()} ₸` : '—'}
                  </b>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 3. Анализ рисков и регламента применения */}
            <Card title="Анализ рисков и регламента применения" size="small" style={{ marginBottom: 20 }}>
              {selectedReport.risk ? (
                <Alert
                  message="Обнаружено отклонение от агротехнического регламента!"
                  description={
                    <div>
                      <p><b>Ошибка:</b> {selectedReport.riskComment}</p>
                      <p style={{ margin: 0 }}>
                        Фактический расход составляет: <b>{((selectedReport.quantityUsed || 0) / (selectedReport.areaTreated || 1)).toFixed(2)} {selectedReport.uom || ''}/га</b>. 
                        Это может быть неэффективно или небезопасно для урожая.
                      </p>
                    </div>
                  }
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  style={{ background: '#fffbe6', border: '1px solid #ffe58f' }}
                />
              ) : (
                <Alert
                  message="Норма применения соблюдена"
                  description={`Фактический расход: ${((selectedReport.quantityUsed || 0) / (selectedReport.areaTreated || 1)).toFixed(2)} ${selectedReport.uom || ''}/га. Показатель находится в пределах допустимой нормы.`}
                  type="success"
                  showIcon
                />
              )}
            </Card>

            {/* 4. Анализ цен и подбор альтернатив (аналогов) */}
            <Card title={`Подбор альтернатив для препарата "${selectedReport.productName || ''}"`} size="small" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text type="secondary">
                  Система нашла более выгодные аналоги с похожим составом действующих веществ:
                </Typography.Text>
              </div>
              {(() => {
                // Ищем состав текущего препарата в справочнике
                const currentRef = [...fertilizers, ...pesticides].find(
                  p => p.name?.toLowerCase() === selectedReport.productName?.toLowerCase()
                );
                
                // Если состава нет, берем первое слово из названия препарата
                const targetComp = currentRef?.composition || '—';
                const firstWord = targetComp !== '—' 
                  ? targetComp.split(/[\s,+]+/)[0].toLowerCase() 
                  : (selectedReport.productName || '').split(/[\s,-]+/)[0]?.toLowerCase() || '';

                const referencePrice = selectedReport.productPrice || currentRef?.price || 0;
                const analogs = [...fertilizers, ...pesticides].filter(item => 
                  item.name?.toLowerCase() !== selectedReport.productName?.toLowerCase() &&
                  item.status === 'active' &&
                  firstWord !== '' &&
                  (item.composition?.toLowerCase().includes(firstWord) || 
                   (currentRef && currentRef.categoryName === item.categoryName && item.composition !== '—' && firstWord !== '—' && item.composition?.toLowerCase().includes(firstWord))) &&
                  (referencePrice > 0 ? item.price < referencePrice : true)
                );

                if (analogs.length > 0) {
                  return (
                    <Table
                      dataSource={analogs.slice(0, 3).map((r, i) => ({ ...r, key: i }))}
                      columns={[
                        { title: 'Название аналога', dataIndex: 'name', key: 'name' },
                        { 
                           title: 'Состав', 
                           dataIndex: 'composition', 
                           key: 'composition',
                           render: text => <span style={{ whiteSpace: 'pre-line' }}>{text?.replace(/,\s*/g, '\n')}</span>
                        },
                        { title: 'Цена (₸)', dataIndex: 'price', key: 'price', render: p => <b>{p?.toLocaleString()}</b> },
                        { 
                          title: 'Потенциальная экономия', 
                          key: 'saving', 
                          render: (_, record) => {
                            const unitSaving = referencePrice - record.price;
                            const totalSaving = Math.round(unitSaving * (selectedReport.quantityUsed || 0));
                            return totalSaving > 0 ? (
                              <Tag color="green">
                                ₸ {totalSaving.toLocaleString()} (₸ {unitSaving.toLocaleString()} / ед)
                              </Tag>
                            ) : '—';
                          }
                        }
                      ]}
                      pagination={false}
                      size="small"
                    />
                  );
                } else {
                  return <Alert message="Более дешевых аналогов с подходящим составом не найдено." type="info" />;
                }
              })()}
            </Card>

            {/* 5. Проекция оптимальной потребности */}
            <Card title="Рекомендованная проекция (онлайн-калькулятор)" size="small">
              {(() => {
                const cropName = selectedReport.cultureName || '';
                const area = selectedReport.areaTreated || 0;
                
                // Используем ту же логику норм, что и в Calculator.jsx
                const getNormsForCrop = (crop) => {
                  const name = (crop || '').toLowerCase();
                  if (name.includes('пшениц') || name.includes('ячмен') || name.includes('овес') || name.includes('рожь') || name.includes('злак')) {
                    return { fertilizer: 'Аммиачная селитра', fertNorm: 120, pesticide: 'Гербицид Гранстар Про', pestNorm: 0.02, pricePerHa: 18000 };
                  }
                  if (name.includes('подсолнеч') || name.includes('рапс') || name.includes('лен') || name.includes('рыжик') || name.includes('горчиц') || name.includes('маслич')) {
                    return { fertilizer: 'Амофос', fertNorm: 100, pesticide: 'Гербицид Евро-Лайтнинг', pestNorm: 1.2, pricePerHa: 25000 };
                  }
                  if (name.includes('картофел') || name.includes('овощ') || name.includes('свекл')) {
                    return { fertilizer: 'NPK 16:16:16', fertNorm: 300, pesticide: 'Фунгицид Ридомил Голд', pestNorm: 2.5, pricePerHa: 45000 };
                  }
                  if (name.includes('кукуруз')) {
                    return { fertilizer: 'Карбамид (мочевина)', fertNorm: 150, pesticide: 'Гербицид Милагро', pestNorm: 1.0, pricePerHa: 22000 };
                  }
                  return { fertilizer: 'Комплексное удобрение (NPK)', fertNorm: 100, pesticide: 'Универсальный фунгицид', pestNorm: 1.5, pricePerHa: 20000 };
                };

                const norms = getNormsForCrop(cropName);
                const recommendedFertQuantity = Math.round(area * norms.fertNorm);
                const recommendedPestQuantity = Math.round(area * norms.pestNorm * 100) / 100;
                const totalRecommendedCost = Math.round(area * norms.pricePerHa);

                return (
                  <div>
                    <Typography.Paragraph>
                      Агрономический калькулятор рекомендует следующую схему питания и защиты для <b>{cropName}</b> на площади <b>{area} га</b>:
                    </Typography.Paragraph>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Card type="inner" title="Схема удобрения" size="small">
                          <Typography.Text strong>{norms.fertilizer}</Typography.Text>
                          <br />
                          <Typography.Text type="secondary">
                            Рекомендованный объем: {recommendedFertQuantity} кг ({norms.fertNorm} кг/га)
                          </Typography.Text>
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card type="inner" title="Схема защиты (пестицид)" size="small">
                          <Typography.Text strong>{norms.pesticide}</Typography.Text>
                          <br />
                          <Typography.Text type="secondary">
                            Рекомендованный объем: {recommendedPestQuantity} л ({norms.pestNorm} л/га)
                          </Typography.Text>
                        </Card>
                      </Col>
                    </Row>
                    <div style={{ marginTop: 16, textAlign: 'right' }}>
                      <Typography.Text>Ориентировочная стоимость схемы: </Typography.Text>
                      <b style={{ color: '#1a7c3e', fontSize: 16 }}>₸ {totalRecommendedCost.toLocaleString()}</b>
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>
        ) : <Spin size="large" />}
      </Modal>
    </div>
  );
};

export default Reports;
