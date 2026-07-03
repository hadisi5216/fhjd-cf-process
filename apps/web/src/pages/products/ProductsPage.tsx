import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  createProduct,
  deleteProduct,
  getProcesses,
  getProducts,
  updateProduct,
  type Product,
  type ProductInput,
} from '../../services/api';

const statusOptions: Array<{ label: string; value: Product['status'] }> = [
  { label: '待扫码', value: 'PENDING' },
  { label: '加工中', value: 'IN_PROGRESS' },
  { label: '已完工', value: 'FINISHED' },
  { label: '已超时', value: 'OVERDUE' },
];

function readStatusParam(value: string | null): Product['status'] | undefined {
  return statusOptions.some((item) => item.value === value) ? (value as Product['status']) : undefined;
}

function statusLabel(status: Product['status']) {
  const map = {
    PENDING: '待扫码',
    IN_PROGRESS: '加工中',
    FINISHED: '已完工',
    OVERDUE: '已超时',
  };
  return map[status];
}

function statusColor(status: Product['status']) {
  if (status === 'OVERDUE') return 'red';
  if (status === 'FINISHED') return 'green';
  if (status === 'IN_PROGRESS') return '#126e78';
  return 'default';
}

export function ProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<Product['status'] | undefined>(() => readStatusParam(statusParam));
  const [processId, setProcessId] = useState<number | undefined>();
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<ProductInput>();
  const queryClient = useQueryClient();

  useEffect(() => {
    setStatus(readStatusParam(statusParam));
  }, [statusParam]);

  const { data: processes = [] } = useQuery({
    queryKey: ['processes'],
    queryFn: getProcesses,
    retry: false,
  });

  const { data = [], isLoading, isFetching } = useQuery({
    queryKey: ['products', keyword, status, processId],
    queryFn: () => getProducts(keyword, status, processId),
    placeholderData: (previousData) => previousData,
  });

  const saveMutation = useMutation({
    mutationFn: (values: ProductInput) => (editing ? updateProduct(editing.id, values) : createProduct(values)),
    onSuccess: async () => {
      message.success(editing ? '产品已更新' : '产品已新增');
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      message.success('产品已删除');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ quantity: 1, unit: '件' });
    setModalOpen(true);
  }

  function openEdit(record: Product) {
    setEditing(record);
    form.setFieldsValue({
      productName: record.productName,
      productModel: record.productModel,
      serialNo: record.serialNo,
      quantity: record.quantity,
      unit: record.unit,
      remark: record.remark,
    });
    setModalOpen(true);
  }

  function openDetail(id: number) {
    navigate(`/products/${id}`);
  }

  function clearFilters() {
    setKeyword('');
    setStatus(undefined);
    setProcessId(undefined);
    setSearchParams({}, { replace: true });
  }

  function changeStatus(nextStatus?: Product['status']) {
    setStatus(nextStatus);
    const nextParams = new URLSearchParams(searchParams);
    if (nextStatus) {
      nextParams.set('status', nextStatus);
    } else {
      nextParams.delete('status');
    }
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <>
      <div className="page-toolbar">
        <div>
          <Typography.Title level={2} className="page-title">
            产品管理
          </Typography.Title>
          <div className="page-kicker">手动维护产品档案，扫码枪按二维码内容识别产品并记录流转。</div>
        </div>
        <Button type="primary" onClick={openCreate}>
          新增产品
        </Button>
      </div>

      <Card className="module-card">
        <div className="table-tools product-filters">
          <Space wrap>
            <Input.Search
              placeholder="搜索产品名称 / 型号 / 流水号"
              allowClear
              value={keyword}
              style={{ width: 300 }}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={setKeyword}
            />
            <Select
              allowClear
              placeholder="按工序筛选"
              value={processId}
              style={{ width: 180 }}
              options={processes.map((item) => ({ label: item.name, value: item.id }))}
              onChange={setProcessId}
            />
            <Select
              allowClear
              placeholder="按状态筛选"
              value={status}
              style={{ width: 160 }}
              options={statusOptions}
              onChange={changeStatus}
            />
            <Button onClick={clearFilters}>重置</Button>
          </Space>
          <Tag color="#126e78">当前仅支持手动单条维护</Tag>
        </div>
        <Table
          rowKey="id"
          loading={isLoading && !data.length}
          dataSource={data}
          locale={{ emptyText: '暂无产品数据' }}
          onRow={(record) => ({
            className: 'clickable-table-row',
            onClick: () => openDetail(record.id),
          })}
          columns={[
            {
              title: '产品名称',
              dataIndex: 'productName',
              render: (value: string, record) => (
                <a
                  onClick={(event) => {
                    event.stopPropagation();
                    openDetail(record.id);
                  }}
                >
                  {value}
                </a>
              ),
            },
            { title: '产品型号', dataIndex: 'productModel' },
            { title: '流水号', dataIndex: 'serialNo', width: 130 },
            { title: '数量', render: (_, record) => `${record.quantity} ${record.unit}`, width: 92 },
            { title: '当前工序', render: (_, record) => record.currentProcess?.name ?? '待扫码', width: 110 },
            {
              title: '状态',
              dataIndex: 'status',
              render: (value: Product['status']) => <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>,
              width: 100,
            },
            {
              title: '操作',
              width: 180,
              render: (_, record) => (
                <Space onClick={(event) => event.stopPropagation()}>
                  <a onClick={() => openDetail(record.id)}>详情</a>
                  <a onClick={() => openEdit(record)}>编辑</a>
                  <Popconfirm title="确认删除该产品？" onConfirm={() => deleteMutation.mutate(record.id)}>
                    <a>删除</a>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
        {isFetching && data.length > 0 ? <div className="table-refresh-hint">正在刷新数据...</div> : null}
      </Card>

      <Modal
        title={editing ? '编辑产品' : '新增产品'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="productName" label="产品名称" rules={[{ required: true, message: '请输入产品名称' }]}>
            <Input placeholder="例如：12号舵舱体" />
          </Form.Item>
          <Form.Item name="productModel" label="产品型号" rules={[{ required: true, message: '请输入产品型号' }]}>
            <Input placeholder="扫码内容当前按产品型号匹配" />
          </Form.Item>
          <Form.Item name="serialNo" label="流水号">
            <Input placeholder="例如：2606003" />
          </Form.Item>
          <Space style={{ width: '100%' }} align="start">
            <Form.Item name="quantity" label="数量" style={{ flex: 1 }}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="unit" label="单位" style={{ flex: 1 }}>
              <Input placeholder="件" />
            </Form.Item>
          </Space>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
