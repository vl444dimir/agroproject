import { useState } from 'react';
import { Typography, Tabs, Table, Button, Input, Modal, Form, Space, InputNumber, Tag, Select, List, message, Row, Alert, Descriptions } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, CheckOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { MOCK_FERTILIZERS_REF, MOCK_PESTICIDES_REF } from '../mock';

const { Title, Text } = Typography;
const { Option } = Select;

const References = () => {
  const { role } = useAuth();
  
  // Инициализируем данные и безопасно маппим поля бэкенда (formulation -> composition, normOfUse -> norm, price -> 0)
  const mapBackendProps = (item) => ({
    ...item,
    id: item.id || Date.now() + Math.random(),
    status: item.status || 'active',
    composition: item.composition || item.formulation || '—',
    norm: item.norm || item.normOfUse || '—',
    price: item.price ?? 0,
    manufacturer: item.manufacturer || (item.manufacturerName ? { name: item.manufacturerName } : null) || '—'
  });

  const [fertData, setFertData] = useState(MOCK_FERTILIZERS_REF.map(mapBackendProps));
  const [pestData, setPestData] = useState(MOCK_PESTICIDES_REF.map(mapBackendProps));
  
  const [fertSearch, setFertSearch] = useState('');
  const [pestSearch, setPestSearch] = useState('');

  const [modalType, setModalType] = useState(null); // 'fert_add', 'fert_edit', 'pest_add', 'pest_edit'
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  // Состояния для просмотра деталей
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);

  const handleView = (record) => {
    setViewingItem(record);
    setViewModalVisible(true);
  };

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
      { 
        title: 'Название', 
        dataIndex: 'name', 
        key: 'name',
        render: (text, record) => (
          <span 
            className="product-name-link"
            onClick={() => handleView(record)}
          >
            {text}
          </span>
        )
      },
      { 
        title: 'Категория', 
        dataIndex: 'categoryName', 
        key: 'categoryName',
        render: c => c || (type === 'fert' ? 'Удобрения' : 'Пестициды')
      },
      { title: 'Состав', dataIndex: 'composition', key: 'composition' },
      { title: 'Норма', dataIndex: 'norm', key: 'norm' },
      { 
        title: 'Цена (₸)', 
        dataIndex: 'price', 
        key: 'price', 
        render: p => p != null ? p.toLocaleString('ru-RU') : '0' 
      },
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
              <Option key={d.id} value={d.id}>
                {d.name} (₸ {d.price != null ? d.price.toLocaleString('ru-RU') : '0'} / ед.)
              </Option>
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
                        Экономия: ₸ {savings != null ? savings.toLocaleString('ru-RU') : '0'} с единицы
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                      <b>Состав:</b> {item.composition} <br />
                      <b>Производитель:</b> {typeof item.manufacturer === 'object' ? item.manufacturer?.name || '—' : item.manufacturer || '—'}
                    </Text>
                    <div>
                      <Text type="danger" strong>Ваша новая цена: ₸ {item.price != null ? item.price.toLocaleString('ru-RU') : '0'}</Text>
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

      <Modal
        title="Информация о препарате"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setViewModalVisible(false)}>
            Закрыть
          </Button>
        ]}
        width={700}
      >
        {viewingItem ? (
          <div>
            <Title level={3} style={{ marginTop: 0, color: '#1a7c3e', marginBottom: 20 }}>
              {viewingItem.name}
            </Title>
            <Descriptions bordered column={1} size="middle" labelStyle={{ width: '35%', fontWeight: '600', backgroundColor: '#fafafa' }}>
              <Descriptions.Item label="Категория">
                {viewingItem.categoryName || (viewingItem.category?.name) || (analogType === 'fert' ? 'Удобрения' : 'Пестициды')}
              </Descriptions.Item>
              <Descriptions.Item label="Состав / Препаративная форма">
                {viewingItem.composition || viewingItem.formulation || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Норма применения">
                {viewingItem.norm || viewingItem.normOfUse || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Цена (₸)">
                {viewingItem.price != null ? viewingItem.price.toLocaleString('ru-RU') : '0'}
              </Descriptions.Item>
              <Descriptions.Item label="Производитель">
                {typeof viewingItem.manufacturer === 'object' 
                  ? viewingItem.manufacturer?.name || '—' 
                  : viewingItem.manufacturer || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Статус">
                {viewingItem.status === 'proposed' ? (
                  <Tag color="warning">На модерации</Tag>
                ) : (
                  <Tag color="green">Активен</Tag>
                )}
              </Descriptions.Item>
              {viewingItem.targetObject && (
                <Descriptions.Item label="Вредный объект / Назначение">
                  {viewingItem.targetObject}
                </Descriptions.Item>
              )}
              {viewingItem.hazardClass && (
                <Descriptions.Item label="Класс опасности">
                  {viewingItem.hazardClass}
                </Descriptions.Item>
              )}
              {viewingItem.registrationDate && (
                <Descriptions.Item label="Дата регистрации">
                  {new Date(viewingItem.registrationDate).toLocaleDateString('ru-RU')}
                </Descriptions.Item>
              )}
              {viewingItem.ingredients && viewingItem.ingredients.length > 0 && (
                <Descriptions.Item label="Действующие вещества">
                  <Space wrap>
                    {viewingItem.ingredients.map((ing, idx) => (
                      <Tag color="green" key={idx}>
                        {ing.ingredientName} {ing.concentration ? `(${ing.concentration})` : ''}
                      </Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
              {viewingItem.cultureNames && viewingItem.cultureNames.length > 0 && (
                <Descriptions.Item label="Культуры">
                  <Space wrap>
                    {viewingItem.cultureNames.map((culture, idx) => (
                      <Tag color="blue" key={idx}>
                        {culture}
                      </Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>Нет данных для отображения</div>
        )}
      </Modal>
    </div>
  );
};

export default References;
