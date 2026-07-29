import { LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Segmented, Switch, Typography, message } from 'antd';
import {
  changeAdminPassword,
  getSettings,
  updateSettings,
  type ScreenListFontSize,
} from '../../services/api';

type PasswordForm = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const screenListFontSizeOptions: Array<{
  label: string;
  value: ScreenListFontSize;
}> = [
  { label: '小号', value: 'SMALL' },
  { label: '标准', value: 'STANDARD' },
  { label: '大号', value: 'LARGE' },
  { label: '特大', value: 'EXTRA_LARGE' },
];

export function SettingsPage() {
  const [form] = Form.useForm<PasswordForm>();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordForm) => changeAdminPassword(values.oldPassword, values.newPassword),
    onSuccess: () => {
      message.success('管理员密码已修改');
      form.resetFields();
    },
    onError: () => {
      message.error('密码修改失败，请检查原密码');
    },
  });

  const settingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: async (savedSettings) => {
      message.success('大屏设置已保存');
      queryClient.setQueryData(['settings'], savedSettings);
      queryClient.setQueryData(['public-settings'], savedSettings);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await queryClient.invalidateQueries({ queryKey: ['public-settings'] });
    },
    onError: () => {
      message.error('设置保存失败');
    },
  });

  function changeScreenPreviewDataEnabled(checked: boolean) {
    settingsMutation.mutate({ screenPreviewDataEnabled: checked });
  }

  function changeScreenListFontSize(value: ScreenListFontSize) {
    settingsMutation.mutate({ screenListFontSize: value });
  }

  return (
    <>
      <div className="page-toolbar">
        <div>
          <Typography.Title level={2} className="page-title">
            系统设置
          </Typography.Title>
          <div className="page-kicker">维护管理员密码和大屏看板展示配置。</div>
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-main-column">
          <Card className="module-card settings-card">
            <div className="settings-card-head">
              <span className="settings-icon">
                <SafetyCertificateOutlined />
              </span>
              <div>
                <Typography.Title level={3}>管理员密码</Typography.Title>
                <Typography.Text type="secondary">修改当前登录管理员的后台访问密码。</Typography.Text>
              </div>
            </div>

            <Form
              form={form}
              layout="vertical"
              className="settings-form"
              onFinish={(values) => passwordMutation.mutate(values)}
            >
              <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
                <Input.Password prefix={<UserOutlined />} placeholder="请输入当前管理员密码" />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '新密码至少 6 位' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="确认新密码"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请再次输入新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的新密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={passwordMutation.isPending}>
                保存修改
              </Button>
            </Form>
          </Card>

          <Card className="module-card settings-card">
            <div className="settings-card-head">
              <span className="settings-icon">
                <SafetyCertificateOutlined />
              </span>
              <div>
                <Typography.Title level={3}>大屏看板</Typography.Title>
                <Typography.Text type="secondary">配置大屏数据来源和产品列表字号。</Typography.Text>
              </div>
            </div>

            <div className="settings-display-options">
              <div className="settings-switch-row">
                <div>
                  <Typography.Text strong>大屏预览数据</Typography.Text>
                  <div className="settings-help-text">
                    开启后 `/screen` 使用模拟产品数据，关闭后显示真实产品流转数据。
                  </div>
                </div>
                <Switch
                  checked={settings?.screenPreviewDataEnabled ?? true}
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                  loading={settingsLoading || settingsMutation.isPending}
                  onChange={changeScreenPreviewDataEnabled}
                />
              </div>
              <div className="settings-switch-row settings-font-size-row">
                <div>
                  <Typography.Text strong>看板列表字号</Typography.Text>
                  <div className="settings-help-text">调整产品型号和已用时的显示大小。</div>
                </div>
                <Segmented
                  value={settings?.screenListFontSize ?? 'STANDARD'}
                  options={screenListFontSizeOptions}
                  disabled={settingsLoading || settingsMutation.isPending}
                  onChange={changeScreenListFontSize}
                />
              </div>
            </div>
          </Card>
        </div>

        <Card className="module-card settings-note">
          <Typography.Title level={3}>安全建议</Typography.Title>
          <ul>
            <li>密码建议不少于 8 位，包含数字和字母。</li>
            <li>修改密码后，请使用新密码重新登录其他后台浏览器。</li>
            <li>大屏看板无需登录，但会读取这里保存的大屏展示配置。</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
