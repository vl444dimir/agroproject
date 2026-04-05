import { useState, useEffect } from 'react';
import { Row, Col, Card, Form, InputNumber, Select, Button, Typography, Collapse, List, Tag } from 'antd';
import { CalculatorOutlined, SaveOutlined, HistoryOutlined } from '@ant-design/icons';
import { CALC_NORMS } from '../mock';

const { Title, Text } = Typography;
const { Option } = Select;

const Calculator = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('agro_calc_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const onFinish = (values) => {
    setLoading(true);
    setTimeout(() => {
      const norms = CALC_NORMS[values.crop];
      const res = {
        id: Date.now(),
        date: new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }),
        area: values.area,
        crop: values.crop,
        period: values.period,
        method: values.method,
        fertilizer: norms.fertilizer,
        fertNorm: norms.fertNorm,
        fertTotal: values.area * norms.fertNorm,
        pesticide: norms.pesticide,
        pestNorm: norms.pestNorm,
        pestTotal: values.area * norms.pestNorm,
        cost: values.area * norms.pricePerHa
      };
      setResult(res);
      setLoading(false);
    }, 800);
  };

  const handleSave = () => {
    if (!result) return;
    const newHistory = [result, ...history];
    setHistory(newHistory);
    localStorage.setItem('agro_calc_history', JSON.stringify(newHistory));
  };

  return (
    <div>
      <Title level={2} className="agro-page-title">Онлайн-калькулятор потребности</Title>
      
      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <div className="agro-card">
            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Form.Item label="Площадь посевной площади (га)" name="area" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <InputNumber min={1} style={{ width: '100%' }} size="large" />
              </Form.Item>
              <Form.Item label="Вид культуры" name="crop" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Select size="large">
                  {Object.keys(CALC_NORMS).map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
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
            <Card className="agro-card" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
              <Title level={4} style={{ marginTop: 0, color: '#135200' }}>Результат расчета</Title>
              
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 16 }}>✅ Рекомендуемое удобрение: {result.fertilizer}</Text><br/>
                <Text type="secondary">📦 Норма: {result.fertNorm} кг/га | Итого: <b>{result.fertTotal.toLocaleString('ru-RU')} кг</b></Text>
              </div>

              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 16 }}>✅ Рекомендуемый пестицид: {result.pesticide}</Text><br/>
                <Text type="secondary">💧 Норма: {result.pestNorm} л/га | Итого: <b>{result.pestTotal.toLocaleString('ru-RU')} л</b></Text>
              </div>

              <div style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8, border: '1px solid #d9d9d9' }}>
                <Text type="secondary">💰 Расчётная стоимость:</Text>
                <Title level={3} style={{ margin: 0, color: '#1a7c3e' }}>
                  ₸ {result.cost.toLocaleString('ru-RU')}
                </Title>
              </div>

              <Alert 
                message="ℹ️ Обратите внимание!" 
                description={`Рекомендация скорректирована для периода "${result.period}" и метода "${result.method}".`}
                type="info"
                style={{ marginBottom: 16 }}
              />

              <Button type="dashed" block icon={<SaveOutlined />} onClick={handleSave}>
                Сохранить расчёт
              </Button>
            </Card>
          )}

          <Collapse style={{ marginTop: 24 }}>
            <Collapse.Panel header={<><HistoryOutlined /> История расчётов</>} key="1">
              <List
                size="small"
                dataSource={history}
                locale={{ emptyText: 'История пуста' }}
                renderItem={item => (
                  <List.Item>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.date}</Text><br/>
                      <b>{item.crop}</b> ({item.area} га): {item.fertilizer} & {item.pesticide} <Tag color="green" style={{ marginLeft: 8 }}>₸ {item.cost.toLocaleString('ru-RU')}</Tag>
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
  
// Need to add Alert to imports
import { Alert } from 'antd';
// Will just fix export issue manually below inline:
export default Calculator;
