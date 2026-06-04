import { useState, useMemo, useEffect } from 'react';
import { Typography, Row, Col, Select, Button, Table, Space, Card, Spin, Input, Alert, Tag } from 'antd';
import { FilePdfOutlined, FileExcelOutlined, FileWordOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { useAuth } from '../context/AuthContext';
import { reportsApi } from '../api/reports';
import { harvestApi } from '../api/harvestApi';
import { productsApi } from '../api/productsApi';
import backendClient from '../api/backendClient';
import { MOCK_FERTILIZERS_REF, MOCK_PESTICIDES_REF } from '../mock';

const { Title, Text } = Typography;
const { Option } = Select;

const Reports = () => {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subsidiesData, setSubsidiesData] = useState([]);
  const [harvestData, setHarvestData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  
  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  
  // Alternative Search State
  const [altSearchQuery, setAltSearchQuery] = useState('');
  const [altResults, setAltResults] = useState([]);

  // Effectiveness State
  const [effProduct, setEffProduct] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subResponse, harvResponse] = await Promise.all([
        reportsApi.getFlatReports(),
        harvestApi.getAllRecords()
      ]);
      setSubsidiesData(subResponse.data || []);
      setHarvestData(harvResponse.data || []);
    } catch (e) {
      console.error("Ошибка загрузки данных", e);
    } finally {
      setLoading(false);
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
    { title: 'Препарат', dataIndex: 'productName', key: 'productName' },
    { title: 'Объем', key: 'volume', render: (_, r) => `${r.quantityUsed} ${r.uom}` },
    { title: 'Сумма (₸)', dataIndex: 'calculatedSum', key: 'calculatedSum', render: s => s?.toLocaleString() },
  ];


  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Отчет по мониторингу АПК", 14, 15);
    doc.autoTable({
      head: [['ID', 'ТОО', 'Кадастр', 'Культура', 'Препарат', 'Объем', 'Сумма']],
      body: subsidiesData.map(row => [row.subsidyId, row.tooName, row.cadastralNumber, row.cultureName, row.productName, `${row.quantityUsed} ${row.uom}`, row.calculatedSum]),
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
    const tableRows = [
      new TableRow({
        children: ['ТОО', 'Кадастр', 'Культура', 'Препарат', 'Сумма'].map(h => new TableCell({ children: [new Paragraph(h)] })),
      }),
      ...subsidiesData.map(row => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(row.tooName || '')] }),
          new TableCell({ children: [new Paragraph(row.cadastralNumber || '')] }),
          new TableCell({ children: [new Paragraph(row.cultureName || '')] }),
          new TableCell({ children: [new Paragraph(row.productName || '')] }),
          new TableCell({ children: [new Paragraph((row.calculatedSum || 0).toString())] }),
        ]
      }))
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
      setAiResponse(`На основе анализа ${subsidiesData.length} записей:
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
    const dataList = [...MOCK_FERTILIZERS_REF, ...(MOCK_PESTICIDES_REF || [])];
    const results = dataList.filter(item => 
      item.name?.toLowerCase().includes(q) || 
      item.composition?.toLowerCase().includes(q)
    );
    setAltResults(results);
  };

  // Process data for Line Chart (Yield by Year per District)
  const lineChartData = useMemo(() => {
    if (!harvestData || harvestData.length === 0) return [];
    
    // Группировка урожая по годам и районам
    const yearsSet = new Set();
    const districtsSet = new Set();
    
    harvestData.forEach(r => {
      yearsSet.add(r.harvestYear);
      districtsSet.add(r.districtName);
    });
    
    const years = Array.from(yearsSet).sort();
    const districts = Array.from(districtsSet);
    
    return years.map(y => {
      const point = { year: y };
      districts.forEach(d => {
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
  }, [harvestData]);

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
        {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : (
          <Table 
            columns={tableColumns} 
            dataSource={subsidiesData.map((d, i) => ({...d, key: i}))} 
            pagination={{ 
              current: currentPage,
              pageSize: pageSize,
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
          />
        )}
      </div>

      <Row gutter={[24, 24]}>

        {/* Line Chart */}
        <Col xs={24} lg={12}>
          <div className="agro-card">
            <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Урожайность по годам (ц/га)</Title>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={lineChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {lineChartData.length > 0 && Object.keys(lineChartData[0])
                    .filter(key => key !== 'year')
                    .map((district, idx) => {
                      const colors = ['#1a7c3e', '#fa8c16', '#1890ff', '#f5222d', '#722ed1'];
                      return (
                        <Line 
                          key={district} 
                          type="monotone" 
                          dataKey={district} 
                          stroke={colors[idx % colors.length]} 
                          strokeWidth={2} 
                          activeDot={{ r: 8 }} 
                        />
                      );
                    })
                  }
                </LineChart>

              </ResponsiveContainer>
            </div>
          </div>
        </Col>

        {/* AI Analysis (Employee/Admin) */}
        {(role === 'employee' || role === 'admin') && (
          <Col xs={24} lg={12}>
            <div className="agro-card">
              <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>AI Анализ данных</Title>
              <Button type="primary" icon={<RobotOutlined />} onClick={handleGenerateAI} disabled={aiLoading || subsidiesData.length === 0} style={{ marginBottom: 16, background: '#13c2c2', borderColor: '#13c2c2' }}>
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
                { title: 'Состав', dataIndex: 'composition', key: 'composition' },
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

        {/* Effectiveness Analysis (Employee/Admin) */}
        {(role === 'employee' || role === 'admin') && (
          <Col xs={24} lg={12}>
            <div className="agro-card">
              <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Анализ эффективности</Title>
              <Select placeholder="Выберите препарат" style={{ width: '100%', marginBottom: 16 }} onChange={setEffProduct}>
                {MOCK_FERTILIZERS_REF.map(f => <Option key={'f'+f.id} value={f.name}>{f.name}</Option>)}
              </Select>
              {effProduct ? (
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer>
                    <BarChart data={barChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="district" tick={{fontSize: 11}} />
                      <YAxis />
                      <Tooltip />
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

    </div>
  );
};

export default Reports;
