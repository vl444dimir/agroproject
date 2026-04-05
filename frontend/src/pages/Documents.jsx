import { useState } from 'react';
import { Typography, Upload, Table, Tag, Alert, Card, Steps, message, Modal, Button } from 'antd';
import { InboxOutlined, LockOutlined, FileExcelOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { MOCK_DOCUMENTS, MOCK_SUPPLY_CHAIN } from '../mock';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const Documents = () => {
  const { role } = useAuth();
  const [docs, setDocs] = useState(MOCK_DOCUMENTS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [parsedData, setParsedData] = useState([]);

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

  const handleFileUpload = (file) => {
    if (!file.name.endsWith('.xlsx')) {
      message.error('Разрешены только файлы Excel (.xlsx)');
      return Upload.LIST_IGNORE;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Читаем Excel в JSON массив объектов (1-я строка таблицы = ключи)
        const json = XLSX.utils.sheet_to_json(worksheet);
        
        const newDoc = {
          id: Date.now(),
          name: file.name,
          date: new Date().toLocaleDateString('ru-RU'),
          status: 'pending',
          alert: false,
          parsedData: json
        };
        
        setDocs([newDoc, ...docs]);
        message.success(`${file.name} успешно загружен и распарсен на клиенте!`);
      } catch (err) {
        console.error(err);
        message.error('Ошибка чтения файла Excel. Убедитесь в правильности формата.');
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Возвращаем false, чтобы предотвратить дефолтную физическую загрузку Ant Design (post-запрос)
    return false; 
  };

  const showParsedData = (doc) => {
    if (!doc.parsedData || doc.parsedData.length === 0) {
      message.warning('Файл пуст или формат не поддерживается');
      return;
    }
    setParsedData(doc.parsedData);
    setModalTitle(`Анализ ЭСФ: ${doc.name}`);
    setIsModalOpen(true);
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
        const labels = { verified: 'Подтвержден', discrepancy: 'Расхождение', pending: 'Анализ (ИИ)' };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      }
    },
    {
      title: 'Просмотр (Парсинг)',
      key: 'actions',
      render: (_, record) => (
        record.parsedData ? (
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showParsedData(record)}>
            JSON данные
          </Button>
        ) : (
           <Text type="secondary" style={{fontSize: 12}}>Оригинальный макет</Text>
        )
      )
    }
  ];

  // Динамически генерируем колонки для модального окна просмотра Excel таблицы
  const getModalColumns = () => {
    if (!parsedData || parsedData.length === 0) return [];
    const keys = Object.keys(parsedData[0]);
    return keys.map(key => ({
      title: key,
      dataIndex: key,
      key: key,
      ellipsis: true
    }));
  };

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
        <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Парсинг и загрузка ЭСФ (Excel)</Title>
        <Dragger 
          name="file" 
          multiple={false} 
          accept=".xlsx"
          beforeUpload={handleFileUpload}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: '#1a7c3e' }} /></p>
          <p className="ant-upload-text">Нажмите или перетащите файл Excel (ЭСФ) в эту область</p>
          <p className="ant-upload-hint">Файл будет автоматически разобран на клиенте в JSON для отправки на сервер</p>
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

      <Modal
        title={modalTitle}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={[
          <Button key="submit" type="primary" onClick={() => setIsModalOpen(false)}>
            Отправить JSON на сервер
          </Button>
        ]}
        width={900}
      >
        <Alert 
          message="Файл успешно стянут в JSON. Именно этот массив объектов будет передан API для включения алгоритмов ИИ." 
          type="success" 
          showIcon 
          style={{ marginBottom: 16 }} 
        />
        <Table 
          columns={getModalColumns()} 
          dataSource={parsedData.map((row, i) => ({ ...row, key: i }))}
          size="small"
          scroll={{ x: true, y: 300 }}
          pagination={{ pageSize: 50 }}
        />
      </Modal>
    </div>
  );
};

export default Documents;
