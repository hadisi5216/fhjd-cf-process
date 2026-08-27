import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { useState } from 'react';
import {
  createPersonnel,
  deletePersonnel,
  getApiErrorMessage,
  getPersonnel,
  getProcesses,
  updatePersonnel,
  type Personnel,
  type PersonnelInput,
} from '../../services/api';

export function PersonnelPage() {
  const [keyword, setKeyword] = useState('');
  const [processStepId, setProcessStepId] = useState<number>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Personnel | null>(null);
  const [form] = Form.useForm<PersonnelInput>();
  const queryClient = useQueryClient();

  const { data: personnel = [], isLoading } = useQuery({
    queryKey: ['personnel'],
    queryFn: () => getPersonnel(),
    retry: false,
  });
  const { data: processes = [] } = useQuery({
    queryKey: ['processes'],
    queryFn: getProcesses,
    retry: false,
  });
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  const filteredPersonnel = personnel.filter(
    (person) =>
      (!normalizedKeyword ||
        person.name.toLocaleLowerCase().includes(normalizedKeyword)) &&
      (!processStepId || person.processStepId === processStepId),
  );

  const saveMutation = useMutation({
    mutationFn: (values: PersonnelInput) =>
      editing
        ? updatePersonnel(editing.id, values)
        : createPersonnel(values),
    onSuccess: async () => {
      message.success(editing ? '人员信息已更新' : '人员已新增');
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['personnel'] }),
        queryClient.invalidateQueries({ queryKey: ['processes'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['product-detail'] }),
      ]);
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '人员保存失败，请稍后重试'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePersonnel,
    onSuccess: async () => {
      message.success('人员已删除');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['personnel'] }),
        queryClient.invalidateQueries({ queryKey: ['processes'] }),
      ]);
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '人员删除失败'));
    },
  });

  function openEditor(record?: Personnel) {
    setEditing(record ?? null);
    form.resetFields();
    form.setFieldsValue(
      record
        ? {
            name: record.name,
            processStepId: record.processStepId,
            enabled: record.enabled,
          }
        : { enabled: true },
    );
    setModalOpen(true);
  }

  return (
    <>
      <div className="page-toolbar">
        <div>
          <Typography.Title level={2} className="page-title">
            人员管理
          </Typography.Title>
          <div className="page-kicker">维护加工人员及其所属工序，用于产品工序负责人分配。</div>
        </div>
        <Button type="primary" onClick={() => openEditor()}>
          新增人员
        </Button>
      </div>

      <Card className="module-card">
        <div className="table-tools product-filters">
          <Space wrap>
            <Input.Search
              autoComplete="off"
              allowClear
              placeholder="搜索人员姓名"
              value={keyword}
              style={{ width: 260 }}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={setKeyword}
            />
            <Select
              allowClear
              placeholder="按工序筛选"
              value={processStepId}
              style={{ width: 180 }}
              options={processes.map((process) => ({
                label: process.name,
                value: process.id,
              }))}
              onChange={setProcessStepId}
            />
            <Button
              onClick={() => {
                setKeyword('');
                setProcessStepId(undefined);
              }}
            >
              重置
            </Button>
          </Space>
        </div>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={filteredPersonnel}
          pagination={false}
          locale={{
            emptyText:
              keyword || processStepId
                ? '暂无符合条件的人员'
                : '暂无人员，请先新增人员',
          }}
          columns={[
            { title: '人员姓名', dataIndex: 'name' },
            {
              title: '所属工序',
              dataIndex: ['processStep', 'name'],
              width: 180,
            },
            {
              title: '状态',
              dataIndex: 'enabled',
              width: 100,
              render: (value: boolean) => (
                <Tag color={value ? 'green' : 'default'}>
                  {value ? '启用' : '停用'}
                </Tag>
              ),
            },
            {
              title: '操作',
              width: 140,
              render: (_, record) => (
                <Space>
                  <a onClick={() => openEditor(record)}>编辑</a>
                  <Popconfirm
                    title="确认删除该人员？"
                    description="已被产品使用的人员不能删除，可以改为停用。"
                    onConfirm={() => deleteMutation.mutate(record.id)}
                  >
                    <a>删除</a>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? '编辑人员' : '新增人员'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
          onFinish={(values) => saveMutation.mutate(values)}
        >
          <Form.Item
            name="name"
            label="人员姓名"
            rules={[{ required: true, message: '请输入人员姓名' }]}
          >
            <Input autoComplete="off" placeholder="请输入人员姓名" />
          </Form.Item>
          <Form.Item
            name="processStepId"
            label="所属工序"
            rules={[{ required: true, message: '请选择所属工序' }]}
          >
            <Select
              placeholder="请选择所属工序"
              options={processes.map((process) => ({
                label: process.name,
                value: process.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
