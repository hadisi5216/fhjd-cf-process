import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  createProduct,
  deleteProduct,
  exportProducts,
  getApiErrorMessage,
  getPersonnel,
  getProcesses,
  getProducts,
  updateProduct,
  voidProduct,
  type Product,
  type ProductInput,
} from '../../services/api';

type ProductFormValues = Omit<ProductInput, 'processOwners'> & {
  processOwnerIds?: Record<string, number>;
};

type VoidProductFormValues = {
  reason: string;
};

const statusOptions: Array<{ label: string; value: Product['status'] }> = [
  { label: '待扫码', value: 'PENDING' },
  { label: '加工中', value: 'IN_PROGRESS' },
  { label: '已完工', value: 'FINISHED' },
  { label: '已超时', value: 'OVERDUE' },
  { label: '已作废', value: 'VOIDED' },
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
    VOIDED: '已作废',
  };
  return map[status];
}

function statusColor(status: Product['status']) {
  if (status === 'OVERDUE') return 'red';
  if (status === 'FINISHED') return 'green';
  if (status === 'IN_PROGRESS') return '#126e78';
  if (status === 'VOIDED') return 'default';
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
  const [copyingFrom, setCopyingFrom] = useState<Product | null>(null);
  const [quickCreating, setQuickCreating] = useState(false);
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [voidingProduct, setVoidingProduct] = useState<Product | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [form] = Form.useForm<ProductFormValues>();
  const [voidForm] = Form.useForm<VoidProductFormValues>();
  const [modal, modalContextHolder] = Modal.useModal();
  const previousProductModelRef = useRef('');
  const queryClient = useQueryClient();

  useEffect(() => {
    setStatus(readStatusParam(statusParam));
  }, [statusParam]);

  const { data: processes = [] } = useQuery({
    queryKey: ['processes'],
    queryFn: getProcesses,
    retry: false,
  });
  const { data: personnel = [] } = useQuery({
    queryKey: ['personnel'],
    queryFn: () => getPersonnel(),
    retry: false,
  });
  const productionProcesses = processes.filter(
    (process) => process.enabled && process.name !== '完工',
  );

  const { data = [], isLoading, isFetching } = useQuery({
    queryKey: ['products', keyword, status, processId],
    queryFn: () => getProducts(keyword, status, processId),
    placeholderData: (previousData) => previousData,
  });

  const saveMutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const input = toProductInput(values, productionProcesses);
      return editing
        ? updateProduct(editing.id, input)
        : createProduct(input);
    },
    onSuccess: async (savedProduct) => {
      const wasEditing = Boolean(editing);
      const wasCopying = Boolean(copyingFrom);
      message.success(wasEditing ? '产品已更新' : wasCopying ? '产品已复制新增' : '产品已新增');
      if (wasEditing) {
        queryClient.setQueryData(['product-detail', savedProduct.id], savedProduct);
      }
      setModalOpen(false);
      setEditing(null);
      setCopyingFrom(null);
      setQuickCreating(false);
      form.resetFields();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['product-detail', savedProduct.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-products'] }),
        queryClient.invalidateQueries({ queryKey: ['screen-summary'] }),
      ]);
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, editing ? '产品更新失败，请稍后重试' : '产品新增失败，请稍后重试'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async (_result, deletedId) => {
      message.success('产品已删除');
      queryClient.removeQueries({ queryKey: ['product-detail', deletedId] });
      queryClient.removeQueries({ queryKey: ['product-flows', deletedId] });
      queryClient.removeQueries({ queryKey: ['product-drawings', deletedId] });
      queryClient.removeQueries({ queryKey: ['product-process-attachments', deletedId] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['warnings'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-products'] }),
        queryClient.invalidateQueries({ queryKey: ['screen-summary'] }),
      ]);
    },
    onError: (error) => {
      const errorMessage = getApiErrorMessage(error, '产品删除失败，请稍后重试');
      if (errorMessage === '该产品已有流转记录或预警记录，不能删除') {
        modal.warning({
          title: '无法删除产品',
          content: errorMessage,
          okText: '知道了',
          centered: true,
        });
        return;
      }
      message.error(errorMessage);
    },
  });

  const voidMutation = useMutation({
    mutationFn: (values: VoidProductFormValues) =>
      voidProduct(voidingProduct!.id, values.reason),
    onSuccess: async (voidedProduct) => {
      message.success('产品已作废');
      setVoidingProduct(null);
      voidForm.resetFields();
      queryClient.setQueryData(
        ['product-detail', voidedProduct.id],
        voidedProduct,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['warnings'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-products'] }),
        queryClient.invalidateQueries({ queryKey: ['screen-summary'] }),
      ]);
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '产品作废失败，请稍后重试'));
    },
  });

  function openCreate() {
    setEditing(null);
    setCopyingFrom(null);
    setQuickCreating(false);
    form.resetFields();
    previousProductModelRef.current = '';
    setModalOpen(true);
  }

  async function openQuickCreate() {
    setQuickCreateLoading(true);
    setCopyingFrom(null);
    try {
      const latestProducts = await queryClient.fetchQuery({
        queryKey: ['products', 'quick-create-source'],
        queryFn: () => getProducts(),
        staleTime: 0,
      });
      const latestProduct = latestProducts[0];

      setEditing(null);
      setQuickCreating(true);
      form.resetFields();
      const values = latestProduct
        ? getProductFormValues(latestProduct, true)
        : undefined;
      previousProductModelRef.current = values?.productModel ?? '';
      if (values) {
        form.setFieldsValue(values);
      }
      setModalOpen(true);

      if (!latestProduct) {
        message.info('暂无历史产品，已使用默认值');
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, '读取最近录入产品失败'));
    } finally {
      setQuickCreateLoading(false);
    }
  }

  function openEdit(record: Product) {
    setEditing(record);
    setCopyingFrom(null);
    setQuickCreating(false);
    form.resetFields();
    const values = getProductFormValues(record);
    previousProductModelRef.current = values.productModel;
    form.setFieldsValue(values);
    setModalOpen(true);
  }

  function openCopy(record: Product) {
    setEditing(null);
    setCopyingFrom(record);
    setQuickCreating(false);
    form.resetFields();
    const values = getProductFormValues(record, true);
    previousProductModelRef.current = values.productModel;
    form.setFieldsValue(values);
    setModalOpen(true);
  }

  function openDetail(id: number) {
    navigate(`/products/${id}`);
  }

  function syncTrackingCodeWithProductModel(
    changedValues: Partial<ProductFormValues>,
  ) {
    if (typeof changedValues.productModel !== 'string') return;
    const nextProductModel = changedValues.productModel;
    const currentTrackingCode = form.getFieldValue('trackingCode') as
      | string
      | undefined;
    if (
      !currentTrackingCode?.trim() ||
      currentTrackingCode === previousProductModelRef.current
    ) {
      form.setFieldValue('trackingCode', nextProductModel);
    }
    previousProductModelRef.current = nextProductModel;
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

  async function exportFilteredProducts() {
    setIsExporting(true);
    try {
      const file = await exportProducts(keyword, status, processId);
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `产品列表_${formatExportTimestamp()}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      message.success('产品列表已导出');
    } catch (error) {
      message.error(getApiErrorMessage(error, '产品导出失败，请稍后重试'));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      {modalContextHolder}
      <div className="page-toolbar">
        <div>
          <Typography.Title level={2} className="page-title">
            产品管理
          </Typography.Title>
          <div className="page-kicker">维护产品档案，扫码枪按二维码内容识别产品并记录流转。</div>
        </div>
        <Space>
          <Button
            icon={<DownloadOutlined />}
            loading={isExporting}
            disabled={isFetching || data.length === 0}
            onClick={exportFilteredProducts}
          >
            导出
          </Button>
          <Button icon={<CopyOutlined />} loading={quickCreateLoading} onClick={openQuickCreate}>
            快速新增
          </Button>
          <Button type="primary" onClick={openCreate}>
            新增产品
          </Button>
        </Space>
      </div>

      <Card className="module-card">
        <div className="table-tools product-filters">
          <Space wrap>
            <Input.Search
              autoComplete="off"
              placeholder="搜索产品名称 / 型号 / 流转编号 / 流水号"
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
        </div>
        <Table
          rowKey="id"
          loading={isLoading && !data.length}
          dataSource={data}
          scroll={{ x: 1750 }}
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
            {
              title: '流转编号',
              render: (_, record) =>
                record.trackingCode ?? record.productModel,
            },
            { title: '流水号', dataIndex: 'serialNo', width: 130 },
            {
              title: '当前工序',
              width: 110,
              render: (_, record) => record.currentProcess?.name ?? '待扫码',
            },
            {
              title: '工序负责人',
              width: 520,
              render: (_, record) => (
                <div className="product-owner-summary">
                  {productionProcesses.map((process) => {
                    const ownerName = record.processOwners?.find(
                      (owner) => owner.processStepId === process.id,
                    )?.personnel?.name;
                    return (
                      <span key={process.id}>
                        {process.name}[{ownerName ?? '未分配'}]
                      </span>
                    );
                  })}
                </div>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (value: Product['status']) => <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>,
              width: 100,
            },
            {
              title: '操作',
              width: 260,
              render: (_, record) => (
                <Space onClick={(event) => event.stopPropagation()}>
                  <a onClick={() => openDetail(record.id)}>详情</a>
                  <a onClick={() => openEdit(record)}>编辑</a>
                  <a onClick={() => openCopy(record)}>复制</a>
                  {record.status !== 'VOIDED' ? (
                    <a
                      onClick={() => {
                        voidForm.resetFields();
                        setVoidingProduct(record);
                      }}
                    >
                      作废
                    </a>
                  ) : null}
                  <Popconfirm
                    title="确认删除该产品？"
                    onConfirm={() => deleteMutation.mutate(record.id)}
                  >
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
        title={editing ? '编辑产品' : copyingFrom ? '复制新增产品' : quickCreating ? '快速新增产品' : '新增产品'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setCopyingFrom(null);
          setQuickCreating(false);
        }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnHidden
        width={720}
      >
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
          onValuesChange={syncTrackingCodeWithProductModel}
          onFinish={(values) => saveMutation.mutate(values)}
        >
          <Form.Item name="productName" label="产品名称" rules={[{ required: true, message: '请输入产品名称' }]}>
            <Input autoComplete="off" placeholder="请输入产品名称" />
          </Form.Item>
          <Form.Item name="productModel" label="产品型号" rules={[{ required: true, message: '请输入产品型号' }]}>
            <Input autoComplete="off" placeholder="请输入产品型号" />
          </Form.Item>
          <Form.Item
            name="trackingCode"
            label="流转编号"
            rules={[{ required: true, whitespace: true, message: '请输入流转编号' }]}
          >
            <Input autoComplete="off" placeholder="请输入流转编号" />
          </Form.Item>
          <Form.Item name="serialNo" label="流水号">
            <Input autoComplete="off" placeholder="请输入流水号" />
          </Form.Item>
          <div className="product-owner-section">
            <Typography.Title level={5}>工序负责人</Typography.Title>
            <div className="product-owner-grid">
              {productionProcesses.map((process) => {
                const processPersonnel = personnel.filter(
                  (person) => person.processStepId === process.id,
                );
                return (
                  <Form.Item
                    key={process.id}
                    name={['processOwnerIds', String(process.id)]}
                    label={`${process.name}负责人`}
                    rules={[
                      {
                        required: true,
                        message: `请选择${process.name}负责人`,
                      },
                    ]}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder={
                        processPersonnel.some((person) => person.enabled)
                          ? `请选择${process.name}负责人`
                          : `请先录入${process.name}人员`
                      }
                      options={processPersonnel.map((person) => ({
                        label: person.enabled
                          ? person.name
                          : `${person.name}（已停用）`,
                        value: person.id,
                        disabled: !person.enabled,
                      }))}
                    />
                  </Form.Item>
                );
              })}
            </div>
          </div>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} autoComplete="off" placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="作废产品"
        open={Boolean(voidingProduct)}
        okText="确认作废"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        confirmLoading={voidMutation.isPending}
        onCancel={() => {
          setVoidingProduct(null);
          voidForm.resetFields();
        }}
        onOk={() => voidForm.submit()}
        destroyOnHidden
      >
        <Form
          form={voidForm}
          layout="vertical"
          onFinish={(values) => voidMutation.mutate(values)}
        >
          <Form.Item label="产品">
            <Input
              value={
                voidingProduct
                  ? `${voidingProduct.productName} / ${voidingProduct.productModel}`
                  : ''
              }
              disabled
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="作废原因"
            rules={[
              { required: true, whitespace: true, message: '请输入作废原因' },
              { max: 500, message: '作废原因不能超过 500 个字符' },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="请输入作废原因"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function getProductFormValues(
  product: Product,
  resetTrackingCode = false,
): ProductFormValues {
  return {
    productName: product.productName,
    productModel: product.productModel,
    trackingCode: resetTrackingCode
      ? product.productModel
      : (product.trackingCode ?? product.productModel),
    serialNo: product.serialNo ?? '',
    remark: product.remark ?? '',
    processOwnerIds: Object.fromEntries(
      (product.processOwners ?? []).map((owner) => [
        String(owner.processStepId),
        owner.personnelId,
      ]),
    ),
  };
}

function toProductInput(
  values: ProductFormValues,
  processes: Array<{ id: number }>,
): ProductInput {
  const { processOwnerIds = {}, ...productFields } = values;
  return {
    ...productFields,
    processOwners: processes.map((process) => ({
      processStepId: process.id,
      personnelId: processOwnerIds[String(process.id)],
    })),
  };
}

function formatExportTimestamp() {
  const now = new Date();
  const part = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${part(now.getMonth() + 1)}${part(now.getDate())}_${part(now.getHours())}${part(now.getMinutes())}${part(now.getSeconds())}`;
}
