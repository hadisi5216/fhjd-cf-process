import { ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getDashboardSummary, getPublicSettings } from '../../services/api';

type ScreenProduct = {
  id: number;
  productName: string;
  productModel: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'FINISHED' | 'OVERDUE';
  currentEnteredAt?: string;
};

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function formatClock(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function elapsedText(value?: string) {
  if (!value) return '-';
  const elapsedMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return '-';

  const totalMinutes = Math.floor(elapsedMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${minutes}分钟`;
}

function isOverdue(value?: string) {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() >= 72 * 3_600_000;
}

function sortByElapsedDesc(products: ScreenProduct[]) {
  return [...products].sort((a, b) => {
    const aTime = a.currentEnteredAt ? new Date(a.currentEnteredAt).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.currentEnteredAt ? new Date(b.currentEnteredAt).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
}

function makePreviewProducts(startId: number): ScreenProduct[] {
  const models = [
    'J/CLL9-12A-101S1.1',
    'J/CLL9-50A-101S1.1',
    'J/CLL9-51-101S1.1',
    'J/CLL9-52A-101S1.1',
    'J/CLL9-53A-101S1.1',
    'J/CLL9-12A-101S1.1+01',
    'J/CLL9-12A-101S1.1+02',
    'J/CLL9-50A-101S1.1+01',
    'J/CLL9-50A-101S1.1+02',
    'J/CLL9-52A-101S1.1+01',
  ];

  return sortByElapsedDesc(
    Array.from({ length: 36 }, (_, index) => {
      const sequence = index + 1;
      const model = models[index % models.length];
      const elapsedHours = 3 + ((index * 7 + startId) % 86);
      return {
        id: -(startId + sequence),
        productName: model.split('+')[0],
        productModel: model,
        status: elapsedHours >= 72 ? 'OVERDUE' : 'IN_PROGRESS',
        currentEnteredAt: hoursAgo(elapsedHours),
      };
    }),
  );
}

const previewProducts: Record<string, ScreenProduct[]> = {
  打磨: makePreviewProducts(1000),
  装配: makePreviewProducts(2000),
  喷漆: makePreviewProducts(3000),
  包覆: makePreviewProducts(4000),
};

export function ScreenPage() {
  const [now, setNow] = useState(() => new Date());
  const { data } = useQuery({
    queryKey: ['screen-summary'],
    queryFn: getDashboardSummary,
    refetchInterval: 5000,
    retry: false,
  });
  const { data: settings } = useQuery({
    queryKey: ['public-settings'],
    queryFn: getPublicSettings,
    refetchInterval: 5000,
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const processStats = data?.byProcess ?? [];
  const usePreviewData = settings?.screenPreviewDataEnabled ?? true;
  const refreshCountdown = 5 - (now.getSeconds() % 5);
  const refreshTick = refreshCountdown === 5;
  const displayStats = processStats.map((process) => {
    const products = (usePreviewData ? previewProducts[process.name] : undefined) ?? process.products ?? [];
    const sortedProducts = sortByElapsedDesc(products);
    const overdueCount = sortedProducts.filter(
      (product) => product.status === 'OVERDUE' || isOverdue(product.currentEnteredAt),
    ).length;
    return { ...process, count: sortedProducts.length, overdueCount, products: sortedProducts };
  });
  const previewTotal = displayStats.reduce((sum, process) => sum + process.products.length, 0);
  const overdueTotal = displayStats
    .flatMap((item) => item.products)
    .filter((item) => item.status === 'OVERDUE' || isOverdue(item.currentEnteredAt)).length;

  return (
    <main className="screen-command-page">
      <header className="screen-command-top">
        <div className="screen-command-title-block">
          <div>
            <h1>产品加工流程实时看板</h1>
            <p>北京飞航吉达航空科技有限公司</p>
          </div>
        </div>
        <section className="screen-command-kpis" aria-label="看板统计">
          <div className="screen-command-kpi screen-command-kpi-total">
            <span>产品总数</span>
            <strong>{usePreviewData ? Math.max(data?.total ?? 0, previewTotal) : (data?.total ?? 0)}</strong>
          </div>
          <div className="screen-command-kpi screen-command-kpi-work">
            <span>加工中</span>
            <strong>{usePreviewData ? Math.max(data?.inProgress ?? 0, previewTotal) : (data?.inProgress ?? 0)}</strong>
          </div>
          <div className="screen-command-kpi screen-command-kpi-ok">
            <span>已完工</span>
            <strong>{data?.finished ?? 0}</strong>
          </div>
          <div className="screen-command-kpi screen-command-kpi-alert">
            <span>已超时</span>
            <strong>{usePreviewData ? Math.max(data?.overdue ?? 0, overdueTotal) : (data?.overdue ?? 0)}</strong>
          </div>
        </section>
        <div className="screen-command-side screen-command-side-right">
          <span>
            <ClockCircleOutlined />
            {formatClock(now)}
          </span>
          <strong className={refreshTick ? 'screen-refresh-tick is-active' : 'screen-refresh-tick'}>
            <ReloadOutlined />
            {refreshCountdown} 秒后刷新
          </strong>
        </div>
      </header>

      <section className="screen-command-board">
        {displayStats.length ? (
          displayStats.map((process) => (
            <article className={`screen-command-panel screen-process-tone-${process.name}`} key={process.id}>
              <header className="screen-command-panel-head">
                <strong>{process.name}</strong>
                <div className="screen-command-panel-stats">
                  <span>
                    在制 <b>{process.count}</b>
                  </span>
                  <span className="is-alert">
                    超时 <b>{process.overdueCount}</b>
                  </span>
                </div>
              </header>

              <div className="screen-command-list">
                {process.products.length ? (
                  <table className="screen-command-table">
                    <tbody>
                      {process.products.map((product) => {
                        const overdue = product.status === 'OVERDUE' || isOverdue(product.currentEnteredAt);
                        return (
                          <tr className={overdue ? 'is-alert' : undefined} key={product.id}>
                            <td>{product.productModel}</td>
                            <td>{elapsedText(product.currentEnteredAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="screen-command-empty">暂无在制产品</div>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="screen-command-empty">暂无工序数据</div>
        )}
      </section>
    </main>
  );
}
