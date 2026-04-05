import { useState } from 'react';
import { Typography, Table, Tag, Row, Col, DatePicker, Select, Button, Statistic, Card } from 'antd';
import { FileExcelOutlined, SearchOutlined, LockOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { MOCK_AUDIT_LOG } from '../mock';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const Audit = () => {
  const { role } = useAuth();
  
  const [filterDates, setFilterDates] = useState(null);
  const [filterAction, setFilterAction] = useState(null);

  if (role !== 'admin') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <LockOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
        <Title level={3}>Отказано в доступе</Title>
        <Text type="secondary">Просмотр журнала аудита доступен только администраторам.</Text>
      </div>
    );
  }

  let filteredData = [...(MOCK_AUDIT_LOG || [])];
  
  if (filterAction) {
    filteredData = filteredData.filter(item => item && item.action && item.action.includes(filterAction));
  }

  const parseDateHelper = (dStr) => {
    if (!dStr) return 0;
    if (dStr.includes('.')) {
      const parts = dStr.split(/[\sT\u202F\xA0]+/);
      const dP = parts[0];
      const tP = parts[1] || '00:00';
      const [d, m, y] = dP.split('.');
      const dt = new Date(`${y}-${m}-${d}T${tP}:00`);
      return isNaN(dt.getTime()) ? 0 : dt.getTime();
    }
    const dt = new Date(dStr);
    return isNaN(dt.getTime()) ? 0 : dt.getTime();
  };
  
  if (filterDates && filterDates[0] && filterDates[1]) {
    const startTm = filterDates[0].startOf('day').unix() * 1000;
    const endTm = filterDates[1].endOf('day').unix() * 1000;
    filteredData = filteredData.filter(item => {
      if (!item || !item.datetime) return false;
      const t = parseDateHelper(item.datetime);
      return t >= startTm && t <= endTm;
    });
  }

  // Sorting newest first
  filteredData.sort((a,b) => parseDateHelper(b?.datetime) - parseDateHelper(a?.datetime));

  const successCount = filteredData.filter(d => d && d.status === 'success').length;
  const failedCount = filteredData.filter(d => d && d.status === 'failed').length;

  const columns = [
    { title: 'Дата и время', dataIndex: 'datetime', key: 'datetime', width: 140 },
    { title: 'Пользователь', dataIndex: 'user', key: 'user', width: 120 },
    { title: 'Роль', dataIndex: 'role', key: 'role', width: 120 },
    { title: 'Действие', dataIndex: 'action', key: 'action' },
    { title: 'IP-адрес', dataIndex: 'ip', key: 'ip', width: 120 },
    { 
      title: 'Статус', 
      dataIndex: 'status', 
      key: 'status', 
      width: 100,
      render: (status) => (
        <Tag color={status === 'success' ? 'green' : 'red'}>{status === 'success' ? 'Успешно' : 'Ошибка'}</Tag>
      )
    },
  ];

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AuditLog");
    XLSX.writeFile(wb, "audit_log.xlsx");
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} className="agro-page-title" style={{ marginBottom: 0 }}>Журнал аудита</Title>
        </Col>
        <Col>
          <Button onClick={handleExportExcel} icon={<FileExcelOutlined />} type="primary" ghost>
            Экспорт в Excel
          </Button>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col span={8}><Card size="small"><Statistic title="Всего записей" value={filteredData.length} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Успешные действия" value={successCount} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Неудачные попытки" value={failedCount} valueStyle={{ color: '#cf1322' }} /></Card></Col>
      </Row>

      <div className="agro-card">
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={10}>
            <RangePicker style={{ width: '100%' }} onChange={setFilterDates} />
          </Col>
          <Col xs={24} sm={12} md={10}>
            <Select placeholder="Тип действия" style={{ width: '100%' }} allowClear onChange={setFilterAction}>
              <Option value="Вход">Входы в систему</Option>
              <Option value="Расчёт">Расчёты</Option>
              <Option value="Экспорт">Экспорт</Option>
              <Option value="Редактирование">Редактирование справочников</Option>
              <Option value="Удаление">Удаление записей</Option>
            </Select>
          </Col>
        </Row>

        <Table 
          columns={columns} 
          dataSource={filteredData.map(d => ({...d, key: d.id}))} 
          pagination={{ pageSize: 15 }}
          scroll={{ x: true }}
          size="small"
          rowClassName={(record) => record.status === 'failed' ? 'agro-row-failed' : ''}
          locale={{ emptyText: 'Нет записей' }}
        />
      </div>
    </div>
  );
};

export default Audit;
