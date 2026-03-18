import { useState } from 'react';
import { Typography, Tabs, Table, Button, Input, Modal, Form, Space, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { MOCK_FERTILIZERS_REF, MOCK_PESTICIDES_REF } from '../mock';

const { Title, Text } = Typography;

const References = () => {
  const { role } = useAuth();
  
  const [fertData, setFertData] = useState(MOCK_FERTILIZERS_REF);
  const [pestData, setPestData] = useState(MOCK_PESTICIDES_REF);
  
  const [fertSearch, setFertSearch] = useState('');
  const [pestSearch, setPestSearch] = useState('');

  const [modalType, setModalType] = useState(null); // 'fert_add', 'fert_edit', 'pest_add', 'pest_edit'
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  const handleAddEdit = (values) => {
    if (modalType === 'fert_add') {
      setFertData([...fertData, { ...values, id: Date.now() }]);
    } else if (modalType === 'fert_edit') {
      setFertData(fertData.map(f => f.id === editingItem.id ? { ...f, ...values } : f));
    } else if (modalType === 'pest_add') {
      setPestData([...pestData, { ...values, id: Date.now() }]);
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

  const handleDelete = (type, id) => {
    Modal.confirm({
      title: 'Подтверждение удаления',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Введите обоснование для удаления записи:</p>
          <Input.TextArea id="deleteReason" rows={3} placeholder="Обоснование обязательно" />
        </div>
      ),
      okType: 'danger',
      okText: 'Удалить',
      cancelText: 'Отмена',
      onOk: () => {
        const reason = document.getElementById('deleteReason').value;
        if (!reason.trim()) {
           Modal.error({ title: 'Ошибка', content: 'Обоснование обязательно' });
           return Promise.reject();
        }
        if (type === 'fert') setFertData(fertData.filter(d => d.id !== id));
        if (type === 'pest') setPestData(pestData.filter(d => d.id !== id));
      }
    });
  };

  const getColumns = (type) => {
    const cols = [
      { title: 'Название', dataIndex: 'name', key: 'name' },
      { title: 'Состав', dataIndex: 'composition', key: 'composition' },
      { title: 'Норма применения', dataIndex: 'norm', key: 'norm' },
      { title: 'Цена (₸)', dataIndex: 'price', key: 'price', render: p => p.toLocaleString('ru-RU') },
      { title: 'Производитель', dataIndex: 'manufacturer', key: 'manufacturer' },
    ];

    if (role === 'employee' || role === 'admin') {
      cols.push({
        title: 'Действия',
        key: 'actions',
        width: 120,
        render: (_, record) => (
          <Space>
            <Button size="small" icon={<EditOutlined />} onClick={() => openModal(`${type}_edit`, record)} />
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(type, record.id)} />
          </Space>
        )
      });
    }
    return cols;
  };

  const currentTabCols = getColumns(modalType?.startsWith('fert') || !modalType ? 'fert' : 'pest');

  return (
    <div>
      <Title level={2} className="agro-page-title">Справочники номенклатуры</Title>

      <Tabs
        type="card"
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
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('fert_add')}>Добавить</Button>
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
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('pest_add')}>Добавить</Button>
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
        title={modalType?.includes('add') ? 'Добавить запись' : 'Редактировать запись'}
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
          <Button type="primary" htmlType="submit" block>Сохранить</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default References;
