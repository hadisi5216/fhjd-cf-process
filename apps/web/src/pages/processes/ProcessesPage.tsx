import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import { createProcess, deleteProcess, getProcesses, updateProcess, type ProcessInput, type ProcessStep } from '../../services/api';

export function ProcessesPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessStep | null>(null);
  const [form] = Form.useForm<ProcessInput>();
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['processes'],
    queryFn: getProcesses,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (values: ProcessInput) => (editing ? updateProcess(editing.id, values) : createProcess(values)),
    onSuccess: () => {
      message.success('工序已保存');
      setOpen(false);
      setEditing(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProcess,
    onSuccess: () => {
      message.success('工序已删除');
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const openEditor = (record?: ProcessStep) => {
    setEditing(record ?? null);
    form.setFieldsValue(
      record ?? {
        name: '',
        sortOrder: data.length + 1,
        timeoutHours: 72,
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
            工序配置
          </Typography.Title>
          <div className="page-kicker">维护产品流转顺序和 72 小时滞留预警规则，扫码枪按工序绑定。</div>
        </div>
        <Button type="primary" onClick={() => openEditor()}>
          新增工序
        </Button>
      </div>
      <Card className="module-card">
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data}
          pagination={false}
          locale={{ emptyText: '暂无工序，请先新增工序' }}
          columns={[
            { title: '顺序', dataIndex: 'sortOrder', width: 80 },
            { title: '工序名称', dataIndex: 'name' },
            { title: '扫码枪', render: (_, record) => `${record._count?.scanners ?? 0} 台`, width: 100 },
            { title: '当前产品', render: (_, record) => `${record._count?.products ?? 0} 件`, width: 110 },
            { title: '超时阈值', dataIndex: 'timeoutHours', render: (value: number) => (value ? `${value} 小时` : '-'), width: 120 },
            { title: '状态', dataIndex: 'enabled', render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag>, width: 90 },
            {
              title: '操作',
              width: 130,
              render: (_, record) => (
                <Space>
                  <a onClick={() => openEditor(record)}>编辑</a>
                  <Popconfirm title="确认删除该工序？" onConfirm={() => deleteMutation.mutate(record.id)}>
                    <a>删除</a>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        title={editing ? '编辑工序' : '新增工序'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="name" label="工序名称" rules={[{ required: true, message: '请输入工序名称' }]}>
            <Input placeholder="例如：包覆" />
          </Form.Item>
          <Form.Item name="sortOrder" label="流转顺序" rules={[{ required: true, message: '请输入顺序' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="timeoutHours" label="超时阈值（小时）" rules={[{ required: true, message: '请输入超时阈值' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
