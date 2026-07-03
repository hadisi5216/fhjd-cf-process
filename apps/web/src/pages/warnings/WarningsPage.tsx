import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Space, Table, Tag, Typography, message } from 'antd';
import { getWarnings, handleWarning, type Warning } from '../../services/api';

function formatDate(value?: string) {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 16);
}

export function WarningsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['warnings'],
    queryFn: getWarnings,
    refetchInterval: 10000,
    retry: false,
  });

  const handleMutation = useMutation({
    mutationFn: (id: number) => handleWarning(id, '管理员已确认处理'),
    onSuccess: () => {
      message.success('预警已处理');
      queryClient.invalidateQueries({ queryKey: ['warnings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  return (
    <>
      <div className="page-toolbar">
        <div>
          <Typography.Title level={2} className="page-title">
            预警中心
          </Typography.Title>
          <div className="page-kicker">产品在当前工序滞留超过 72 小时自动进入预警，管理员确认后可标记处理。</div>
        </div>
      </div>
      <Card className="module-card">
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data}
          locale={{ emptyText: '暂无预警记录' }}
          columns={[
            { title: '产品名称', render: (_, record) => record.product.productName },
            { title: '产品型号', render: (_, record) => record.product.productModel },
            { title: '当前工序', render: (_, record) => record.processStep.name, width: 100 },
            { title: '预警说明', dataIndex: 'message', render: (_: string | undefined, record: Warning) => record.message ?? `${record.product.productName} 超时未流转` },
            { title: '产生时间', dataIndex: 'createdAt', width: 180, render: formatDate },
            {
              title: '状态',
              dataIndex: 'status',
              render: (value: string) => <Tag color={value === 'OPEN' ? 'red' : 'green'}>{value === 'OPEN' ? '待处理' : '已处理'}</Tag>,
              width: 100,
            },
            {
              title: '操作',
              render: (_, record) => (
                <Space>
                  <Button
                    size="small"
                    type="link"
                    disabled={record.status !== 'OPEN'}
                    loading={handleMutation.isPending}
                    onClick={() => handleMutation.mutate(record.id)}
                  >
                    标记处理
                  </Button>
                </Space>
              ),
              width: 110,
            },
          ]}
        />
      </Card>
    </>
  );
}
