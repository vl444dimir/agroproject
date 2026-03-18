import { useState } from 'react';
import { Typography, Upload, Table, Tag, Alert, Card, Steps, message } from 'antd';
import { InboxOutlined, LockOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { MOCK_DOCUMENTS, MOCK_SUPPLY_CHAIN } from '../mock';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const Documents = () => {
  const { role } = useAuth();
  const [docs, setDocs] = useState(MOCK_DOCUMENTS);

  if (role === 'user' || !role) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <LockOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
        <Title level={3}>Отказано в доступе</Title>
        <Text type="secondary">У вас нет прав для просмотра этого раздела.</Text>
      </div>
    );
  }

  const hasAlerts = docs.some(d => d.alert);

  const handleUpload = (info) => {
    const { status, name } = info.file;
    if (status !== 'uploading') {
      if (!name.endsWith('.xlsx')) {
        message.error('Разрешены только файлы Excel (.xlsx)');
        return;
      }
      const newDoc = {
        id: Date.now(),
        name: name,
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        alert: false
      };
      setDocs([newDoc, ...docs]);
      message.success(`${name} успешно загружен.`);
    }
  };

  const docColumns = [
    { 
      title: 'Файл', 
      dataIndex: 'name', 
      key: 'name',
      render: text => <><FileExcelOutlined style={{ color: '#107c41', marginRight: 8 }}/>{text}</>
    },
    { title: 'Дата загрузки', dataIndex: 'date', key: 'date' },
    { 
      title: 'Статус', 
      dataIndex: 'status', 
      key: 'status',
      render: status => {
        const colors = { verified: 'green', discrepancy: 'red', pending: 'orange' };
        const labels = { verified: 'Подтвержден', discrepancy: 'Расхождение', pending: 'В обработке' };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      }
    }
  ];

  return (
    <div>
      <Title level={2} className="agro-page-title">Управление документами</Title>

      {hasAlerts && (
        <Alert
          message="⚠️ Обнаружено расхождение в счёт-фактуре. Требуется проверка."
          type="error"
          showIcon
          style={{ marginBottom: 24, fontWeight: 'bold' }}
        />
      )}

      <div className="agro-card">
        <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Загрузка ЭСФ</Title>
        <Dragger 
          name="file" 
          multiple={false} 
          accept=".xlsx"
          customRequest={({ onSuccess }) => setTimeout(() => onSuccess("ok"), 500)}
          onChange={handleUpload}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: '#1a7c3e' }} /></p>
          <p className="ant-upload-text">Нажмите или перетащите файл Excel в эту область</p>
          <p className="ant-upload-hint">Поддерживается только формат .xlsx</p>
        </Dragger>

        <Table 
          columns={docColumns} 
          dataSource={docs.map(d => ({...d, key: d.id}))} 
          pagination={false} 
          style={{ marginTop: 24 }}
          size="middle"
        />
      </div>

      <div className="agro-card">
        <Title level={4} style={{ marginTop: 0, marginBottom: 24 }}>Анализ цепочки поставок</Title>
        {MOCK_SUPPLY_CHAIN.map((chain, idx) => {
          const items = [
            { title: 'Поставщик', description: chain.supplier },
            { title: 'Посредник', description: chain.intermediary1 },
          ];
          if (chain.intermediary2) {
            items.push({ title: 'Посредник', description: chain.intermediary2 });
          }
          items.push({ title: 'Покупатель', description: chain.buyer });

          return (
            <Card type="inner" title={`Отслеживание партии #${idx + 1}`} extra={<Tag color="volcano">Наценка: {chain.markupTotal}%</Tag>} style={{ marginBottom: 16 }} key={idx}>
              <Steps current={items.length} items={items} labelPlacement="vertical" size="small" />
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Documents;
