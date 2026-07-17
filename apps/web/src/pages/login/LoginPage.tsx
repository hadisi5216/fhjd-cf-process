import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { login, setToken } from '../../services/api';

type LoginForm = {
  username: string;
  password: string;
};

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as { from?: string; authExpired?: boolean } | null;
  const requestedFrom = locationState?.from ?? searchParams.get('from');
  const from = requestedFrom?.startsWith('/') && !requestedFrom.startsWith('//') ? requestedFrom : '/dashboard';
  const authExpired = locationState?.authExpired || searchParams.get('authExpired') === '1';

  useEffect(() => {
    if (authExpired) {
      message.warning({ content: '登录已失效，请重新登录', key: 'auth-expired' });
      navigate('/login', { replace: true, state: { from } });
    }
  }, [authExpired, from, navigate]);

  async function handleFinish(values: LoginForm) {
    setLoading(true);
    try {
      const result = await login(values.username, values.password);
      setToken(result.accessToken);
      message.success('登录成功');
      navigate(from, { replace: true });
    } catch {
      message.error('账号或密码错误');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-bg-line login-bg-line-a" />
      <div className="login-bg-line login-bg-line-b" />

      <section className="login-title-block">
        <Typography.Title level={1} className="login-system-name">
          产品加工流程管理系统
        </Typography.Title>
        <div className="login-system-subtitle">北京飞航吉达航空科技有限公司</div>
      </section>

      <section className="login-panel">
        <div className="login-form-head">
          <Typography.Title level={2} className="login-title">
            管理员登录
          </Typography.Title>
        </div>

        <Form layout="vertical" onFinish={handleFinish} initialValues={{ username: 'admin' }}>
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input size="large" prefix={<UserOutlined />} placeholder="管理员账号" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password size="large" prefix={<LockOutlined />} placeholder="管理员密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} size="large" block>
            登录后台
          </Button>
        </Form>

        <div className="login-footnote">大屏看板无需登录，可通过 /screen 直接访问。</div>
      </section>

      <footer className="login-copyright">© 2026 北京飞航吉达航空科技有限公司 版权所有</footer>
    </main>
  );
}
