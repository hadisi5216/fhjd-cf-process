import {
  AlertOutlined,
  AppstoreOutlined,
  ClusterOutlined,
  DashboardOutlined,
  LogoutOutlined,
  SettingOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Badge, Button, Layout, Menu, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import fhjdLogo from '../assets/fhjd-logo-mark.png';
import { clearToken } from '../services/api';

const { Header, Content, Sider } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '后台首页' },
  { key: '/products', icon: <AppstoreOutlined />, label: '产品管理' },
  { key: '/processes', icon: <ClusterOutlined />, label: '工序配置' },
  { key: '/scanners', icon: <ToolOutlined />, label: '扫码枪管理' },
  { key: '/warnings', icon: <AlertOutlined />, label: '预警中心' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
  { key: '/screen', icon: <AppstoreOutlined />, label: '大屏看板' },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedKey = location.pathname.startsWith('/products/') ? '/products' : location.pathname;

  function logout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <Layout className="app-shell">
      <Sider width={236} theme="light" className="app-sider">
        <div className="app-logo">
          <img className="app-logo-image" src={fhjdLogo} alt="FHJD" />
          <span className="app-logo-text">
            产品加工流程
            <span className="app-logo-subtitle">厂房流转管理</span>
          </span>
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Typography.Title level={1} className="app-title">
            产品加工流程管理系统
          </Typography.Title>
          <div className="app-header-meta">
            <Badge status="processing" text="内网运行" />
            <Button size="small" onClick={() => navigate('/screen')}>
              打开大屏
            </Button>
            <Typography.Text type="secondary">系统管理员</Typography.Text>
            <Button size="small" icon={<LogoutOutlined />} onClick={logout}>
              退出
            </Button>
          </div>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
