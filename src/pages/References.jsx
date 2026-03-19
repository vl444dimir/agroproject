import { useState } from 'react';
import { Typography, Tabs, Table, Button, Input, Modal, Form, Space, InputNumber, Tag, Select, List, message, Row, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, CheckOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { MOCK_FERTILIZERS_REF, MOCK_PESTICIDES_REF } from '../mock';

const { Title, Text } = Typography;
const { Option } = Select;

const References = () => {
  const { role } = useAuth();
  
  // Инициализируем данные с меткой status
  const [fertData, setFertData] = useState(MOCK_FERTILIZERS_REF.map(f => ({ ...f, status: f.status || 'active' })));
  const [pestData, setPestData] = useState(MOCK_PESTICIDES_REF.map(p => ({ ...p, status: p.status || 'active' })));
  
  const [fertSearch, setFertSearch] = useState('');
  const [pestSearch, setPestSearch] = useState('');

  const [modalType, setModalType] = useState(null); // 'fert_add', 'fert_edit', 'pest_add', 'pest_edit'
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  // Состояния для поиска аналогов
  const [analogModalVisible, setAnalogModalVisible] = useState(false);
  const [analogType, setAnalogType] = useState('fert'); // 'fert' | 'pest'
  const [selectedForAnalog, setSelectedForAnalog] = useState(null);
  const [analogResults, setAnalogResults] = useState([]);

  const handleAddEdit = (values) => {
    // Пользователи создают записи со статусом "proposed" (На модерации)
    const newStatus = role === 'user' ? 'proposed' : 'active';
    const newItem = { ...values, id: Date.now(), status: newStatus };

    if (modalType === 'fert_add') {
      setFertData([newItem, ...fertData]);
      if (role === 'user') message.success('Предложение отправлено на модерацию');
    } else if (modalType === 'fert_edit') {
      setFertData(fertData.map(f => f.id === editingItem.id ? { ...f, ...values } : f));
    } else if (modalType === 'pest_add') {
      setPestData([newItem, ...pestData]);
      if (role === 'user') message.success('Предложение отправлено на модерацию');
    } else if (modalType === 'pest_edit') {
      setPestData(pestData.map(p => p.id === editingItem.id ? { ...p, ...values } : p));
    }
    setModalType(null);
    form.resetFields();
  };

  const openModal = (type, record = null) => {
    setModalType(type);
    setEditingItem(record);
    if (record) form.setFieldsValue(record);
    else form.resetFields();
  };

  const handleApprove = (type, id) => {
    if (type === 'fert') {
      setFertData(fertData.map(d => d.id === id ? { ...d, status: 'active' } : d));
    } else {
      setPestData(pestData.map(d => d.id === id ? { ...d, status: 'active' } : d));
    }
    message.success('Запись одобрена и добавлена в рабочий справочник');
  };

  const handleDelete = (type, id) => {
    Modal.confirm({
      title: 'Подтверждение удаления/отклонения',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Введите обоснование для удаления записи:</p>
          <Input.TextArea id="deleteReason" rows={3} placeholder="Обоснование обязательно" />
        </div>
      ),
      okType: 'danger',
      okText: 'Подтвердить',
      cancelText: 'Отмена',
      onOk: () => {
        const reason = document.getElementById('deleteReason').value;
        if (!reason.trim()) {
           Modal.error({ title: 'Ошибка', content: 'Обоснование обязательно' });
           return Promise.reject();
        }
        if (type === 'fert') setFertData(fertData.filter(d => d.id !== id));
        if (type === 'pest') setPestData(pestData.filter(d => d.id !== id));
        message.success('Запись успешно отклонена/удалена');
      }
    });
  };

  const findAnalogs = () => {
    const dataList = analogType === 'fert' ? fertData : pestData;
    const target = dataList.find(d => d.id === selectedForAnalog);
    
    if (!target) return;

    // Алгоритм поиска дешевых аналогов (по совпадению первых слов состава и цене ниже текущей)
    const targetBaseComp = target.composition.split(/[\s,+]+/)[0].toLowerCase();
    
    const analogs = dataList.filter(item => 
      item.id !== target.id &&
      item.status === 'active' &&
      item.price < target.price &&
      item.composition.toLowerCase().includes(targetBaseComp)
    );

    setAnalogResults(analogs.sort((a,b) => a.price - b.price));
  };

  const getColumns = (type) => {
    const cols = [
      { title: 'Название', dataIndex: 'name', key: 'name' },
      { title: 'Состав', dataIndex: 'composition', key: 'composition' },
      { title: 'Норма', dataIndex: 'norm', key: 'norm' },
      { title: 'Цена (₸)', dataIndex: 'price', key: 'price', render: p => p.toLocaleString('ru-RU') },
      { title: 'Производитель', dataIndex: 'manufacturer', key: 'manufacturer' },
      {
        title: 'Статус',
        dataIndex: 'status',
        key: 'status',
        render: (status) => (
          status === 'proposed' 
            ? <Tag color="warning">На модерации</Tag>
            : <Tag color="green">Активен</Tag>
        )
      }
    ];

    if (role === 'employee' || role === 'admin') {
      cols.push({
        title: 'Действия',
        key: 'actions',
        width: 140,
        render: (_, record) => (
          <Space>
            {record.status === 'proposed' && (
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(type, record.id)} />
            )}
            <Button size="small" icon={<EditOutlined />} onClick={() => openModal(`${type}_edit`, record)} />
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(type, record.id)} />
          </Space>
        )
      });
    }
    return cols;
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={2} className="agro-page-title" style={{ margin: 0 }}>Справочники номенклатуры</Title>
        <Button size="large" type="default" icon={<SearchOutlined />} onClick={() => { setAnalogResults([]); setSelectedForAnalog(null); setAnalogModalVisible(true); }}>
          Подобрать аналог
        </Button>
      </Row>

      <Tabs
        type="card"
        onChange={(key) => {
          setAnalogType(key === '1' ? 'fert' : 'pest');
          setFertSearch('');
          setPestSearch('');
        }}
        items={[
          {
            key: '1',
            label: 'Удобрения',
            children: (
              <div className="agro-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Input.Search 
                    placeholder="Поиск по названию..." 
                    style={{ maxWidth: 300 }} 
                    allowClear 
                    onChange={e => setFertSearch(e.target.value)} 
                  />
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('fert_add')}>
                    {role === 'user' ? 'Предложить удобрение' : 'Добавить'}
                  </Button>
                </div>
                <Table 
                  columns={getColumns('fert')} 
                  dataSource={fertData.filter(f => f.name.toLowerCase().includes(fertSearch.toLowerCase())).map(r => ({...r, key: r.id}))}
                  size="middle"
                  locale={{ emptyText: 'Нет данных' }}
                  rowClassName={(r, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
                />
              </div>
            )
          },
          {
            key: '2',
            label: 'Пестициды',
            children: (
              <div className="agro-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Input.Search 
                    placeholder="Поиск по названию..." 
                    style={{ maxWidth: 300 }} 
                    allowClear 
                    onChange={e => setPestSearch(e.target.value)} 
                  />
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('pest_add')}>
                    {role === 'user' ? 'Предложить пестицид' : 'Добавить'}
                  </Button>
                </div>
                <Table 
                  columns={getColumns('pest')} 
                  dataSource={pestData.filter(p => p.name.toLowerCase().includes(pestSearch.toLowerCase())).map(r => ({...r, key: r.id}))}
                  size="middle"
                  locale={{ emptyText: 'Нет данных' }}
                  rowClassName={(r, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
                />
              </div>
            )
          }
        ]}
      />

      <Modal
        title={modalType?.includes('add') ? 'Новая запись' : 'Редактировать запись'}
        open={!!modalType}
        onCancel={() => setModalType(null)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddEdit}>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="composition" label="Состав" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="norm" label="Норма применения" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="price" label="Цена (₸)" rules={[{ required: true, message: 'Обязательно' }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="manufacturer" label="Производитель" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            {role === 'user' ? 'Отправить на модерацию' : 'Сохранить'}
          </Button>
        </Form>
      </Modal>

      <Modal
        title="Алгоритм подбора аналогов"
        open={analogModalVisible}
        onCancel={() => setAnalogModalVisible(false)}
        footer={null}
        width={700}
      >
        <Typography.Paragraph type="secondary">
          Система анализирует состав выбранного препарата и предлагает более дешевые аналоги с идентичным или схожим составом активных веществ. Начните экономить бюджет!
        </Typography.Paragraph>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <Select 
            style={{ flex: 1 }} 
            placeholder="Выберите препарат, который хотите заменить..."
            onChange={setSelectedForAnalog}
            value={selectedForAnalog}
            showSearch
            optionFilterProp="children"
            size="large"
          >
            {(analogType === 'fert' ? fertData : pestData).filter(d => d.status === 'active').map(d => (
              <Option key={d.id} value={d.id}>{d.name} (₸ {d.price.toLocaleString('ru-RU')} / ед.)</Option>
            ))}
          </Select>
          <Button type="primary" size="large" icon={<SearchOutlined />} onClick={findAnalogs} disabled={!selectedForAnalog}>
            Найти аналоги
          </Button>
        </div>

        {analogResults.length > 0 ? (
          <List
            header={<b>Найдены выверенные выгодные аналоги ({analogResults.length}):</b>}
            bordered
            dataSource={analogResults}
            renderItem={item => {
              const originalItem = (analogType === 'fert' ? fertData : pestData).find(f => f.id === selectedForAnalog);
              const savings = originalItem ? originalItem.price - item.price : 0;
              return (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text strong style={{ fontSize: 16 }}>{item.name}</Text>
                      <Tag color="green" style={{ fontSize: 14, padding: '2px 8px' }}>
                        Экономия: ₸ {savings.toLocaleString('ru-RU')} с единицы
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                      <b>Состав:</b> {item.composition} <br />
                      <b>Производитель:</b> {item.manufacturer}
                    </Text>
                    <div>
                      <Text type="danger" strong>Ваша новая цена: ₸ {item.price.toLocaleString('ru-RU')}</Text>
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        ) : selectedForAnalog ? (
           <Alert message="Среди активных предложений аналоги с подходящим составом и ценой ниже выбранного пока не найдены." type="warning" showIcon />
        ) : null}
      </Modal>
    </div>
  );
};

export default References;
