import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Layout, Modal, notification } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      notification.success({ message: 'Вход выполнен успешно' });
      navigate('/');
    } catch (err) {
      notification.error({ message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Modal.info({
      title: 'Восстановление пароля',
      content: 'Обратитесь к администратору системы для сброса пароля.',
    });
  };

  return (
    <Layout style={{ minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f5f5f5' }}>
      <Card 
        className="agro-card" 
        style={{ width: '100%', maxWidth: 400, textAlign: 'center', padding: '12px' }}
      >
        <div style={{ marginBottom: 24, fontSize: 48 }}>🌿</div>
        <Title level={3} style={{ marginTop: 0, marginBottom: 8, color: '#262626' }}>
          АгроМониторинг
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 32 }}>
          Вход в систему
        </Text>

        <Form
          name="login_form"
          onFinish={onFinish}
          layout="vertical"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Пожалуйста, введите логин!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Логин" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Пожалуйста, введите пароль!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Пароль" size="large" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              Войти
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'right' }}>
            <Button type="link" onClick={handleForgotPassword} style={{ padding: 0 }}>
              Забыли пароль?
            </Button>
          </div>
        </Form>
      </Card>
    </Layout>
  );
};

export default Login;
