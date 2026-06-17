import { useState, useEffect } from 'react';
import { Row, Col, Card, Form, InputNumber, Select, Button, Typography, Collapse, List, Tag, Alert, Checkbox, message } from 'antd';
import { CalculatorOutlined, SaveOutlined, HistoryOutlined, DeleteOutlined } from '@ant-design/icons';
import { referencesApi } from '../api/references';
import { reportsApi } from '../api/reports';
import { MOCK_AUDIT_LOG } from '../mock';
import { auditApi } from '../api';

const { Title, Text } = Typography;
const { Option } = Select;

// Функция для сопоставления культур с агрономическими нормами
const getNormsForCrop = (cropName) => {
  const name = (cropName || '').toLowerCase();
  
  if (name.includes('пшениц') || name.includes('ячмен') || name.includes('овес') || name.includes('рожь') || name.includes('злак')) {
    return {
      fertilizer: 'Аммиачная селитра',
      fertNorm: 120, // кг/га
      pesticide: 'Гербицид Гранстар Про',
      pestNorm: 0.02, // кг/га
      pricePerHa: 18000 // тенге на га
    };
  }
  if (name.includes('подсолнеч') || name.includes('рапс') || name.includes('лен') || name.includes('рыжик') || name.includes('горчиц') || name.includes('маслич')) {
    return {
      fertilizer: 'Аммофос',
      fertNorm: 100,
      pesticide: 'Гербицид Евро-Лайтнинг',
      pestNorm: 1.2, // л/га
      pricePerHa: 25000
    };
  }
  if (name.includes('картофел') || name.includes('овощ') || name.includes('свекл')) {
    return {
      fertilizer: 'NPK 16:16:16',
      fertNorm: 300,
      pesticide: 'Фунгицид Ридомил Голд',
      pestNorm: 2.5, // кг/га
      pricePerHa: 45000
    };
  }
  if (name.includes('кукуруз')) {
    return {
      fertilizer: 'Карбамид (мочевина)',
      fertNorm: 150,
      pesticide: 'Гербицид Милагро',
      pestNorm: 1.0, // л/га
      pricePerHa: 22000
    };
  }
  if (name.includes('горох') || name.includes('нут') || name.includes('чечевиц') || name.includes('соя') || name.includes('бобов') || name.includes('вика')) {
    return {
      fertilizer: 'Суперфосфат двойной',
      fertNorm: 80,
      pesticide: 'Гербицид Базагран',
      pestNorm: 2.0, // л/га
      pricePerHa: 19000
    };
  }
  if (name.includes('гречих') || name.includes('просо') || name.includes('круп')) {
    return {
      fertilizer: 'Сульфат аммония',
      fertNorm: 90,
      pesticide: 'Гербицид Десикант',
      pestNorm: 1.5, // л/га
      pricePerHa: 17000
    };
  }
  // Резервный расчет по умолчанию
  return {
    fertilizer: 'Комплексное удобрение (NPK)',
    fertNorm: 100,
    pesticide: 'Универсальный фунгицид',
    pestNorm: 1.5,
    pricePerHa: 20000
  };
};

const Calculator = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [cultures, setCultures] = useState([]);
  const [loadingCultures, setLoadingCultures] = useState(false);
  const [isViewingArchive, setIsViewingArchive] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [fertilizersList, setFertilizersList] = useState([]);
  const [pesticidesList, setPesticidesList] = useState([]);
  const [selectedFormCategory, setSelectedFormCategory] = useState(undefined);

  useEffect(() => {
    const saved = localStorage.getItem('agro_calc_history');
    if (saved) setHistory(JSON.parse(saved));

    // Загрузка реальных культур из бэкенда
    setLoadingCultures(true);
    
    Promise.all([
      referencesApi.getCultures().catch(() => ({ data: [] })),
      referencesApi.getFertilizers().catch(() => ({ data: [] })),
      referencesApi.getPesticides().catch(() => ({ data: [] })),
      reportsApi.getFlatReports().catch(() => ({ data: [] }))
    ])
      .then(([cultRes, fertRes, pestRes, subsidiesRes]) => {
        const list = cultRes.data || [];
        if (list.length > 0) {
          const names = list.map(c => c.name).sort();
          setCultures(names);
        } else {
          useFallbackCultures();
        }

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

        const mappedFerts = (fertRes.data || []).map(item => ({ ...mapBackendProps(item), type: 'fert', categoryName: item.categoryName || 'Удобрения' }));
        const mappedPests = (pestRes.data || []).map(item => ({ ...mapBackendProps(item), type: 'pest', categoryName: item.categoryName || 'Пестициды' }));
        const allRefProducts = [...mappedFerts, ...mappedPests];

        const subsidiesList = subsidiesRes.data || [];
        if (subsidiesList.length > 0) {
          const processedProducts = [];
          const usedProductNames = new Set();

          subsidiesList.forEach(subsidy => {
            const subProdName = subsidy.productName?.trim();
            if (!subProdName) return;
            const subProdNameLower = subProdName.toLowerCase();

            const refProduct = allRefProducts.find(p => p.name?.trim().toLowerCase() === subProdNameLower);

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
            const finalCategory = subsidy.categoryName || (refProduct ? refProduct.categoryName : 'Другое');

            const key = `${subProdNameLower}::${finalCategory.toLowerCase()}`;
            if (!usedProductNames.has(key)) {
              usedProductNames.add(key);
              processedProducts.push({
                id: refProduct?.id || `subsidy-${Date.now()}-${Math.random()}`,
                name: subProdName,
                composition: refProduct ? refProduct.composition : '—',
                price: finalPrice,
                categoryName: finalCategory,
                type: refProduct?.type || (finalCategory.toLowerCase().includes('удобрен') ? 'fert' : 'pest'),
                status: refProduct?.status || 'active',
                norm: refProduct?.norm || '—',
                manufacturer: refProduct?.manufacturer || '—'
              });
            }
          });

          setFertilizersList(processedProducts.filter(p => p.type === 'fert'));
          setPesticidesList(processedProducts.filter(p => p.type !== 'fert'));
        } else {
          setFertilizersList(mappedFerts);
          setPesticidesList(mappedPests);
        }
      })
      .catch(() => {
        useFallbackCultures();
      })
      .finally(() => {
        setLoadingCultures(false);
      });
  }, []);

  const useFallbackCultures = () => {
    setCultures([
      'Пшеница яровая',
      'Ячмень яровой',
      'Овес',
      'Просо',
      'Гречиха',
      'Горох',
      'Нут',
      'Чечевица',
      'Соя',
      'Лен масличный',
      'Рапс яровой',
      'Подсолнечник',
      'Картофель',
      'Кукуруза на зерно'
    ]);
  };

  const handleValuesChange = (changedValues, allValues) => {
    if (changedValues.crop) {
      const defaultNorms = getNormsForCrop(changedValues.crop);
      
      const allProducts = [...fertilizersList, ...pesticidesList];
      const matchingProduct = allProducts.find(p => 
        p.name?.toLowerCase().includes(defaultNorms.fertilizer.toLowerCase()) ||
        defaultNorms.fertilizer.toLowerCase().includes(p.name?.toLowerCase())
      );

      form.setFieldsValue({
        category: matchingProduct ? (matchingProduct.categoryName || 'Удобрения') : undefined,
        productId: matchingProduct ? matchingProduct.id : undefined,
      });
      setSelectedFormCategory(matchingProduct ? (matchingProduct.categoryName || 'Удобрения') : undefined);
    }

    if (changedValues.category !== undefined) {
      setSelectedFormCategory(changedValues.category);
      // Reset product if it doesn't match selected category
      const currentProductId = form.getFieldValue('productId');
      if (currentProductId) {
        const allProducts = [...fertilizersList, ...pesticidesList];
        const currentProduct = allProducts.find(p => p.id === currentProductId);
        const prodCategory = currentProduct ? (currentProduct.categoryName || (currentProduct.type === 'fert' ? 'Удобрения' : 'Пестициды')) : '';
        
        if (changedValues.category && prodCategory !== changedValues.category) {
          form.setFieldsValue({ productId: undefined });
        }
      }
    }
  };

  const onFinish = (values) => {
    setLoading(true);
    setTimeout(() => {
      const norms = getNormsForCrop(values.crop);
      const allProducts = [...fertilizersList, ...pesticidesList];
      const selectedProduct = allProducts.find(p => p.id === values.productId);

      const parseNorm = (normStr, defaultVal) => {
        if (!normStr) return defaultVal;
        const matches = normStr.match(/\d+(\.\d+)?/g);
        if (!matches || matches.length === 0) return defaultVal;
        if (matches.length >= 2) {
          return (parseFloat(matches[0]) + parseFloat(matches[1])) / 2;
        }
        return parseFloat(matches[0]);
      };

      const recommendationCost = Math.round(values.area * norms.pricePerHa);

      // Find recommended product price from database if available
      const recFertProd = allProducts.find(p => p.type === 'fert' && (p.name?.toLowerCase().includes(norms.fertilizer.toLowerCase()) || norms.fertilizer.toLowerCase().includes(p.name?.toLowerCase())));
      const recPestProd = allProducts.find(p => p.type !== 'fert' && (p.name?.toLowerCase().includes(norms.pesticide.toLowerCase()) || norms.pesticide.toLowerCase().includes(p.name?.toLowerCase())));

      let selectedProductInfo = null;
      if (selectedProduct) {
        const isFert = selectedProduct.type === 'fert' || selectedProduct.categoryName?.toLowerCase().includes('удобрен');
        const selectedNorm = parseNorm(selectedProduct.norm, isFert ? norms.fertNorm : norms.pestNorm);
        const selectedTotal = isFert ? Math.round(values.area * selectedNorm) : Math.round(values.area * selectedNorm * 100) / 100;
        const selectedPricePerUnit = isFert ? (selectedProduct.price || 0) / 1000 : (selectedProduct.price || 0);
        const selectedCost = Math.round(values.area * selectedNorm * selectedPricePerUnit);

        selectedProductInfo = {
          name: selectedProduct.name,
          categoryName: selectedProduct.categoryName || (isFert ? 'Удобрения' : 'Пестициды'),
          type: selectedProduct.type || (isFert ? 'fert' : 'pest'),
          norm: selectedNorm,
          unit: isFert ? 'кг/га' : 'л/га',
          totalUnit: isFert ? 'кг' : 'л',
          total: selectedTotal,
          price: selectedProduct.price || 0,
          cost: selectedCost
        };
      }

      const res = {
        id: Date.now(),
        date: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }),
        area: values.area,
        crop: values.crop,
        period: values.period,
        method: values.method,
        // Default recommendation values:
        recFertilizer: norms.fertilizer,
        recFertNorm: norms.fertNorm,
        recFertTotal: Math.round(values.area * norms.fertNorm),
        recFertPrice: recFertProd ? recFertProd.price : null,
        recPesticide: norms.pesticide,
        recPestNorm: norms.pestNorm,
        recPestTotal: Math.round(values.area * norms.pestNorm * 100) / 100,
        recPestPrice: recPestProd ? recPestProd.price : null,
        recCost: recommendationCost,

        // Selected preparation:
        selectedProductInfo: selectedProductInfo,

        // Backwards compatibility with history list rendering:
        fertilizer: selectedProductInfo
          ? (selectedProductInfo.type === 'fert' ? selectedProductInfo.name : `Рекомендация: ${norms.fertilizer}`)
          : norms.fertilizer,
        fertNorm: selectedProductInfo && selectedProductInfo.type === 'fert' ? selectedProductInfo.norm : norms.fertNorm,
        fertTotal: selectedProductInfo && selectedProductInfo.type === 'fert' ? selectedProductInfo.total : Math.round(values.area * norms.fertNorm),

        pesticide: selectedProductInfo
          ? (selectedProductInfo.type !== 'fert' ? selectedProductInfo.name : `Рекомендация: ${norms.pesticide}`)
          : norms.pesticide,
        pestNorm: selectedProductInfo && selectedProductInfo.type !== 'fert' ? selectedProductInfo.norm : norms.pestNorm,
        pestTotal: selectedProductInfo && selectedProductInfo.type !== 'fert' ? selectedProductInfo.total : Math.round(values.area * norms.pestNorm * 100) / 100,

        cost: selectedProductInfo ? selectedProductInfo.cost : recommendationCost,
        status: 'active',
        productId: values.productId,
        category: values.category
      };

      setResult(res);
      setIsViewingArchive(false);
      setLoading(false);

      // Запись действия в журнал аудита
      const logEntry = {
        id: Date.now(),
        datetime: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }),
        user: localStorage.getItem('agro_user') ? JSON.parse(localStorage.getItem('agro_user'))?.username : 'admin',
        role: localStorage.getItem('agro_user') ? JSON.parse(localStorage.getItem('agro_user'))?.role : 'admin',
        action: `Проведен расчёт потребности для культуры: ${res.crop} (${res.area} га)`,
        ip: '127.0.0.1',
        status: 'success'
      };
      auditApi.createAuditLog(logEntry);
      MOCK_AUDIT_LOG.unshift(logEntry);
    }, 800);
  };

  const handleSave = () => {
    if (!result) return;
    if (isViewingArchive) {
      message.info('Этот расчет уже сохранен в истории');
      return;
    }
    const newHistory = [result, ...history];
    setHistory(newHistory);
    localStorage.setItem('agro_calc_history', JSON.stringify(newHistory));
    message.success('Расчет сохранен в историю');
  };

  const handleSoftDelete = (id) => {
    const updatedHistory = history.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, status: 'deleted' };
        
        // Запись действия в журнал аудита
        const logEntry = {
          id: Date.now(),
          datetime: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }),
          user: localStorage.getItem('agro_user') ? JSON.parse(localStorage.getItem('agro_user'))?.username : 'admin',
          role: localStorage.getItem('agro_user') ? JSON.parse(localStorage.getItem('agro_user'))?.role : 'admin',
          action: `Удален расчет потребности для культуры: ${item.crop} (${item.area} га)`,
          ip: '127.0.0.1',
          status: 'success'
        };
        auditApi.createAuditLog(logEntry);
        MOCK_AUDIT_LOG.unshift(logEntry);

        return updatedItem;
      }
      return item;
    });
    setHistory(updatedHistory);
    localStorage.setItem('agro_calc_history', JSON.stringify(updatedHistory));
    message.success('Расчет помечен как удаленный');

    // Если удалили просматриваемый расчет, сбрасываем отображение
    if (result && result.id === id) {
      setResult(null);
      setIsViewingArchive(false);
    }
  };

  const restoreParamsToForm = () => {
    if (!result) return;
    const allProducts = [...fertilizersList, ...pesticidesList];
    const restoredProduct = allProducts.find(p => p.id === result.productId);
    
    form.setFieldsValue({
      area: result.area,
      crop: result.crop,
      period: result.period,
      method: result.method,
      category: restoredProduct ? restoredProduct.categoryName : undefined,
      productId: result.productId
    });
    setSelectedFormCategory(restoredProduct ? restoredProduct.categoryName : undefined);
    setIsViewingArchive(false);
    message.success('Параметры успешно перенесены в форму');
  };

  const allProducts = [...fertilizersList, ...pesticidesList];

  const getPriceForSelected = () => {
    if (!result?.selectedProductInfo) return 0;
    if (result.selectedProductInfo.price) return result.selectedProductInfo.price;
    const prod = allProducts.find(p => p.id === result.productId || p.name === result.selectedProductInfo.name);
    return prod ? prod.price : 0;
  };

  const getPriceForRecFert = () => {
    if (!result) return null;
    if (result.recFertPrice !== undefined && result.recFertPrice !== null) return result.recFertPrice;
    const fertName = result.recFertilizer || result.fertilizer;
    if (!fertName) return null;
    const prod = allProducts.find(p => p.type === 'fert' && (p.name?.toLowerCase().includes(fertName.toLowerCase()) || fertName.toLowerCase().includes(p.name?.toLowerCase())));
    return prod ? prod.price : null;
  };

  const getPriceForRecPest = () => {
    if (!result) return null;
    if (result.recPestPrice !== undefined && result.recPestPrice !== null) return result.recPestPrice;
    const pestName = result.recPesticide || result.pesticide;
    if (!pestName) return null;
    const prod = allProducts.find(p => p.type !== 'fert' && (p.name?.toLowerCase().includes(pestName.toLowerCase()) || pestName.toLowerCase().includes(p.name?.toLowerCase())));
    return prod ? prod.price : null;
  };

  const recFertPrice = getPriceForRecFert();
  const recPestPrice = getPriceForRecPest();
  const selectedPrice = getPriceForSelected();

  const recFertCost = result && recFertPrice != null ? Math.round(result.area * (result.recFertNorm || result.fertNorm) * (recFertPrice / 1000)) : null;
  const recPestCost = result && recPestPrice != null ? Math.round(result.area * (result.recPestNorm || result.pestNorm) * recPestPrice) : null;

  return (
    <div>
      <Title level={2} className="agro-page-title">Онлайн-калькулятор потребности</Title>
      
      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <div className="agro-card">
            <Form form={form} layout="vertical" onFinish={onFinish} onValuesChange={handleValuesChange}>
              <Form.Item label="Площадь посевной площади (га)" name="area" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <InputNumber min={1} style={{ width: '100%' }} size="large" />
              </Form.Item>
              <Form.Item label="Вид культуры" name="crop" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Select size="large" placeholder="Выберите культуру" loading={loadingCultures} disabled={loadingCultures}>
                  {cultures.map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Категория препарата" name="category">
                    <Select size="large" placeholder="Все категории" allowClear onChange={(val) => setSelectedFormCategory(val)}>
                      {Array.from(new Set(
                        allProducts.map(p => p.categoryName).filter(Boolean)
                      )).sort().map(cat => (
                        <Option key={cat} value={cat}>{cat}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Препарат (Справочник)" name="productId">
                    <Select size="large" placeholder="Выберите препарат" allowClear showSearch optionFilterProp="children">
                      {allProducts
                        .filter(p => !selectedFormCategory || p.categoryName === selectedFormCategory)
                        .map(p => (
                          <Option key={p.id} value={p.id}>
                            {p.name} (₸ {p.price?.toLocaleString() || 0} / {p.type === 'fert' ? 'т' : 'ед.'})
                          </Option>
                        ))
                      }
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="Период применения" name="period" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Select size="large">
                  <Option value="Весна">Весна</Option>
                  <Option value="Лето">Лето</Option>
                  <Option value="Осень">Осень</Option>
                </Select>
              </Form.Item>
              <Form.Item label="Метод применения" name="method" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Select size="large">
                  <Option value="Внесение в почву">Внесение в почву</Option>
                  <Option value="Опрыскивание">Опрыскивание</Option>
                  <Option value="Фертигация">Фертигация</Option>
                </Select>
              </Form.Item>
              
              <Button type="primary" htmlType="submit" size="large" block icon={<CalculatorOutlined />} loading={loading}>
                Рассчитать потребность
              </Button>
            </Form>
          </div>
        </Col>

        <Col xs={24} md={12}>
          {result && (
            <Card 
              className="agro-card" 
              style={{ 
                background: isViewingArchive ? '#fffbe6' : '#f6ffed', 
                borderColor: isViewingArchive ? '#ffe58f' : '#b7eb8f' 
              }}
            >
              {isViewingArchive && (
                <Alert
                  message="Просмотр архивного расчета"
                  description={`Сохранен расчет от ${result.date} для площади ${result.area} га.`}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                  action={
                    <Button size="small" type="primary" onClick={restoreParamsToForm}>
                      Восстановить в форму
                    </Button>
                  }
                />
              )}
              <Title level={4} style={{ marginTop: 0, color: isViewingArchive ? '#d46b08' : '#135200' }}>
                {isViewingArchive ? 'Архивный результат расчета' : 'Результат расчета'}
              </Title>
              
              {result.selectedProductInfo ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 16, color: '#1890ff' }}>👉 Выбранный препарат: {result.selectedProductInfo.name}</Text>
                    <Tag style={{ marginLeft: 8 }} color="blue">{result.selectedProductInfo.categoryName}</Tag>
                    <br/>
                    <Text type="secondary">
                      📦 Норма: {result.selectedProductInfo.norm} {result.selectedProductInfo.unit} | 
                      Цена: <b>₸ {selectedPrice?.toLocaleString('ru-RU') || 0} / {result.selectedProductInfo.type === 'fert' ? 'т' : 'ед.'}</b> | 
                      Итого: <b>{result.selectedProductInfo.total.toLocaleString('ru-RU')} {result.selectedProductInfo.totalUnit}</b> | 
                      Стоимость: <b>₸ {result.selectedProductInfo.cost.toLocaleString('ru-RU')}</b>
                    </Text>
                  </div>

                  <div style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8, border: '1px solid #d9d9d9' }}>
                    <Text type="secondary">💰 Стоимость выбранного препарата (на основе цен из справочника):</Text>
                    <Title level={3} style={{ margin: 0, color: '#1a7c3e' }}>
                      ₸ {result.selectedProductInfo.cost.toLocaleString('ru-RU')}
                    </Title>
                  </div>

                  <Collapse ghost style={{ marginBottom: 16 }}>
                    <Collapse.Panel header="💡 Показать рекомендованную схему для культуры" key="rec">
                      <div style={{ marginBottom: 8 }}>
                        <Text strong>🌾 Удобрение: {result.recFertilizer || result.fertilizer}</Text><br/>
                        <Text type="secondary">
                          Норма: {result.recFertNorm || result.fertNorm} кг/га 
                          {recFertPrice != null && ` | Цена: ₸ ${recFertPrice.toLocaleString('ru-RU')} / т`} | 
                          Итого: {(result.recFertTotal || result.fertTotal).toLocaleString('ru-RU')} кг 
                          {recFertCost != null && ` | Стоимость: ₸ ${recFertCost.toLocaleString('ru-RU')}`}
                        </Text>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <Text strong>🌿 Пестицид: {result.recPesticide || result.pesticide}</Text><br/>
                        <Text type="secondary">
                          Норма: {result.recPestNorm || result.pestNorm} л/га 
                          {recPestPrice != null && ` | Цена: ₸ ${recPestPrice.toLocaleString('ru-RU')} / ед.`} | 
                          Итого: {(result.recPestTotal || result.pestTotal).toLocaleString('ru-RU')} л 
                          {recPestCost != null && ` | Стоимость: ₸ ${recPestCost.toLocaleString('ru-RU')}`}
                        </Text>
                      </div>
                      <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px dashed #d9d9d9' }}>
                        <Text type="secondary">Ориентировочная стоимость схемы: </Text>
                        <Text strong style={{ color: '#52c41a' }}>₸ {(result.recCost || result.cost).toLocaleString('ru-RU')}</Text>
                      </div>
                    </Collapse.Panel>
                  </Collapse>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 16 }}>✅ Рекомендованное удобрение: {result.fertilizer}</Text><br/>
                    <Text type="secondary">
                      📦 Норма: {result.fertNorm} кг/га 
                      {recFertPrice != null && ` | Цена: ₸ ${recFertPrice.toLocaleString('ru-RU')} / т`} | 
                      Итого: <b>{result.fertTotal.toLocaleString('ru-RU')} кг</b>
                      {recFertCost != null && ` | Стоимость: ₸ ${recFertCost.toLocaleString('ru-RU')}`}
                    </Text>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 16 }}>✅ Рекомендованный пестицид: {result.pesticide}</Text><br/>
                    <Text type="secondary">
                      💧 Норма: {result.pestNorm} л/га 
                      {recPestPrice != null && ` | Цена: ₸ ${recPestPrice.toLocaleString('ru-RU')} / ед.`} | 
                      Итого: <b>{result.pestTotal.toLocaleString('ru-RU')} л</b>
                      {recPestCost != null && ` | Стоимость: ₸ ${recPestCost.toLocaleString('ru-RU')}`}
                    </Text>
                  </div>

                  <div style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8, border: '1px solid #d9d9d9' }}>
                    <Text type="secondary">💰 Расчётная стоимость схемы (на основе цен из справочника):</Text>
                    <Title level={3} style={{ margin: 0, color: '#1a7c3e' }}>
                      ₸ {result.cost.toLocaleString('ru-RU')}
                    </Title>
                  </div>
                </>
              )}

              <Alert 
                message="ℹ️ Обратите внимание!" 
                description={`Рекомендация скорректирована для периода "${result.period}" и метода "${result.method}".`}
                type="info"
                style={{ marginBottom: 16 }}
              />

              {!isViewingArchive && (
                <Button type="dashed" block icon={<SaveOutlined />} onClick={handleSave}>
                  Сохранить расчёт
                </Button>
              )}
            </Card>
          )}

          <Collapse style={{ marginTop: 24 }} defaultActiveKey={['1']}>
            <Collapse.Panel 
              header={
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', width: '100%', paddingRight: 16, alignItems: 'center' }} 
                  onClick={(e) => e.stopPropagation()}
                >
                  <span><HistoryOutlined /> История расчётов</span>
                  <Checkbox checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)}>
                    Показать удаленные
                  </Checkbox>
                </div>
              } 
              key="1"
            >
              <List
                size="small"
                dataSource={history.filter(item => showDeleted || item.status !== 'deleted')}
                locale={{ emptyText: 'История пуста' }}
                renderItem={item => (
                  <List.Item
                    actions={[
                      item.status !== 'deleted' ? (
                        <Button 
                          type="text" 
                          danger 
                          icon={<DeleteOutlined />} 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSoftDelete(item.id);
                          }} 
                        />
                      ) : (
                        <Tag color="red">Удален</Tag>
                      )
                    ]}
                    style={{ 
                      cursor: item.status !== 'deleted' ? 'pointer' : 'default', 
                      background: result?.id === item.id ? '#e6f7ff' : 'transparent',
                      padding: '8px 12px',
                      borderRadius: 4,
                      marginBottom: 4,
                      border: result?.id === item.id ? '1px solid #91d5ff' : '1px solid transparent'
                    }}
                    onClick={() => {
                      if (item.status !== 'deleted') {
                        setResult(item);
                        setIsViewingArchive(true);
                      }
                    }}
                  >
                    <div style={{ textDecoration: item.status === 'deleted' ? 'line-through' : 'none', color: item.status === 'deleted' ? '#bfbfbf' : 'inherit' }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>{item.date}</Text><br/>
                      <b>{item.crop}</b> ({item.area} га): {item.fertilizer} & {item.pesticide} <Tag color={item.status === 'deleted' ? 'default' : 'green'} style={{ marginLeft: 8 }}>₸ {item.cost.toLocaleString('ru-RU')}</Tag>
                    </div>
                  </List.Item>
                )}
              />
            </Collapse.Panel>
          </Collapse>
        </Col>
      </Row>
    </div>
  );
};

export default Calculator;
