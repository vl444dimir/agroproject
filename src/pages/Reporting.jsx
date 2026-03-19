import { useState } from 'react';
import { Typography, Form, Select, Checkbox, Button, Row, Col, Card, Spin, Result, Space, Divider, message } from 'antd';
import { FileTextOutlined, FilterOutlined, RobotOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { MOCK_MAP_DISTRICTS, CALC_NORMS } from '../mock';

const { Title, Text } = Typography;
const { Option } = Select;

const Reporting = () => {
  const [form] = Form.useForm();
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultId, setResultId] = useState(null);
  const navigate = useNavigate();

  // Достаем уникальные районы и культуры из моков для выпадающих списков
  const districts = MOCK_MAP_DISTRICTS.map(d => d.name);
  const crops = Object.keys(CALC_NORMS || { "Пшеница": 1, "Ячмень": 1, "Кукуруза": 1 });

  const handleGenerate = (values) => {
    setIsGenerating(true);
    setResultId(null);

    // Имитация долгого запроса на бэкенд для формирования аналитики с ИИ
    setTimeout(() => {
      setIsGenerating(false);
      const newId = `REP-${Math.floor(1000 + Math.random() * 9000)}-${new Date().getFullYear()}`;
      setResultId(newId);
      message.success('Аналитический отчет успешно сформирован и сохранен!');
      
      // В реальном проекте: apiClient.post('/reports/generate', values)
    }, 2500);
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} className="agro-page-title" style={{ marginBottom: 0 }}>
            Конструктор кастомных аналитических отчетов
          </Title>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <div className="agro-card">
            <Title level={4} style={{ marginTop: 0, marginBottom: 24 }}><FilterOutlined /> Параметры и фильтры запроса</Title>
            <Form 
              form={form} 
              layout="vertical" 
              onFinish={handleGenerate}
              initialValues={{ years: ['2023', '2022'], ai_analysis: true, compare_districts: false }}
            >
              <Row gutter={16} align="bottom">
                <Col xs={24} sm={12}>
                  <Form.Item 
                    name="districts" 
                    label="Районы" 
                    tooltip="Оставьте поле пустым, чтобы включить в отчет весь регион целиком"
                  >
                    <Select mode="multiple" placeholder="Выберите районы" allowClear size="large">
                      {districts.map(d => <Option key={d} value={d}>{d}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="crops" label="Сельскохозяйственные культуры">
                    <Select mode="multiple" placeholder="Выберите культуры" allowClear size="large">
                      {crops.map(c => <Option key={c} value={c}>{c}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="years" label="Отчетные годы" rules={[{ required: true, message: 'Выберите как минимум один год' }]}>
                    <Select mode="multiple" placeholder="Выбрать годы" size="large">
                      <Option value="2023">2023 год</Option>
                      <Option value="2022">2022 год</Option>
                      <Option value="2021">2021 год</Option>
                      <Option value="2020">2020 год</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="format" label="Группировка" initialValue="dynamic">
                    <Select size="large">
                      <Option value="dynamic">В динамике по годам</Option>
                      <Option value="summary">Сводный за весь период</Option>
                      <Option value="monthly">Помесячная разбивка (сезонки)</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" style={{ margin: '16px 0' }}><SettingOutlined /> Параметры анализа</Divider>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Form.Item name="include_pesticides" valuePropName="checked" style={{ marginBottom: 8 }}>
                    <Checkbox>Учесть объемы внесенных пестицидов (корреляция спада урожая)</Checkbox>
                  </Form.Item>
                  <Form.Item name="compare_districts" valuePropName="checked" style={{ marginBottom: 8 }}>
                    <Checkbox>Включить сравнительный анализ показателей по районам</Checkbox>
                  </Form.Item>
                  <Form.Item name="calc_economics" valuePropName="checked" style={{ marginBottom: 8 }}>
                    <Checkbox>Запросить экономический срез (себестоимость га/урожая)</Checkbox>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Card size="small" style={{ background: '#f0f5ff', borderColor: '#adc6ff' }}>
                    <Form.Item name="ai_analysis" valuePropName="checked" style={{ marginBottom: 0 }}>
                      <Checkbox style={{ fontWeight: 'bold' }}>
                        <RobotOutlined style={{ color: '#1677ff', marginRight: 8 }} />
                        Применить ИИ-оценку рисков по фиктивным ЭСФ и цепочкам поставок
                      </Checkbox>
                    </Form.Item>
                    <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
                      Большая языковая модель (LLM) на стороне бэкенда найдет аномалии ценообразования. Операция может занять больше времени.
                    </Text>
                  </Card>
                </Col>
              </Row>

              <Form.Item style={{ marginTop: 32, marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" size="large" icon={<SettingOutlined />} loading={isGenerating}>
                  Сгенерировать отчет
                </Button>
                <Button type="default" onClick={() => form.resetFields()} size="large" style={{ marginLeft: 16 }}>
                  Сбросить
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <div className="agro-card" style={{ height: '100%' }}>
            {isGenerating ? (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <Spin size="large" />
                <Title level={5} style={{ marginTop: 24, fontWeight: 'normal' }}>
                  Сервер обрабатывает данные...<br />
                  <span style={{ fontSize: 14, color: '#888' }}>Подключение ИИ для поиска аномалий</span>
                </Title>
              </div>
            ) : resultId ? (
              <Result
                status="success"
                title="Отчет успешно сгенерирован!"
                subTitle={`Документ сохранен в базе под номером: ${resultId}`}
                extra={[
                  <Button type="primary" key="console" icon={<FileTextOutlined />} onClick={() => navigate('/reports')}>
                    Перейти в реестр отчетов
                  </Button>,
                  <Button key="buy" onClick={() => setResultId(null)}>Создать новый</Button>,
                ]}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <FileTextOutlined style={{ fontSize: 64, color: '#e8e8e8' }} />
                <Title level={4} style={{ color: '#bfbfbf', marginTop: 16 }}>Ждем ваших указаний</Title>
                <Text type="secondary">Заполните фильтры слева и нажмите «Сгенерировать», чтобы алгоритмы на сервере начали сводить статистику.</Text>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default Reporting;
