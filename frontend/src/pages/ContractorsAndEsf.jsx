import { Tabs, Typography, Row, Col } from 'antd';
import { TeamOutlined, PartitionOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import Organizations from './Organizations';
import EsfRecords from './EsfRecords';

const { Title, Text } = Typography;

const ContractorsAndEsf = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey = location.pathname.includes('esf-records') ? 'esf' : 'organizations';

  const handleTabChange = (key) => {
    if (key === 'esf') {
      navigate('/esf-records');
    } else {
      navigate('/organizations');
    }
  };

  const tabItems = [
    {
      key: 'organizations',
      label: (
        <span>
          <TeamOutlined />
          Реестр контрагентов
        </span>
      ),
      children: <Organizations />,
    },
    {
      key: 'esf',
      label: (
        <span>
          <PartitionOutlined />
          Записи ЭСФ
        </span>
      ),
      children: <EsfRecords />,
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={2} className="agro-page-title" style={{ margin: 0 }}>Реестр контрагентов и ЭСФ</Title>
          <Text type="secondary">Управление контрагентами АПК, слияние дубликатов и ведение электронных счетов-фактур.</Text>
        </Col>
      </Row>
      <Tabs type="card" items={tabItems} activeKey={activeKey} onChange={handleTabChange} />
    </div>
  );
};

export default ContractorsAndEsf;
