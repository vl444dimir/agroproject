import { useState, useEffect } from 'react';
import { Typography, Table, Button, Input, Modal, Form, Space, InputNumber, notification, Row } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { productsApi } from '../api/productsApi';

const { Title } = Typography;

const Products = () => {
  const { role } = useAuth();
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await productsApi.getProducts();
      setData(response.data);
    } catch (err) {
      notification.error({ message: 'Ошибка при загрузке продуктов' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openModal = (record = null) => {
    setEditingItem(record);
    if (record) {
      form.setFieldsValue(record);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleAddEdit = async (values) => {
    try {
      if (editingItem) {
        await productsApi.updateProduct(editingItem.id, values);
        notification.success({ message: 'Продукт успешно обновлен' });
      } else {
        await productsApi.createProduct(values);
        notification.success({ message: 'Новый продукт добавлен' });
      }
      setModalVisible(false);
      form.resetFields();
      fetchProducts();
    } catch (error) {
      notification.error({ message: 'Не удалось сохранить продукт' });
    }
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: 'Удаление продукта',
      icon: <ExclamationCircleOutlined />,
      content: 'Вы уверены, что хотите удалить этот продукт?',
      okType: 'danger',
      okText: 'Да, удалить',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await productsApi.deleteProduct(id);
          notification.success({ message: 'Продукт успешно удален' });
          fetchProducts();
        } catch (error) {
          notification.error({ message: 'Ошибка удаления продукта' });
        }
      }
    });
  };

  const getColumns = () => {
    const cols = [
      { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
      { title: 'Название', dataIndex: 'name', key: 'name' },
      { title: 'Описание', dataIndex: 'description', key: 'description' },
      { title: 'Цена (₸)', dataIndex: 'price', key: 'price', render: p => p?.toLocaleString('ru-RU') },
      { title: 'Количество', dataIndex: 'quantity', key: 'quantity' },
    ];

    if (role === 'admin' || role === 'staff') {
      cols.push({
        title: 'Действия',
        key: 'actions',
        width: 120,
        render: (_, record) => (
          <Space>
            <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
            {role === 'admin' && (
               <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
            )}
          </Space>
        )
      });
    }
    return cols;
  };

  const filteredData = data.filter(item => 
    item.name?.toLowerCase().includes(searchText.toLowerCase()) || 
    item.description?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={2} className="agro-page-title" style={{ margin: 0 }}>Управление продуктами</Title>
      </Row>

      <div className="agro-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input.Search 
            placeholder="Поиск продуктов..." 
            style={{ maxWidth: 300 }} 
            allowClear 
            onChange={e => setSearchText(e.target.value)} 
          />
          {(role === 'admin' || role === 'staff') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Добавить продукт
            </Button>
          )}
        </div>
        
        <Table 
          columns={getColumns()} 
          dataSource={filteredData.map(r => ({...r, key: r.id}))}
          size="middle"
          loading={loading}
          locale={{ emptyText: 'Нет данных' }}
          rowClassName={(r, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
        />
      </div>

      <Modal
        title={editingItem ? 'Редактировать продукт' : 'Новый продукт'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddEdit}>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="price" label="Цена (₸)" rules={[{ required: true, message: 'Обязательно' }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="quantity" label="Количество" rules={[{ required: true, message: 'Обязательно' }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={0} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Сохранить
          </Button>
        </Form>
      </Modal>

    </div>
  );
};

export default Products;
