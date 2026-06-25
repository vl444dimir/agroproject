import { useState, useEffect } from 'react';
import { Typography, Table, Button, Input, Modal, Form, Space, InputNumber, notification, Row, Col, Spin, Descriptions, Tag, Select, Tooltip, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, SearchOutlined, ExperimentOutlined, FilterOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { productsApi } from '../api/productsApi';
import { referencesApi } from '../api/references';

const { Title } = Typography;

const Products = () => {
  const { role } = useAuth();
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  // State for viewing product details modal
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // States for table page tracking to compute overall row indices
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // States for analogues modal
  const [analogProduct, setAnalogProduct] = useState(null);
  const [analogues, setAnalogues] = useState([]);
  const [analogModalVisible, setAnalogModalVisible] = useState(false);
  const [analogLoading, setAnalogLoading] = useState(false);

  // Filters for analogues
  const [cultures, setCultures] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [selectedCulture, setSelectedCulture] = useState(undefined);
  const [selectedDistrict, setSelectedDistrict] = useState(undefined);

  // Reset page to 1 when search text changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText]);

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

  const loadFilters = async () => {
    try {
      const [culturesRes, districtsRes] = await Promise.all([
        referencesApi.getCultures(),
        referencesApi.getDistricts()
      ]);
      setCultures(culturesRes.data || []);
      setDistricts(districtsRes.data || []);
    } catch (err) {
      console.error('Ошибка при загрузке справочников культур/районов:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    loadFilters();
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

  const fetchAnalogues = async (productId, cultureId, districtId) => {
    setAnalogLoading(true);
    try {
      const params = {};
      if (cultureId) params.cultureId = cultureId;
      if (districtId) params.districtId = districtId;
      const res = await productsApi.getAnalogues(productId, params);
      setAnalogues(res.data || []);
    } catch (err) {
      notification.error({ message: 'Ошибка при загрузке аналогов' });
      setAnalogues([]);
    } finally {
      setAnalogLoading(false);
    }
  };

  const handleShowAnalogues = async (record) => {
    setAnalogProduct(record);
    setAnalogues([]);
    setAnalogModalVisible(true);
    setSelectedCulture(undefined);
    setSelectedDistrict(undefined);
    await fetchAnalogues(record.id, undefined, undefined);
  };

  const handleFilterChange = (type, value) => {
    if (type === 'culture') {
      setSelectedCulture(value);
      if (analogProduct) {
        fetchAnalogues(analogProduct.id, value, selectedDistrict);
      }
    } else if (type === 'district') {
      setSelectedDistrict(value);
      if (analogProduct) {
        fetchAnalogues(analogProduct.id, selectedCulture, value);
      }
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

  const handleView = async (record) => {
    setViewLoading(true);
    setViewingProduct(null);
    setViewModalVisible(true);
    try {
      const response = await productsApi.getProductById(record.id);
      setViewingProduct(response.data);
    } catch (err) {
      notification.error({ message: 'Ошибка при загрузке деталей продукта' });
      setViewModalVisible(false);
    } finally {
      setViewLoading(false);
    }
  };

  const getColumns = () => {
    const cols = [
      { 
        title: '№', 
        key: 'index', 
        width: 60, 
        render: (_, __, index) => (currentPage - 1) * pageSize + index + 1 
      },
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
      { title: 'Описание', dataIndex: 'description', key: 'description' },
      { title: 'Цена (₸)', dataIndex: 'price', key: 'price', render: p => p?.toLocaleString('ru-RU') },
      { title: 'Количество', dataIndex: 'quantity', key: 'quantity' },
    ];

    if (role === 'admin' || role === 'staff') {
      cols.push({
        title: 'Действия',
        key: 'actions',
        width: 200,
        render: (_, record) => (
          <Space>
            <Button size="small" icon={<ExperimentOutlined />} onClick={() => handleShowAnalogues(record)}>
              Аналоги
            </Button>
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
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            showSizeChanger: true,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            }
          }}
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
        {viewLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <Spin size="large" />
          </div>
        ) : viewingProduct ? (
          <div>
            <Title level={3} style={{ marginTop: 0, color: '#1a7c3e', marginBottom: 20 }}>
              {viewingProduct.name}
            </Title>
            <Descriptions bordered column={1} size="middle" labelStyle={{ width: '35%', fontWeight: '600', backgroundColor: '#fafafa' }}>
              <Descriptions.Item label="Категория">{viewingProduct.categoryName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Производитель">{viewingProduct.manufacturerName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Препаративная форма">{viewingProduct.formulation || '—'}</Descriptions.Item>
              <Descriptions.Item label="Норма применения">{viewingProduct.normOfUse || '—'}</Descriptions.Item>
              <Descriptions.Item label="Вредный объект / Назначение">{viewingProduct.targetObject || '—'}</Descriptions.Item>
              <Descriptions.Item label="Класс опасности">{viewingProduct.hazardClass || '—'}</Descriptions.Item>
              <Descriptions.Item label="Дата регистрации">
                {viewingProduct.registrationDate ? new Date(viewingProduct.registrationDate).toLocaleDateString('ru-RU') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Действующие вещества">
                {viewingProduct.ingredients && viewingProduct.ingredients.length > 0 ? (
                  <Space wrap>
                    {viewingProduct.ingredients.map((ing, idx) => (
                      <Tag color="green" key={idx}>
                        {ing.ingredientName} {ing.concentration ? `(${ing.concentration})` : ''}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Культуры">
                {viewingProduct.cultureNames && viewingProduct.cultureNames.length > 0 ? (
                  <Space wrap>
                    {viewingProduct.cultureNames.map((culture, idx) => (
                      <Tag color="blue" key={idx}>
                        {culture}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
            </Descriptions>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>Не удалось загрузить данные</div>
        )}
      </Modal>

      <Modal
        title={
          <Space>
            <ExperimentOutlined style={{ color: '#1a7c3e' }} />
            <span>Интеллектуальный подбор аналогов препарата</span>
          </Space>
        }
        open={analogModalVisible}
        onCancel={() => setAnalogModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setAnalogModalVisible(false)}>
            Закрыть
          </Button>
        ]}
        width={850}
        style={{ top: 40 }}
      >
        {analogProduct && (
          <div>
            {/* Target product details */}
            <Card 
              style={{ 
                background: 'linear-gradient(135deg, #f6ffed 0%, #e6f7ff 100%)', 
                border: '1px solid #d9f7be',
                borderRadius: '8px',
                marginBottom: '20px'
              }}
              size="small"
            >
              <Descriptions title={null} column={3} size="small" bordered={false}>
                <Descriptions.Item label="Целевой препарат">
                  <strong style={{ fontSize: '15px', color: '#1a7c3e' }}>{analogProduct.name}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Категория">
                  <Tag color="cyan">{analogProduct.categoryName || '—'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Исходная цена">
                  <strong style={{ color: '#d48806' }}>
                    {analogProduct.price != null ? `${analogProduct.price.toLocaleString('ru-RU')} ₸` : 'Не указана'}
                  </strong>
                </Descriptions.Item>
              </Descriptions>
              {analogProduct.ingredients && analogProduct.ingredients.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#8c8c8c' }}>Действующие вещества: </span>
                  {analogProduct.ingredients.map((ing, idx) => (
                    <Tag color="green" key={idx} style={{ fontSize: '11px' }}>
                      {ing.ingredientName} {ing.concentration ? `(${ing.concentration})` : ''}
                    </Tag>
                  ))}
                </div>
              )}
            </Card>

            {/* Filters panel */}
            <Card 
              size="small" 
              title={<Space><FilterOutlined style={{ color: '#1890ff' }} /><span>Фильтры совместимости</span></Space>}
              style={{ marginBottom: '20px', borderRadius: '8px' }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ marginBottom: 4 }}><Typography.Text strong style={{ fontSize: '13px' }}>Культура:</Typography.Text></div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="Все культуры"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    value={selectedCulture}
                    onChange={(val) => handleFilterChange('culture', val)}
                  >
                    {cultures.map(c => (
                      <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 4 }}><Typography.Text strong style={{ fontSize: '13px' }}>Район доступности:</Typography.Text></div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="Все районы"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    value={selectedDistrict}
                    onChange={(val) => handleFilterChange('district', val)}
                  >
                    {districts.map(d => (
                      <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
                    ))}
                  </Select>
                </Col>
              </Row>
            </Card>

            {/* Results Table */}
            <Typography.Title level={5} style={{ marginBottom: '10px' }}>
              Результаты поиска ({analogues.length})
            </Typography.Title>
            
            <Table
              loading={analogLoading}
              dataSource={analogues.map(r => ({ ...r, key: r.id }))}
              pagination={false}
              size="middle"
              locale={{ emptyText: 'Среди предложений аналоги с подходящим составом не найдены.' }}
              rowClassName={(r, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
              columns={[
                {
                  title: 'Название аналога',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text) => <strong>{text}</strong>
                },
                {
                  title: 'Совпадающие ДВ',
                  dataIndex: 'matchingIngredients',
                  key: 'matchingIngredients',
                  render: (ingredients) => (
                    <Space wrap>
                      {(ingredients || []).map(ing => (
                        <Tag color="green" key={ing}>{ing}</Tag>
                      ))}
                    </Space>
                  )
                },
                {
                  title: 'Цена (₸)',
                  dataIndex: 'price',
                  key: 'price',
                  render: (p) => p != null ? <b>{p.toLocaleString('ru-RU')}</b> : <span style={{ color: '#bfbfbf' }}>не указана</span>
                },
                {
                  title: 'Разница',
                  dataIndex: 'priceDifference',
                  key: 'priceDifference',
                  render: (diff) => {
                    if (diff == null) return '—';
                    const sign = diff > 0 ? '+' : '';
                    const color = diff < 0 ? 'success' : diff > 0 ? 'error' : 'default';
                    return <Tag color={color} style={{ fontWeight: 'bold' }}>{sign}{diff.toFixed(1)}%</Tag>;
                  }
                },
                {
                  title: 'Совместимость',
                  key: 'compatibility',
                  render: (_, record) => (
                    <Space>
                      {record.cultureNames && record.cultureNames.length > 0 ? (
                        <Tooltip title={`Культуры: ${record.cultureNames.join(', ')}`}>
                          <Tag color="blue" style={{ cursor: 'pointer' }}>{record.cultureNames.length} култ.</Tag>
                        </Tooltip>
                      ) : (
                        <Tag color="default">нет культур</Tag>
                      )}
                      {record.districtNames && record.districtNames.length > 0 ? (
                        <Tooltip title={`Районы: ${record.districtNames.join(', ')}`}>
                          <Tag color="purple" style={{ cursor: 'pointer' }}>{record.districtNames.length} рег.</Tag>
                        </Tooltip>
                      ) : (
                        <Tag color="default">нет регионов</Tag>
                      )}
                    </Space>
                  )
                }
              ]}
            />
          </div>
        )}
      </Modal>

    </div>
  );
};

export default Products;
