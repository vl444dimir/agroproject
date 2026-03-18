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
import { MOCK_REPORTS, MOCK_FERTILIZERS_REF, MOCK_PESTICIDES_REF } from '../mock';

const { Title, Text } = Typography;
const { Option } = Select;

const Reports = () => {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [filterRegion, setFilterRegion] = useState(null);
  const [filterYear, setFilterYear] = useState(null);
  const [filterCrop, setFilterCrop] = useState(null);
  const [filteredData, setFilteredData] = useState([]);
  
  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  
  // Alternative Search State
  const [altSearchQuery, setAltSearchQuery] = useState('');
  const [altResults, setAltResults] = useState([]);

  // Effectiveness State
  const [effProduct, setEffProduct] = useState(null);

  useEffect(() => {
    applyFilters();
  }, []);

  const applyFilters = () => {
    setLoading(true);
    setTimeout(() => {
      let data = [...MOCK_REPORTS];
      if (filterRegion) data = data.filter(d => d.district === filterRegion);
      if (filterYear) data = data.filter(d => d.year === parseInt(filterYear));
      if (filterCrop) data = data.filter(d => d.crop === filterCrop);
      setFilteredData(data);
      setLoading(false);
    }, 800);
  };

  const tableColumns = [
    { title: 'Район', dataIndex: 'district', key: 'district', sorter: (a,b) => a.district.localeCompare(b.district) },
    { title: 'Культура', dataIndex: 'crop', key: 'crop', sorter: (a,b) => a.crop.localeCompare(b.crop) },
    { title: 'Площадь (га)', dataIndex: 'area', key: 'area', sorter: (a,b) => a.area - b.area },
    { title: 'Урожай (ц/га)', dataIndex: 'harvest', key: 'harvest', sorter: (a,b) => a.harvest - b.harvest },
    { title: 'Удобрения (т)', dataIndex: 'fertilizers', key: 'fertilizers', sorter: (a,b) => a.fertilizers - b.fertilizers },
    { title: 'Пестициды (л)', dataIndex: 'pesticides', key: 'pesticides', sorter: (a,b) => a.pesticides - b.pesticides },
    { title: 'Год', dataIndex: 'year', key: 'year', sorter: (a,b) => a.year - b.year },
  ];

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Отчет по мониторингу АПК", 14, 15);
    doc.autoTable({
      head: [['Район', 'Культура', 'Площадь', 'Урожай', 'Удобрения', 'Пестициды', 'Год']],
      body: filteredData.map(row => [row.district, row.crop, row.area, row.harvest, row.fertilizers, row.pesticides, row.year]),
      startY: 20
    });
    doc.save("report.pdf");
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reports");
    XLSX.writeFile(wb, "report.xlsx");
  };

  const handleExportDOCX = async () => {
    const tableRows = [
      new TableRow({
        children: ['Район', 'Культура', 'Площадь', 'Урожай', 'Год'].map(h => new TableCell({ children: [new Paragraph(h)] })),
      }),
      ...filteredData.map(row => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(row.district)] }),
          new TableCell({ children: [new Paragraph(row.crop)] }),
          new TableCell({ children: [new Paragraph(row.area.toString())] }),
          new TableCell({ children: [new Paragraph(row.harvest.toString())] }),
          new TableCell({ children: [new Paragraph(row.year.toString())] }),
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
      setAiResponse(`На основе анализа ${filteredData.length} записей:
1. Наивысшая урожайность наблюдается в Северных регионах при использовании комплекса удобрений более 1000 т.
2. Рекомендуется увеличить норму азотных удобрений для ячменя в Костанайской области на 15% ввиду снижения показателей в 2023 году.
3. Ожидаемая экономия бюджета при переходе на более дешевые аналоги Каратэ составит до 1.5 млн тенге на 10 000 га.`);
      setAiLoading(false);
    }, 1500);
  };

  const handleAltSearch = () => {
    if (!altSearchQuery) return;
    const q = altSearchQuery.toLowerCase();
    const refs = [...MOCK_FERTILIZERS_REF, ...MOCK_PESTICIDES_REF];
    const matches = refs.filter(r => r.composition.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    matches.sort((a,b) => a.price - b.price); // Sort by price cheapest first
    setAltResults(matches);
  };

  // Process data for Line Chart (Yield by Year per District)
  const lineChartData = useMemo(() => {
    const years = [2022, 2023, 2024];
    const districts = [...new Set(MOCK_REPORTS.map(r => r.district))];
    return years.map(y => {
      const point = { year: y };
      districts.forEach(d => {
        const row = MOCK_REPORTS.find(r => r.year === y && r.district === d);
        point[d] = row ? row.harvest : null;
      });
      return point;
    });
  }, []);

  // Process data for Effectiveness Bar Chart
  const barChartData = [
    { district: 'Акмолинская', harvest: 22.1 },
    { district: 'Костанайская', harvest: 19.4 },
    { district: 'Северо-Каз.', harvest: 24.3 },
    { district: 'Павлодарская', harvest: 16.8 },
  ];

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
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={6} md={5}>
            <Select placeholder="Регион" style={{ width: '100%' }} allowClear onChange={setFilterRegion}>
              <Option value="Акмолинская">Акмолинская</Option>
              <Option value="Костанайская">Костанайская</Option>
              <Option value="Северо-Казахстанская">Северо-Казахстанская</Option>
              <Option value="Павлодарская">Павлодарская</Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} md={5}>
            <Select placeholder="Год" style={{ width: '100%' }} allowClear onChange={setFilterYear}>
              <Option value="2024">2024</Option>
              <Option value="2023">2023</Option>
              <Option value="2022">2022</Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} md={5}>
            <Select placeholder="Культура" style={{ width: '100%' }} allowClear onChange={setFilterCrop}>
              <Option value="Пшеница">Пшеница</Option>
              <Option value="Ячмень">Ячмень</Option>
              <Option value="Подсолнечник">Подсолнечник</Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Button type="primary" block onClick={applyFilters}>Применить</Button>
          </Col>
        </Row>

        {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : (
          <Table 
            columns={tableColumns} 
            dataSource={filteredData.map(d => ({...d, key: d.id}))} 
            pagination={{ pageSize: 5 }}
            scroll={{ x: true }}
            size="middle"
            rowClassName={(record, index) => index % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
            locale={{ emptyText: 'Нет данных по выбранным фильтрам' }}
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
                  <Line type="monotone" dataKey="Акмолинская" stroke="#1a7c3e" strokeWidth={2} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="Костанайская" stroke="#fa8c16" strokeWidth={2} />
                  <Line type="monotone" dataKey="Северо-Казахстанская" stroke="#1890ff" strokeWidth={2} />
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
              <Button type="primary" icon={<RobotOutlined />} onClick={handleGenerateAI} disabled={aiLoading || filteredData.length === 0} style={{ marginBottom: 16, background: '#13c2c2', borderColor: '#13c2c2' }}>
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
                { title: 'Цена (₸)', dataIndex: 'price', key: 'price', render: p => <b>{p.toLocaleString()}</b> },
                { title: 'Производитель', dataIndex: 'manufacturer', key: 'manufacturer' },
              ]}
              dataSource={altResults.map((r,i) => ({...r, key: i}))}
              pagination={false}
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
