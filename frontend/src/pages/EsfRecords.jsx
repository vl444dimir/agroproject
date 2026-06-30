import { useState, useEffect } from 'react';
import { Typography, Table, Button, Input, Modal, Form, Space, InputNumber, Tag, Row, Col, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { esfRecordsApi } from '../api/esfRecordsApi';

const { Title, Text } = Typography;

const EsfRecords = () => {
  const { role } = useAuth();

  const [esfData, setEsfData] = useState([]);
  const [esfLoading, setEsfLoading] = useState(false);
  const [esfSearch, setEsfSearch] = useState('');
  const [esfPagination, setEsfPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [esfEditModalVisible, setEsfEditModalVisible] = useState(false);
  const [editingEsf, setEditingEsf] = useState(null);
  const [esfForm] = Form.useForm();
  const [esfSaving, setEsfSaving] = useState(false);

  // Fetch ESF Records
  const fetchEsfRecords = async (page = 1, size = 10, search = '') => {
    setEsfLoading(true);
    try {
      const res = await esfRecordsApi.getAll({
        page: page - 1,
        size: size,
        search: search
      });
      if (Array.isArray(res.data)) {
        setEsfData(res.data);
        setEsfPagination({
          current: 1,
          pageSize: res.data.length,
          total: res.data.length
        });
      } else {
        setEsfData(res.data?.content || []);
        setEsfPagination({
          current: page,
          pageSize: size,
          total: res.data?.totalElements || 0
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEsfLoading(false);
    }
  };

  useEffect(() => {
    fetchEsfRecords(1, 10, esfSearch);
  }, []);

  // ESF Edit Submission
  const handleEsfSubmit = async (values) => {
    setEsfSaving(true);
    try {
      const payload = {
        esfNumber: values.esfNumber,
        date: values.date,
        seller: values.seller,
        buyer: values.buyer,
        product: values.product,
        quantity: values.quantity,
        unitPrice: values.unitPrice,
      };
      if (values.sellerBin) payload.sellerBin = values.sellerBin;
      if (values.buyerBin) payload.buyerBin = values.buyerBin;

      await esfRecordsApi.update(editingEsf.id, payload);
      message.success('Запись ЭСФ успешно обновлена');
      setEsfEditModalVisible(false);
      esfForm.resetFields();
      fetchEsfRecords(esfPagination.current, esfPagination.pageSize, esfSearch);
    } catch (err) {
      console.error(err);
    } finally {
      setEsfSaving(false);
    }
  };

  return (
    <div>


      <div className="agro-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <Space wrap>
            <Input.Search
              placeholder="Поиск по поставщику, покупателю, продукту..."
              style={{ width: 350 }}
              allowClear
              value={esfSearch}
              onChange={e => {
                setEsfSearch(e.target.value);
                fetchEsfRecords(1, esfPagination.pageSize, e.target.value);
              }}
              onSearch={val => fetchEsfRecords(1, esfPagination.pageSize, val)}
            />
          </Space>
        </div>

        <Table
          columns={[
            { title: 'Номер ЭСФ', dataIndex: 'esfNumber', key: 'esfNumber', width: 130 },
            { title: 'Дата сделки', dataIndex: 'date', key: 'date', width: 110 },
            { 
              title: 'Продавец (Поставщик)', 
              dataIndex: 'seller', 
              key: 'seller',
              render: (text, record) => (
                <div>
                  <b>{text}</b>
                  <br />
                  <span style={{ color: '#8c8c8c', fontFamily: 'monospace', fontSize: '10px' }}>
                    {record.sellerBinHash ? `${record.sellerBinHash.substring(0, 10)}...` : '—'}
                  </span>
                </div>
              )
            },
            { 
              title: 'Покупатель (Звено)', 
              dataIndex: 'buyer', 
              key: 'buyer',
              render: (text, record) => (
                <div>
                  <b>{text}</b>
                  <br />
                  <span style={{ color: '#8c8c8c', fontFamily: 'monospace', fontSize: '10px' }}>
                    {record.buyerBinHash ? `${record.buyerBinHash.substring(0, 10)}...` : '—'}
                  </span>
                </div>
              )
            },
            { title: 'Препарат', dataIndex: 'product', key: 'product' },
            { 
              title: 'Объем (т/л)', 
              dataIndex: 'quantity', 
              key: 'quantity', 
              render: q => q != null ? q.toLocaleString() : '—',
              width: 120
            },
            { 
              title: 'Цена (₸)', 
              dataIndex: 'unitPrice', 
              key: 'unitPrice', 
              render: p => p != null ? p.toLocaleString() : '—',
              width: 120
            },
            { 
              title: 'Сумма (₸)', 
              key: 'totalPrice', 
              render: (_, record) => {
                const total = record.totalPrice || ((record.quantity || 0) * (record.unitPrice || 0));
                return total != null ? total.toLocaleString() : '—';
              },
              width: 130
            },
            {
              title: 'Действия',
              key: 'actions',
              width: 80,
              render: (_, record) => {
                if (role !== 'admin' && role !== 'staff') return null;
                return (
                  <Button 
                    size="small" 
                    icon={<EditOutlined />} 
                    onClick={() => {
                      setEditingEsf(record);
                      esfForm.setFieldsValue({
                        esfNumber: record.esfNumber,
                        date: record.date,
                        seller: record.seller,
                        sellerBin: '',
                        buyer: record.buyer,
                        buyerBin: '',
                        product: record.product,
                        quantity: record.quantity,
                        unitPrice: record.unitPrice,
                      });
                      setEsfEditModalVisible(true);
                    }}
                  />
                );
              }
            }
          ]}
          dataSource={esfData.map(r => ({ ...r, key: r.id }))}
          loading={esfLoading}
          pagination={{
            current: esfPagination.current,
            pageSize: esfPagination.pageSize,
            total: esfPagination.total,
            showSizeChanger: true,
            onChange: (page, pageSize) => fetchEsfRecords(page, pageSize, esfSearch)
          }}
          rowClassName={(r, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
        />
      </div>

      <Modal
        title={`Редактирование записи ЭСФ № ${editingEsf?.esfNumber}`}
        open={esfEditModalVisible}
        onCancel={() => { setEsfEditModalVisible(false); esfForm.resetFields(); }}
        footer={null}
        width={600}
      >
        <Form form={esfForm} layout="vertical" onFinish={handleEsfSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="esfNumber" label="Номер ЭСФ" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="date" label="Дата сделки" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Input placeholder="ГГГГ-ММ-ДД" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="seller" label="Наименование продавца (Поставщика)" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sellerBin" label="БИН продавца (оставьте пустым для сохранения без изменений)">
                <Input maxLength={12} placeholder="12 цифр БИН" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="buyer" label="Наименование покупателя (Звена)" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="buyerBin" label="БИН покупателя (оставьте пустым для сохранения без изменений)">
                <Input maxLength={12} placeholder="12 цифр БИН" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="product" label="Препарат / Продукт" rules={[{ required: true, message: 'Обязательное поле' }]}>
            <Input />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="quantity" label="Объем (т/л)" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unitPrice" label="Цена за ед. (₸)" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Button type="primary" htmlType="submit" block size="large" loading={esfSaving} style={{ marginTop: 16 }}>
            Сохранить изменения ЭСФ
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default EsfRecords;
