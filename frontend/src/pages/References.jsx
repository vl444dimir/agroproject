import { useState, useEffect } from 'react';
import { Typography, Table, Button, Input, Modal, Form, Space, InputNumber, Tag, Select, List, message, Row, Col, Alert, Descriptions } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, CheckOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { referencesApi } from '../api/references';
import { reportsApi } from '../api/reports';

const { Title, Text } = Typography;
const { Option } = Select;

const References = () => {
  const { role } = useAuth();

  // Инициализируем данные и безопасно маппим поля бэкенда (formulation -> composition, normOfUse -> norm, price -> 0)
  const mapBackendProps = (item) => ({
    ...item,
    id: item.id || Date.now() + Math.random(),
    status: item.status || 'active',
    composition: item.composition || (item.ingredients && item.ingredients.length > 0
      ? item.ingredients.map(ing => {
        const name = ing.ingredientName || ing.name || '';
        const conc = ing.concentration ? ` - ${ing.concentration}` : '';
        return `${name}${conc}`;
      }).join('\n')
      : item.formulation || '—'),
    norm: item.norm || item.normOfUse || '—',
    price: item.price ?? 0,
    manufacturer: item.manufacturer || (item.manufacturerName ? { name: item.manufacturerName } : null) || '—'
  });

  const [productsData, setProductsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasSubsidiesFilter, setHasSubsidiesFilter] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [allCategories, setAllCategories] = useState([]);
  const [allManufacturers, setAllManufacturers] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);

  const [modalType, setModalType] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();



  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);

  const handleView = (record) => {
    setViewingItem(record);
    setViewModalVisible(true);
  };

  const [analogModalVisible, setAnalogModalVisible] = useState(false);
  const [selectedForAnalog, setSelectedForAnalog] = useState(null);
  const [analogResults, setAnalogResults] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fertRes, pestRes, subsidiesRes, catsRes, manRes, ingRes] = await Promise.all([
        referencesApi.getFertilizers(),
        referencesApi.getPesticides(),
        reportsApi.getFlatReports().catch(() => ({ data: [] })),
        referencesApi.getCategories(),
        referencesApi.getManufacturers(),
        referencesApi.getIngredients()
      ]);

      setAllCategories(catsRes.data || []);
      setAllManufacturers(manRes.data || []);
      setAllIngredients(ingRes.data || []);

      const subsidiesList = subsidiesRes.data || [];

      const mappedFerts = (fertRes.data || []).map(item => ({ ...mapBackendProps(item), type: 'fert', categoryName: item.categoryName || 'Удобрения' }));
      const mappedPests = (pestRes.data || []).map(item => ({ ...mapBackendProps(item), type: 'pest', categoryName: item.categoryName || 'Пестициды' }));
      const allRefProducts = [...mappedFerts, ...mappedPests];

      if (subsidiesList.length > 0) {
        const uniqueCats = Array.from(new Set(
          subsidiesList.map(item => item.categoryName?.trim()).filter(Boolean)
        )).sort();
        setCategories(uniqueCats);

        const processedProducts = [];
        const usedProductNames = new Set();

        subsidiesList.forEach(subsidy => {
          const subProdName = subsidy.productName?.trim();
          if (!subProdName) return;
          const subProdNameLower = subProdName.toLowerCase();

          const refProduct = allRefProducts.find(p => p.name?.trim().toLowerCase() === subProdNameLower);

          // Вытаскиваем цену из субсидии:
          // 1. Из unitPrice
          // 2. Из price
          // 3. Расчетная цена = calculatedSum / quantityUsed
          // 4. Иначе цена из справочника
          let calculatedPrice = null;
          if (subsidy.productPrice != null && subsidy.productPrice > 0) {
            calculatedPrice = subsidy.productPrice;
          } else if (subsidy.unitPrice != null && subsidy.unitPrice > 0) {
            calculatedPrice = subsidy.unitPrice;
          } else if (subsidy.price != null && subsidy.price > 0) {
            calculatedPrice = subsidy.price;
          } else if (subsidy.quantityUsed > 0 && subsidy.calculatedSum != null && subsidy.calculatedSum > 0) {
            calculatedPrice = Math.round(subsidy.calculatedSum / subsidy.quantityUsed);
          }

          const finalPrice = calculatedPrice !== null ? calculatedPrice : (refProduct && refProduct.price ? refProduct.price : 0);
          const finalComposition = refProduct ? refProduct.composition : '—';
          const finalCategory = subsidy.categoryName || (refProduct ? refProduct.categoryName : 'Другое');

          const key = `${subProdNameLower}::${finalCategory.toLowerCase()}`;
          if (!usedProductNames.has(key)) {
            usedProductNames.add(key);
            processedProducts.push({
              id: refProduct?.id || `subsidy-${Date.now()}-${Math.random()}`,
              name: subProdName,
              composition: finalComposition,
              price: finalPrice,
              categoryName: finalCategory,
              type: refProduct?.type || (finalCategory.toLowerCase().includes('удобрен') ? 'fert' : 'pest'),
              status: refProduct?.status || 'active',
              norm: refProduct?.norm || '—',
              manufacturer: refProduct?.manufacturer || '—'
            });
          }
        });

        setProductsData(processedProducts);
        setHasSubsidiesFilter(true);
      } else {
        setProductsData(allRefProducts);
        setCategories(['Удобрения', 'Пестициды']);
        setHasSubsidiesFilter(false);
      }
    } catch (e) {
      console.error("Ошибка при получении справочных данных", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEdit = async (values) => {
    setLoading(true);
    try {
      const selectedCategory = allCategories.find(c => c.id === values.categoryId);

      const combinedNorm = values.normValue
        ? `${values.normValue.trim()} ${values.normUnit || 'литр/га'}`.trim()
        : '';

      const payload = {
        name: values.name,
        categoryId: values.categoryId,
        manufacturerId: values.manufacturerId,
        normOfUse: combinedNorm,
        price: values.price,
        ingredients: (values.ingredients || []).map(ing => ({
          ingredientId: ing.ingredientId,
          concentration: ing.concentration
        })),
        formulation: values.formulation || 'Препарат',
        cultureIds: [],
        targetObject: '',
        hazardClass: ''
      };

      if (modalType === 'add') {
        const response = await referencesApi.createProduct(payload);
        const createdProduct = mapBackendProps(response.data);
        createdProduct.categoryName = selectedCategory ? selectedCategory.name : 'Другое';
        createdProduct.type = (createdProduct.categoryName.toLowerCase().includes('удобрен')) ? 'fert' : 'pest';

        setProductsData([createdProduct, ...productsData]);
        message.success('Запись успешно сохранена в базу данных');
      } else if (modalType === 'edit') {
        const response = await referencesApi.updateProduct(editingItem.id, payload);
        const updatedProduct = mapBackendProps(response.data);
        updatedProduct.categoryName = selectedCategory ? selectedCategory.name : 'Другое';
        updatedProduct.type = (updatedProduct.categoryName.toLowerCase().includes('удобрен')) ? 'fert' : 'pest';

        setProductsData(productsData.map(p => p.id === editingItem.id ? updatedProduct : p));
        message.success('Запись успешно обновлена в базе данных');
      }
      setModalType(null);
      form.resetFields();
    } catch (e) {
      console.error("Ошибка при сохранении препарата", e);
    } finally {
      setLoading(false);
    }
  };

  const parseNormString = (normStr) => {
    if (!normStr || normStr === '—') return { value: '', unit: 'литр/га' };

    const units = ['литр/га', 'л/га', 'кг/га', 'кг/т', 'г/га', 'г/т', 'л/т'];
    for (const unit of units) {
      if (normStr.endsWith(unit)) {
        const value = normStr.slice(0, normStr.length - unit.length).trim();
        return { value, unit };
      }
    }

    const lastSpaceIdx = normStr.lastIndexOf(' ');
    if (lastSpaceIdx !== -1) {
      const value = normStr.substring(0, lastSpaceIdx).trim();
      const unit = normStr.substring(lastSpaceIdx + 1).trim();
      return { value, unit };
    }

    return { value: normStr, unit: 'литр/га' };
  };

  const openModal = (type, record = null) => {
    setModalType(type);
    setEditingItem(record);
    if (record) {
      const formattedIngredients = (record.ingredients || []).map(ing => ({
        ingredientId: ing.ingredientId || ing.id,
        concentration: ing.concentration
      }));

      const rawNorm = record.norm || record.normOfUse || '';
      const parsedNorm = parseNormString(rawNorm);

      form.setFieldsValue({
        name: record.name,
        categoryId: record.categoryId || (allCategories.find(c => c.name === record.categoryName)?.id),
        manufacturerId: record.manufacturer?.id || record.manufacturerId,
        normValue: parsedNorm.value,
        normUnit: parsedNorm.unit,
        price: record.price,
        formulation: record.formulation,
        ingredients: formattedIngredients
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        normUnit: 'литр/га'
      });
    }
  };

  const handleApprove = (id) => {
    setProductsData(productsData.map(d => d.id === id ? { ...d, status: 'active' } : d));
    message.success('Запись одобрена и добавлена в рабочий справочник');
  };

  const handleDelete = (id) => {
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
      onOk: async () => {
        const reason = document.getElementById('deleteReason').value;
        if (!reason.trim()) {
          Modal.error({ title: 'Ошибка', content: 'Обоснование обязательно' });
          return Promise.reject();
        }
        try {
          await referencesApi.deleteProduct(id);
          setProductsData(productsData.filter(d => d.id !== id));
          message.success('Запись успешно удалена из базы данных');
        } catch (e) {
          console.error("Ошибка при удалении препарата", e);
          return Promise.reject();
        }
      }
    });
  };

  const findAnalogs = () => {
    const target = productsData.find(d => d.id === selectedForAnalog);
    if (!target) return;

    const targetBaseComp = target.composition.split(/[\s,+]+/)[0].toLowerCase();

    if (!targetBaseComp || targetBaseComp === '—') {
      setAnalogResults([]);
      return;
    }

    const analogs = productsData.filter(item =>
      item.id !== target.id &&
      item.status === 'active' &&
      item.price < target.price &&
      item.composition.toLowerCase().includes(targetBaseComp)
    );

    setAnalogResults(analogs.sort((a, b) => a.price - b.price));
  };

  const getColumns = () => {
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
        render: c => <Tag color="blue">{c || '—'}</Tag>
      },
      {
        title: 'Состав',
        dataIndex: 'composition',
        key: 'composition',
        render: text => <span style={{ whiteSpace: 'pre-line' }}>{text}</span>
      },
      {
        title: 'Цена (₸)',
        dataIndex: 'price',
        key: 'price',
        render: p => p != null ? p.toLocaleString('ru-RU') : '0'
      }
    ];

    if (role === 'employee' || role === 'admin' || role === 'staff') {
      cols.push({
        title: 'Действия',
        key: 'actions',
        width: 140,
        render: (_, record) => (
          <Space>
            {record.status === 'proposed' && (
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(record.id)} />
            )}
            <Button size="small" icon={<EditOutlined />} onClick={() => openModal('edit', record)} />
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
          </Space>
        )
      });
    }
    return cols;
  };

  const filteredProducts = productsData.filter(item => {
    const matchesCategory = selectedCategory === 'ALL' || item.categoryName === selectedCategory;
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.composition?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={2} className="agro-page-title" style={{ margin: 0 }}>Справочники номенклатуры</Title>
        <Button size="large" type="default" icon={<SearchOutlined />} onClick={() => { setAnalogResults([]); setSelectedForAnalog(null); setAnalogModalVisible(true); }}>
          Подобрать аналог
        </Button>
      </Row>

      {hasSubsidiesFilter && (
        <Alert
          message="Информация из субсидий"
          description="Список препаратов, категории и цены подтянуты напрямую из зарегистрированных в системе субсидий."
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div className="agro-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <Space wrap>
            <Input.Search
              placeholder="Поиск по названию или составу..."
              style={{ width: 280 }}
              allowClear
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <Select
              style={{ width: 240 }}
              placeholder="Фильтр по категории"
              value={selectedCategory}
              onChange={setSelectedCategory}
            >
              <Option value="ALL">Все категории ({productsData.length})</Option>
              {categories.map(cat => (
                <Option key={cat} value={cat}>{cat}</Option>
              ))}
            </Select>
          </Space>

          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('add')}>
            {role === 'user' ? 'Предложить препарат' : 'Добавить препарат'}
          </Button>
        </div>

        <Table
          columns={getColumns()}
          dataSource={filteredProducts.map(r => ({ ...r, key: r.id }))}
          size="middle"
          locale={{ emptyText: 'Нет данных' }}
          rowClassName={(r, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
          loading={loading}
        />
      </div>

      <Modal
        title={modalType === 'add' ? 'Новая запись' : 'Редактировать запись'}
        open={!!modalType}
        onCancel={() => setModalType(null)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleAddEdit}>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="categoryId" label="Категория" rules={[{ required: true, message: 'Обязательно' }]}>
                <Select placeholder="Выберите категорию">
                  {allCategories.map(cat => (
                    <Option key={cat.id} value={cat.id}>{cat.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="manufacturerId" label="Производитель">
                <Select placeholder="Выберите производителя" allowClear showSearch optionFilterProp="children">
                  {allManufacturers.map(m => (
                    <Option key={m.id} value={m.id}>{m.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Действующие вещества (состав)">
            <Form.List name="ingredients">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'ingredientId']}
                        rules={[{ required: true, message: 'Выберите вещество' }]}
                        style={{ width: 260, marginBottom: 0 }}
                      >
                        <Select
                          placeholder="Вещество / элемент"
                          showSearch
                          optionFilterProp="children"
                        >
                          {allIngredients.map(ing => (
                            <Option key={ing.id} value={ing.id}>{ing.name}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'concentration']}
                        rules={[{ required: true, message: 'Концентрация' }]}
                        style={{ width: 160, marginBottom: 0 }}
                      >
                        <Input placeholder="Например: 4.05%, 360 г/л" />
                      </Form.Item>
                      <Button type="text" danger onClick={() => remove(name)} style={{ marginLeft: 8 }}>Удалить</Button>
                    </Space>
                  ))}
                  <Form.Item style={{ marginBottom: 16 }}>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Добавить вещество (элемент)
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Норма применения" required>
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item
                    name="normValue"
                    noStyle
                    rules={[{ required: true, message: 'Введите норму' }]}
                  >
                    <Input style={{ width: '65%' }} placeholder="Например: 15,00 - 25,00" />
                  </Form.Item>
                  <Form.Item
                    name="normUnit"
                    noStyle
                  >
                    <Select style={{ width: '35%' }} placeholder="Ед. изм.">
                      <Option value="литр/га">литр/га</Option>
                      <Option value="л/га">л/га</Option>
                      <Option value="кг/га">кг/га</Option>
                      <Option value="кг/т">кг/т</Option>
                      <Option value="г/га">г/га</Option>
                      <Option value="г/т">г/т</Option>
                      <Option value="л/т">л/т</Option>
                    </Select>
                  </Form.Item>
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="formulation" label="Препаративная форма">
                <Input placeholder="Например: ВГ, КЭ, СК" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="price" label="Цена (₸)" rules={[{ required: true, message: 'Обязательно' }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Button type="primary" htmlType="submit" block size="large" style={{ marginTop: 16 }}>
            Сохранить в базу данных
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
            {productsData.filter(d => d.status === 'active').map(d => (
              <Option key={d.id} value={d.id}>
                {d.name} [{d.categoryName}] (₸ {d.price != null ? d.price.toLocaleString('ru-RU') : '0'} / ед.)
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
              const originalItem = productsData.find(f => f.id === selectedForAnalog);
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
                {viewingItem.categoryName || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Состав / Препаративная форма">
                {viewingItem.composition || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Норма применения">
                {viewingItem.norm || '—'}
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
