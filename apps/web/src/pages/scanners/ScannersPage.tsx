import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import { createScanner, deleteScanner, getProcesses, getScanners, updateScanner, type Scanner, type ScannerInput } from '../../services/api';
import { formatDateTimeWithSeconds } from '../../utils/datetime';

export function ScannersPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Scanner | null>(null);
  const [form] = Form.useForm<ScannerInput>();
  const queryClient = useQueryClient();

  const { data: scanners = [], isLoading } = useQuery({
    queryKey: ['scanners'],
    queryFn: getScanners,
    retry: false,
    refetchInterval: 5000,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ['processes'],
    queryFn: getProcesses,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (values: ScannerInput) => (editing ? updateScanner(editing.id, values) : createScanner(values)),
    onSuccess: () => {
      message.success('扫码枪已保存');
      setOpen(false);
      setEditing(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['scanners'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteScanner,
    onSuccess: () => {
      message.success('扫码枪已删除');
      queryClient.invalidateQueries({ queryKey: ['scanners'] });
    },
  });

  const openEditor = (record?: Scanner) => {
    setEditing(record ?? null);
    form.setFieldsValue(
      record
        ? {
            code: record.code,
            name: record.name,
            ipAddress: record.ipAddress,
            processStepId: record.processStep?.id,
            enabled: record.enabled,
          }
        : {
            code: '',
            name: '',
            ipAddress: '',
            processStepId: processes[0]?.id,
            enabled: true,
          },
    );
    setOpen(true);
  };

  return (
    <>
      <div className="page-toolbar">
        <div>
          <Typography.Title level={2} className="page-title">
            扫码枪管理
          </Typography.Title>
          <div className="page-kicker">每个固定扫码枪绑定一道工序，产品到达工位后扫码即进入该工序。</div>
        </div>
        <Button type="primary" onClick={() => openEditor()}>
          登记扫码枪
        </Button>
      </div>
      <Card className="module-card">
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={scanners}
          locale={{ emptyText: '暂无扫码枪，请先登记现场扫码枪' }}
          columns={[
            { title: '编号', dataIndex: 'code' },
            { title: '名称', dataIndex: 'name' },
            { title: '绑定工序', render: (_, record) => record.processStep?.name ?? '-', width: 110 },
            { title: 'IP 地址', dataIndex: 'ipAddress', width: 140 },
            {
              title: '最近上报',
              dataIndex: 'lastSeenAt',
              width: 160,
              render: (value: string | undefined) => formatDateTimeWithSeconds(value),
            },
            {
              title: '启用状态',
              dataIndex: 'enabled',
              width: 100,
              render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag>,
            },
            {
              title: '操作',
              render: (_, record) => (
                <Space>
                  <a onClick={() => openEditor(record)}>编辑</a>
                  <Popconfirm title="确认删除该扫码枪？" onConfirm={() => deleteMutation.mutate(record.id)}>
                    <a>删除</a>
                  </Popconfirm>
                </Space>
              ),
              width: 120,
            },
          ]}
        />
      </Card>
      <Modal
        title={editing ? '编辑扫码枪' : '登记扫码枪'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" autoComplete="off" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="code" label="扫码枪编号" rules={[{ required: true, message: '请输入扫码枪编号' }]}>
            <Input autoComplete="off" placeholder="请输入扫码枪编号" />
          </Form.Item>
          <Form.Item name="name" label="扫码枪名称" rules={[{ required: true, message: '请输入扫码枪名称' }]}>
            <Input autoComplete="off" placeholder="请输入扫码枪名称" />
          </Form.Item>
          <Form.Item name="processStepId" label="绑定工序" rules={[{ required: true, message: '请选择绑定工序' }]}>
            <Select placeholder="选择工序" options={processes.map((item) => ({ label: item.name, value: item.id }))} />
          </Form.Item>
          <Form.Item name="ipAddress" label="IP 地址">
            <Input autoComplete="off" placeholder="请输入 IP 地址" />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
