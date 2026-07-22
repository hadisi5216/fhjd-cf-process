import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileOutlined,
  FilePdfOutlined,
  SwapOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  type FlowRecord,
  type ProductDrawing,
  deleteProductDrawing,
  getApiErrorMessage,
  getProcesses,
  getProduct,
  getProductDrawingFile,
  getProductDrawings,
  getProductFlows,
  uploadProductDrawing,
  updateProductManufacturingProcess,
  updateProductProcess,
} from '../../services/api';
import { formatDateTime } from '../../utils/datetime';

type ProcessForm = {
  processStepId: number;
};

type ManufacturingProcessForm = {
  manufacturingProcess?: string;
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

function isPdfDrawing(drawing: ProductDrawing) {
  return drawing.mimeType === 'application/pdf' || drawing.originalName.toLowerCase().endsWith('.pdf');
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function ProductDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const id = Number(params.id);
  const validId = Number.isFinite(id) && id > 0;
  const queryClient = useQueryClient();
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [manufacturingProcessModalOpen, setManufacturingProcessModalOpen] = useState(false);
  const [processForm] = Form.useForm<ProcessForm>();
  const [manufacturingProcessForm] = Form.useForm<ManufacturingProcessForm>();
  const drawingInputRef = useRef<HTMLInputElement>(null);

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

  const { data: drawings = [], isLoading: drawingsLoading } = useQuery({
    queryKey: ['product-drawings', id],
    queryFn: () => getProductDrawings(id),
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

  const updateManufacturingProcessMutation = useMutation({
    mutationFn: (values: ManufacturingProcessForm) =>
      updateProductManufacturingProcess(id, values.manufacturingProcess ?? ''),
    onSuccess: async () => {
      message.success('产品工艺已保存');
      setManufacturingProcessModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['product-detail', id] });
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '产品工艺保存失败，请稍后重试'));
    },
  });

  const uploadDrawingMutation = useMutation({
    mutationFn: (file: File) => uploadProductDrawing(id, file),
    onSuccess: async () => {
      message.success('产品图纸已上传');
      await queryClient.invalidateQueries({ queryKey: ['product-drawings', id] });
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '图纸上传失败，请稍后重试'));
    },
  });

  const deleteDrawingMutation = useMutation({
    mutationFn: (drawingId: number) => deleteProductDrawing(id, drawingId),
    onSuccess: async () => {
      message.success('产品图纸已删除');
      await queryClient.invalidateQueries({ queryKey: ['product-drawings', id] });
    },
    onError: () => {
      message.error('产品图纸删除失败');
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

  function openManufacturingProcessModal() {
    manufacturingProcessForm.setFieldsValue({
      manufacturingProcess: product?.manufacturingProcess,
    });
    setManufacturingProcessModalOpen(true);
  }

  async function submitManufacturingProcess() {
    const values = await manufacturingProcessForm.validateFields();
    updateManufacturingProcessMutation.mutate(values);
  }

  function selectDrawingFile() {
    drawingInputRef.current?.click();
  }

  function handleDrawingFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) uploadDrawingMutation.mutate(file);
  }

  async function previewDrawing(drawing: ProductDrawing) {
    const previewWindow = window.open('', '_blank');
    try {
      const file = await getProductDrawingFile(id, drawing.id);
      const url = URL.createObjectURL(new Blob([file], { type: drawing.mimeType }));
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      previewWindow?.close();
      message.error('PDF 图纸打开失败');
    }
  }

  async function downloadDrawing(drawing: ProductDrawing) {
    try {
      const file = await getProductDrawingFile(id, drawing.id);
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = drawing.originalName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      message.error('图纸下载失败');
    }
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

  const drawingColumns: ColumnsType<ProductDrawing> = [
    {
      title: '图纸名称',
      dataIndex: 'originalName',
      render: (value: string, record) => (
        <span className="drawing-file-name">
          {isPdfDrawing(record) ? <FilePdfOutlined className="is-pdf" /> : <FileOutlined />}
          {value}
        </span>
      ),
    },
    {
      title: '格式',
      width: 100,
      render: (_value, record) => record.originalName.split('.').pop()?.toUpperCase() ?? '-',
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 110,
      render: formatFileSize,
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      width: 180,
      render: formatDateTime,
    },
    {
      title: '操作',
      width: 210,
      render: (_value, record) => (
        <Space>
          {isPdfDrawing(record) ? (
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => previewDrawing(record)}>
              预览
            </Button>
          ) : null}
          <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => downloadDrawing(record)}>
            下载
          </Button>
          <Popconfirm title="确认删除该产品图纸？" onConfirm={() => deleteDrawingMutation.mutate(record.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
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

      <Card
        className="module-card detail-card"
        title="产品工艺"
        extra={
          <Button icon={<EditOutlined />} onClick={openManufacturingProcessModal}>
            编辑工艺
          </Button>
        }
      >
        {product.manufacturingProcess ? (
          <div className="manufacturing-process-content">{product.manufacturingProcess}</div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无产品工艺" />
        )}
      </Card>

      <Card
        className="module-card detail-card"
        title="产品图纸"
        extra={
          <>
            <input
              ref={drawingInputRef}
              className="drawing-file-input"
              type="file"
              accept=".pdf,.dwg,.dxf,.step,.stp,.iges,.igs,.prt,.asm,.x_t,.x_b,.jpg,.jpeg,.png,.tif,.tiff,.bmp"
              onChange={handleDrawingFileChange}
            />
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={uploadDrawingMutation.isPending}
              onClick={selectDrawingFile}
            >
              上传图纸
            </Button>
          </>
        }
      >
        <Table
          rowKey="id"
          columns={drawingColumns}
          dataSource={drawings}
          loading={drawingsLoading}
          pagination={false}
          locale={{ emptyText: '暂无产品图纸' }}
        />
        <div className="drawing-upload-hint">单个文件不超过 50 MB，PDF 支持在线预览，其他格式可下载查看。</div>
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
        title="编辑产品工艺"
        open={manufacturingProcessModalOpen}
        onCancel={() => setManufacturingProcessModalOpen(false)}
        onOk={submitManufacturingProcess}
        okText="保存"
        cancelText="取消"
        confirmLoading={updateManufacturingProcessMutation.isPending}
        width={720}
        destroyOnHidden
      >
        <Form form={manufacturingProcessForm} layout="vertical">
          <Form.Item
            name="manufacturingProcess"
            label="产品工艺"
            rules={[{ max: 5000, message: '产品工艺不能超过 5000 字' }]}
          >
            <Input.TextArea
              autoComplete="off"
              placeholder="请输入产品工艺"
              showCount
              maxLength={5000}
              autoSize={{ minRows: 8, maxRows: 16 }}
            />
          </Form.Item>
        </Form>
      </Modal>

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
