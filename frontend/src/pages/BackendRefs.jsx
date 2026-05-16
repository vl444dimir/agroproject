import { useState, useEffect, useCallback } from 'react';
import { Typography, Tabs, Table, Button, Input, Modal, Form, Space, notification, Row, Spin, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, ExperimentOutlined, BankOutlined, TagsOutlined, EnvironmentOutlined, PartitionOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { manufacturersApi } from '../api/manufacturersApi';
import { categoriesApi } from '../api/categoriesApi';
import { culturesApi } from '../api/culturesApi';
import { ingredientsApi } from '../api/ingredientsApi';
import { districtsApi } from '../api/districtsApi';

const { Title } = Typography;

/* ────────────── Универсальный CRUD-таб ────────────── */

const CrudTab = ({ role, api, entityName, columns, formFields, rowKey = 'id' }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAll();
      setData(res.data || []);
    } catch {
      // обрабатывается глобально
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetch(); }, [fetch]);

  const openModal = (record = null) => {
    setEditingItem(record);
    if (record) {
      form.setFieldsValue(record);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (editingItem) {
        await api.update(editingItem.id, values);
        notification.success({ message: `${entityName} обновлён` });
      } else {
        await api.create(values);
        notification.success({ message: `${entityName} создан` });
      }
      setModalVisible(false);
      form.resetFields();
      fetch();
    } catch {
      // обрабатывается глобально
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(id);
      notification.success({ message: `${entityName} удалён` });
      fetch();
    } catch {
      // обрабатывается глобально
    }
  };

  const allColumns = [
    ...columns,
  ];

  if (role === 'admin' || role === 'staff') {
    allColumns.push({
      title: 'Действия',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          {role === 'admin' && (
            <Popconfirm
              title={`Удалить ${entityName.toLowerCase()}?`}
              description="Это действие нельзя отменить"
              onConfirm={() => handleDelete(record.id)}
              okText="Да"
              cancelText="Нет"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
    });
  }

  const filtered = data.filter(item =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="agro-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <Input.Search
          placeholder={`Поиск по ${entityName.toLowerCase()}...`}
          style={{ maxWidth: 350 }}
          allowClear
          onChange={e => setSearch(e.target.value)}
        />
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetch} loading={loading}>Обновить</Button>
          {(role === 'admin' || role === 'staff') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Добавить
            </Button>
          )}
        </Space>
      </div>

      <Table
        columns={allColumns}
        dataSource={filtered.map(r => ({ ...r, key: r[rowKey] }))}
        size="middle"
        loading={loading}
        locale={{ emptyText: 'Нет записей в базе данных' }}
        rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50'] }}
      />

      <Modal
        title={editingItem ? `Редактировать: ${entityName}` : `Новый ${entityName.toLowerCase()}`}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {formFields}
          <Button type="primary" htmlType="submit" block size="large" loading={saving} style={{ marginTop: 8 }}>
            {editingItem ? 'Сохранить изменения' : 'Создать'}
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

/* ────────────── Районы (read-only, только GET) ────────────── */

const DistrictTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await districtsApi.getAll();
      setData(res.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = data.filter(item =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="agro-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <Input.Search
          placeholder="Поиск по району..."
          style={{ maxWidth: 350 }}
          allowClear
          onChange={e => setSearch(e.target.value)}
        />
        <Button icon={<ReloadOutlined />} onClick={fetch} loading={loading}>Обновить</Button>
      </div>
      <Table
        columns={[
          { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
          { title: 'Наименование', dataIndex: 'name', key: 'name' },
        ]}
        dataSource={filtered.map(r => ({ ...r, key: r.id }))}
        size="middle"
        loading={loading}
        locale={{ emptyText: 'Нет записей в базе данных' }}
        rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50'] }}
      />
    </div>
  );
};

/* ────────────── Основная страница ────────────── */

const BackendRefs = () => {
  const { role } = useAuth();

  const tabItems = [
    {
      key: 'manufacturers',
      label: <><BankOutlined /> Производители</>,
      children: (
        <CrudTab
          role={role}
          api={manufacturersApi}
          entityName="Производитель"
          columns={[
            { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
            { title: 'Наименование', dataIndex: 'name', key: 'name' },
            { title: 'Страна', dataIndex: 'country', key: 'country', width: 150,
              render: val => val || <Tag>—</Tag>
            },
          ]}
          formFields={
            <>
              <Form.Item name="name" label="Наименование производителя" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Input placeholder="Например: Bayer CropScience" />
              </Form.Item>
              <Form.Item name="country" label="Страна">
                <Input placeholder="Например: Германия" />
              </Form.Item>
            </>
          }
        />
      ),
    },
    {
      key: 'categories',
      label: <><TagsOutlined /> Категории</>,
      children: (
        <CrudTab
          role={role}
          api={categoriesApi}
          entityName="Категория"
          columns={[
            { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
            { title: 'Наименование', dataIndex: 'name', key: 'name' },
          ]}
          formFields={
            <Form.Item name="name" label="Название категории" rules={[{ required: true, message: 'Обязательное поле' }]}>
              <Input placeholder="Например: Гербицид, Фунгицид, Инсектицид..." />
            </Form.Item>
          }
        />
      ),
    },
    {
      key: 'cultures',
      label: <><EnvironmentOutlined /> Культуры</>,
      children: (
        <CrudTab
          role={role}
          api={culturesApi}
          entityName="Культура"
          columns={[
            { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
            { title: 'Наименование', dataIndex: 'name', key: 'name' },
          ]}
          formFields={
            <Form.Item name="name" label="Название культуры" rules={[{ required: true, message: 'Обязательное поле' }]}>
              <Input placeholder="Например: Пшеница, Ячмень, Подсолнечник..." />
            </Form.Item>
          }
        />
      ),
    },
    {
      key: 'districts',
      label: <><PartitionOutlined /> Районы</>,
      children: <DistrictTab />,
    },
    {
      key: 'ingredients',
      label: <><ExperimentOutlined /> Действующие вещества</>,
      children: (
        <CrudTab
          role={role}
          api={ingredientsApi}
          entityName="Действующее вещество"
          columns={[
            { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
            { title: 'Наименование ДВ', dataIndex: 'name', key: 'name' },
          ]}
          formFields={
            <Form.Item name="name" label="Название действующего вещества" rules={[{ required: true, message: 'Обязательное поле' }]}>
              <Input placeholder="Например: Глифосат, Имазамокс, Тебуконазол..." />
            </Form.Item>
          }
        />
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={2} className="agro-page-title" style={{ margin: 0 }}>Справочники бэкенда</Title>
      </Row>

      <Tabs type="card" items={tabItems} />
    </div>
  );
};

export default BackendRefs;
