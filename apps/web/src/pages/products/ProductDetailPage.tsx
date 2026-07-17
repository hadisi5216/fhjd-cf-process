import { ArrowLeftOutlined, SwapOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Descriptions, Empty, Form, Modal, Select, Spin, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  type FlowRecord,
  getProcesses,
  getProduct,
  getProductFlows,
  updateProductProcess,
} from '../../services/api';
import { formatDateTime } from '../../utils/datetime';

type ProcessForm = {
  processStepId: number;
};

function statusText(value?: string) {
  const map: Record<string, string> = {
    PENDING: '待扫码',
    IN_PROGRESS: '加工中',
    FINISHED: '已完工',
    OVERDUE: '已超时',
  };
  return value ? (map[value] ?? value) : '-';
}

function statusColor(value?: string) {
  if (value === 'OVERDUE') return 'red';
  if (value === 'FINISHED') return 'green';
  if (value === 'IN_PROGRESS') return '#126e78';
  return 'default';
}

function flowSourceText(record: FlowRecord) {
  if (record.source === 'MANUAL') return '管理员调整';
  return record.isDuplicate ? '重复扫码' : '扫码进入';
}

function flowSourceColor(record: FlowRecord) {
  if (record.source === 'MANUAL' || record.isDuplicate) return '#f79009';
  return '#126e78';
}

export function ProductDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const id = Number(params.id);
  const validId = Number.isFinite(id) && id > 0;
  const queryClient = useQueryClient();
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [processForm] = Form.useForm<ProcessForm>();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product-detail', id],
    queryFn: () => getProduct(id),
    enabled: validId,
    retry: false,
  });

  const { data: flows = [] } = useQuery({
    queryKey: ['product-flows', id],
    queryFn: () => getProductFlows(id),
    enabled: Boolean(product?.id),
    retry: false,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ['processes'],
    queryFn: getProcesses,
    retry: false,
  });

  const processOptions = processes.map((item) => ({ label: item.name, value: item.id }));

  const changeProcessMutation = useMutation({
    mutationFn: (values: ProcessForm) => updateProductProcess(id, values.processStepId),
    onSuccess: async () => {
      message.success('产品当前工序已调整');
      setProcessModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['product-detail', id] });
      await queryClient.invalidateQueries({ queryKey: ['product-flows', id] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-products'] });
    },
    onError: () => {
      message.error('调整失败，请确认工序存在');
    },
  });

  function openProcessModal() {
    processForm.setFieldsValue({ processStepId: product?.currentProcess?.id ?? processOptions[0]?.value });
    setProcessModalOpen(true);
  }

  async function submitProcessChange() {
    const values = await processForm.validateFields();
    changeProcessMutation.mutate(values);
  }

  if (isLoading) {
    return (
      <div className="detail-loading">
        <Spin />
      </div>
    );
  }

  if (!product) {
    return (
      <Card className="module-card">
        <Empty description="未找到产品信息">
          <Button onClick={() => navigate('/products')}>返回产品管理</Button>
        </Empty>
      </Card>
    );
  }

  const flowColumns: ColumnsType<FlowRecord> = [
    {
      title: '序号',
      width: 70,
      render: (_value, _record, index) => index + 1,
    },
    {
      title: '经过工序',
      dataIndex: ['processStep', 'name'],
      render: (value?: string) => value ?? '-',
    },
    {
      title: '记录时间',
      dataIndex: 'scannedAt',
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: '来源',
      dataIndex: 'source',
      render: (_value, record) => <Tag color={flowSourceColor(record)}>{flowSourceText(record)}</Tag>,
    },
    {
      title: '扫码枪/操作',
      render: (_value, record) => {
        if (record.source === 'MANUAL') {
          return record.operator?.displayName ?? '管理员后台';
        }
        return record.scanner?.name ?? '-';
      },
    },
    {
      title: '扫码内容/说明',
      render: (_value, record) => record.note || record.scanContent || '-',
    },
  ];

  return (
    <>
      <div className="detail-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <div className="detail-heading">
          <Typography.Title level={2} className="page-title">
            {product.productName}
          </Typography.Title>
          <div className="page-kicker">
            产品详情 / {product.productModel} / 当前工序：{product.currentProcess?.name ?? '待扫码'}
          </div>
        </div>
        <Button className="detail-action-primary" type="primary" icon={<SwapOutlined />} onClick={openProcessModal}>
          手动调整工序
        </Button>
      </div>

      <Card className="module-card detail-card" title="基础信息">
        <Descriptions column={{ xs: 1, md: 2, xl: 3 }} bordered size="middle">
          <Descriptions.Item label="产品名称">{product.productName}</Descriptions.Item>
          <Descriptions.Item label="产品型号">{product.productModel}</Descriptions.Item>
          <Descriptions.Item label="流水号">{product.serialNo ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="数量">{`${product.quantity} ${product.unit}`}</Descriptions.Item>
          <Descriptions.Item label="当前工序">{product.currentProcess?.name ?? '待扫码'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColor(product.status)}>{statusText(product.status)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="当前工序进入时间">{formatDateTime(product.currentEnteredAt)}</Descriptions.Item>
          <Descriptions.Item label="录入时间">{formatDateTime(product.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatDateTime(product.updatedAt)}</Descriptions.Item>
          <Descriptions.Item label="备注" span={3}>
            {product.remark || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card className="module-card detail-card" title="工序流转记录">
        <Table
          rowKey="id"
          columns={flowColumns}
          dataSource={flows}
          pagination={false}
          locale={{ emptyText: '暂无工序流转记录' }}
        />
      </Card>

      <Modal
        title="手动调整工序"
        open={processModalOpen}
        onCancel={() => setProcessModalOpen(false)}
        onOk={submitProcessChange}
        okText="确认调整"
        cancelText="取消"
        confirmLoading={changeProcessMutation.isPending}
      >
        <Typography.Paragraph type="secondary">
          当产品已真实进入下一工序，但扫码枪异常、漏扫或误扫时，由管理员手动调整工序。保存后会新增一条管理员调整记录，并更新产品当前工序进入时间。
        </Typography.Paragraph>
        <Form form={processForm} layout="vertical">
          <Form.Item name="processStepId" label="当前工序" rules={[{ required: true, message: '请选择工序' }]}>
            <Select placeholder="请选择产品当前所在工序" options={processOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
