import { useState, useEffect } from 'react';
import { Typography, Table, Button, Input, Modal, Form, Space, Tag, Select, message, Row, Col, Alert } from 'antd';
import { InteractionOutlined, CopyOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { organizationsApi } from '../api/organizationsApi';

const { Title, Text } = Typography;
const { Option } = Select;

const Organizations = () => {
  const { role } = useAuth();

  // Deduplication helper for company names matching Backend's implementation
  const normalizeId = (name) => {
    if (!name) return '';
    let id = name.trim().toUpperCase();
    id = id.replace(/\bTOO\b/g, 'ТОО');
    id = id.replace(/\bIP\b/g, 'ИП');
    id = id.replace(/\bKX\b/g, 'КХ');
    id = id.replace(/["'«»“”]/g, '');
    id = id.replace(/\s+/g, ' ');
    return id;
  };

  const [orgsData, setOrgsData] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsSearch, setOrgsSearch] = useState('');
  const [orgsPagination, setOrgsPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [mergeForm] = Form.useForm();
  const [mergeSaving, setMergeSaving] = useState(false);
  const [allOrgsList, setAllOrgsList] = useState([]);

  // Fetch Contractors
  const fetchOrganizations = async (page = 1, size = 10, search = '') => {
    setOrgsLoading(true);
    try {
      const res = await organizationsApi.getAll({
        page: page - 1,
        size: size,
        search: search
      });
      if (Array.isArray(res.data)) {
        setOrgsData(res.data);
        setOrgsPagination({
          current: 1,
          pageSize: res.data.length,
          total: res.data.length
        });
      } else {
        setOrgsData(res.data?.content || []);
        setOrgsPagination({
          current: page,
          pageSize: size,
          total: res.data?.totalElements || 0
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOrgsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations(1, 10, orgsSearch);
  }, []);

  // Load list of organizations for select options
  const loadAllOrgsForMerge = async () => {
    try {
      const res = await organizationsApi.getAll({ page: 0, size: 1000 });
      setAllOrgsList(res.data?.content || res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (mergeModalVisible) {
      loadAllOrgsForMerge();
    }
  }, [mergeModalVisible]);

  // Merge Form Submission
  const handleMergeSubmit = async (values) => {
    if (values.sourceId === values.targetId) {
      message.error('Нельзя объединить организацию саму с собой');
      return;
    }
    setMergeSaving(true);
    try {
      await organizationsApi.merge(values.sourceId, values.targetId);
      message.success('Организации успешно объединены');
      setMergeModalVisible(false);
      mergeForm.resetFields();
      fetchOrganizations(orgsPagination.current, orgsPagination.pageSize, orgsSearch);
    } catch (err) {
      console.error(err);
    } finally {
      setMergeSaving(false);
    }
  };

  return (
    <div>


      <div className="agro-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <Space wrap>
            <Input.Search
              placeholder="Поиск по названию или БИН..."
              style={{ width: 320 }}
              allowClear
              value={orgsSearch}
              onChange={e => {
                setOrgsSearch(e.target.value);
                fetchOrganizations(1, orgsPagination.pageSize, e.target.value);
              }}
              onSearch={val => fetchOrganizations(1, orgsPagination.pageSize, val)}
            />
          </Space>
          {(role === 'admin' || role === 'staff') && (
            <Button type="primary" icon={<InteractionOutlined />} onClick={() => setMergeModalVisible(true)}>
              Объединить дубликаты
            </Button>
          )}
        </div>

        <Table
          columns={[
            {
              title: 'БИН (Хеш SHA-256)',
              dataIndex: 'binHash',
              key: 'binHash',
              width: 280,
              render: (hash) => {
                if (!hash) return <Tag>—</Tag>;
                const display = `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
                return (
                  <Space>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{display}</span>
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<CopyOutlined />} 
                      onClick={() => {
                        navigator.clipboard.writeText(hash);
                        message.success('Хеш БИН скопирован в буфер обмена');
                      }} 
                    />
                  </Space>
                );
              }
            },
            {
              title: 'Наименование контрагента',
              dataIndex: 'name',
              key: 'name',
              render: (name) => <Text strong>{name}</Text>
            },
            {
              title: 'Действия',
              key: 'actions',
              width: 150,
              render: (_, record) => {
                if (role !== 'admin' && role !== 'staff') return null;
                return (
                  <Button 
                    size="small" 
                    icon={<InteractionOutlined />} 
                    onClick={() => {
                      mergeForm.setFieldsValue({ targetId: record.id });
                      setMergeModalVisible(true);
                    }}
                  >
                    Слияние
                  </Button>
                );
              }
            }
          ]}
          dataSource={orgsData.map(o => ({ ...o, key: o.id }))}
          loading={orgsLoading}
          pagination={{
            current: orgsPagination.current,
            pageSize: orgsPagination.pageSize,
            total: orgsPagination.total,
            showSizeChanger: true,
            onChange: (page, pageSize) => fetchOrganizations(page, pageSize, orgsSearch)
          }}
          rowClassName={(r, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
        />
      </div>

      <Modal
        title="Слияние дубликатов контрагентов"
        open={mergeModalVisible}
        onCancel={() => { setMergeModalVisible(false); mergeForm.resetFields(); }}
        footer={null}
        width={500}
      >
        <Alert
          message="Внимание!"
          description="Все связанные записи сборов урожая, таможенных деклараций, заявок на субсидии и счетов-фактур (ЭСФ) будут перенесены на основную организацию. Исходная организация-дубликат будет безвозвратно удалена."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={mergeForm} layout="vertical" onFinish={handleMergeSubmit}>
          <Form.Item 
            name="sourceId" 
            label="Организация-дубликат (будет УДАЛЕНА)" 
            rules={[{ required: true, message: 'Выберите дубликат' }]}
          >
            <Select 
              showSearch 
              placeholder="Выберите дубликат для удаления" 
              optionFilterProp="children"
            >
              {allOrgsList.map(o => (
                <Option key={o.id} value={o.id}>{o.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item 
            name="targetId" 
            label="Основная организация (будет СОХРАНЕНА)" 
            rules={[{ required: true, message: 'Выберите основную организацию' }]}
          >
            <Select 
              showSearch 
              placeholder="Выберите основную организацию для слияния" 
              optionFilterProp="children"
            >
              {allOrgsList.map(o => (
                <Option key={o.id} value={o.id}>{o.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Button type="primary" htmlType="submit" block size="large" loading={mergeSaving}>
            Выполнить объединение
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default Organizations;
