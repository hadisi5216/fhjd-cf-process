import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Empty, Row, Statistic, Table, Tag, Typography } from 'antd';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardSummary, getProducts } from '../../services/api';
import { formatDateTime } from '../../utils/datetime';

function statusText(value: string) {
  const map: Record<string, string> = {
    PENDING: '待扫码',
    IN_PROGRESS: '加工中',
    FINISHED: '已完工',
    OVERDUE: '已超时',
  };
  return map[value] ?? value;
}

function statusColor(value: string) {
  if (value === 'OVERDUE') return 'red';
  if (value === 'PENDING') return 'default';
  if (value === 'FINISHED') return 'green';
  return '#126e78';
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    refetchInterval: 5000,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['dashboard-products'],
    queryFn: () => getProducts(),
    refetchInterval: 5000,
    retry: false,
  });

  const rows = products.filter((item) => item.status === 'IN_PROGRESS' || item.status === 'OVERDUE');

  function openProducts(status?: string) {
    navigate(status ? `/products?status=${status}` : '/products');
  }

  function metricKeydown(event: KeyboardEvent, status?: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openProducts(status);
    }
  }

  return (
    <>
      <div className="page-toolbar">
        <div>
          <Typography.Title level={2} className="page-title">
            后台首页
          </Typography.Title>
          <div className="page-kicker">查看产品当前工序、扫码流转状态和超时预警。</div>
        </div>
        <Tag color="#126e78">5 秒自动刷新</Tag>
      </div>

      <div className="metric-grid">
        <Card
          className="metric-card metric-card-clickable"
          loading={summaryLoading}
          role="button"
          tabIndex={0}
          onClick={() => openProducts()}
          onKeyDown={(event) => metricKeydown(event)}
        >
          <Statistic title="产品总数" value={data?.total ?? 0} />
          <div className="metric-caption">后台已维护产品</div>
        </Card>
        <Card
          className="metric-card metric-card-clickable"
          loading={summaryLoading}
          role="button"
          tabIndex={0}
          onClick={() => openProducts('IN_PROGRESS')}
          onKeyDown={(event) => metricKeydown(event, 'IN_PROGRESS')}
        >
          <Statistic title="加工中" value={data?.inProgress ?? 0} />
          <div className="metric-caption">已扫码进入工序</div>
        </Card>
        <Card
          className="metric-card metric-card-clickable"
          loading={summaryLoading}
          role="button"
          tabIndex={0}
          onClick={() => openProducts('FINISHED')}
          onKeyDown={(event) => metricKeydown(event, 'FINISHED')}
        >
          <Statistic title="已完工" value={data?.finished ?? 0} />
          <div className="metric-caption">到达完工工序</div>
        </Card>
        <Card
          className="metric-card metric-card-danger metric-card-clickable"
          loading={summaryLoading}
          role="button"
          tabIndex={0}
          onClick={() => openProducts('OVERDUE')}
          onKeyDown={(event) => metricKeydown(event, 'OVERDUE')}
        >
          <Statistic title="超时预警" value={data?.overdue ?? 0} styles={{ content: { color: '#b42318' } }} />
          <div className="metric-caption">当前工序已超时</div>
        </Card>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card title="各工序在制数量" className="module-card">
            <Table
              rowKey="id"
              loading={summaryLoading}
              pagination={false}
              dataSource={data?.byProcess ?? []}
              locale={{ emptyText: <Empty description="暂无工序数据" /> }}
              columns={[
                { title: '工序', dataIndex: 'name' },
                {
                  title: '在制产品',
                  dataIndex: 'count',
                  width: 110,
                  render: (value: number) => <strong className="process-count">{value} 件</strong>,
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="正在加工产品列表" className="module-card">
            <Table
              rowKey="id"
              loading={productsLoading}
              pagination={{ pageSize: 6, showSizeChanger: false }}
              dataSource={rows}
              locale={{ emptyText: <Empty description="暂无正在加工产品" /> }}
              onRow={(record) => ({
                className: 'clickable-table-row',
                onClick: () => navigate(`/products/${record.id}`),
              })}
              columns={[
                {
                  title: '产品名称',
                  dataIndex: 'productName',
                  render: (value: string, record) => (
                    <a
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/products/${record.id}`);
                      }}
                    >
                      {value}
                    </a>
                  ),
                },
                { title: '产品型号', dataIndex: 'productModel' },
                {
                  title: '当前工序',
                  width: 110,
                  render: (_, record) => record.currentProcess?.name ?? '待扫码',
                },
                {
                  title: '进入时间',
                  width: 150,
                  render: (_, record) => formatDateTime(record.currentEnteredAt),
                },
                {
                  title: '状态',
                  width: 104,
                  render: (_, record) => <Tag color={statusColor(record.status)}>{statusText(record.status)}</Tag>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {(data?.overdue ?? 0) > 0 && (
        <Alert className="warning-strip" type="warning" showIcon message={`当前有 ${data?.overdue ?? 0} 个产品超时预警待处理`} />
      )}
    </>
  );
}
