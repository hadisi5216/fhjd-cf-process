import { ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getDashboardSummary, getPublicSettings } from '../../services/api';
import { getApiDateTime } from '../../utils/datetime';
import { enterFullscreen } from '../../utils/fullscreen';

type ScreenProduct = {
  id: number;
  productName: string;
  productModel: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'FINISHED' | 'OVERDUE';
  currentEnteredAt?: string;
};

const TABLE_ROW_HEIGHT = 33;
const ROW_STEP_INTERVAL_MS = 2000;
const END_HOLD_STEPS = 1;
const SCREEN_PROCESS_ORDER = ['打磨', '装配', '包覆', '涂装'];
const SCREEN_PROCESS_NAMES: Record<string, string> = {
  喷漆: '涂装',
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
  const enteredAt = getApiDateTime(value);
  const elapsedMs = enteredAt ? Date.now() - enteredAt : Number.NaN;
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
  const enteredAt = getApiDateTime(value);
  return enteredAt ? Date.now() - enteredAt >= 72 * 3_600_000 : false;
}

function sortByElapsedDesc(products: ScreenProduct[]) {
  return [...products].sort((a, b) => {
    const aTime = getApiDateTime(a.currentEnteredAt) ?? Number.POSITIVE_INFINITY;
    const bTime = getApiDateTime(b.currentEnteredAt) ?? Number.POSITIVE_INFINITY;
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
    Array.from({ length: 40 }, (_, index) => {
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
  包覆: makePreviewProducts(4000),
  涂装: makePreviewProducts(3000),
};

export function ScreenPage() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [visibleTableRows, setVisibleTableRows] = useState(1);
  const [rowStep, setRowStep] = useState(0);
  const firstProcessListRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const timer = window.setInterval(() => setRowStep((current) => current + 1), ROW_STEP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('/api/dashboard/events');
    const refreshDashboard = () => {
      void queryClient.invalidateQueries({ queryKey: ['screen-summary'] });
    };

    eventSource.addEventListener('dashboard-update', refreshDashboard);
    return () => {
      eventSource.removeEventListener('dashboard-update', refreshDashboard);
      eventSource.close();
    };
  }, [queryClient]);

  useEffect(() => {
    let active = true;

    function removeInteractionListeners() {
      window.removeEventListener('pointerdown', enterOnInteraction);
      window.removeEventListener('keydown', enterOnInteraction);
    }

    function enterOnInteraction() {
      removeInteractionListeners();
      void enterFullscreen();
    }

    void enterFullscreen().then((entered) => {
      if (!entered && active) {
        window.addEventListener('pointerdown', enterOnInteraction, { once: true });
        window.addEventListener('keydown', enterOnInteraction, { once: true });
      }
    });

    return () => {
      active = false;
      removeInteractionListeners();
    };
  }, []);

  useLayoutEffect(() => {
    const list = firstProcessListRef.current;
    if (!list) return;

    const updateVisibleRows = () => {
      setVisibleTableRows(Math.max(1, Math.floor(list.clientHeight / TABLE_ROW_HEIGHT) + 1));
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateVisibleRows);
    observer?.observe(list);
    window.addEventListener('resize', updateVisibleRows);
    updateVisibleRows();

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateVisibleRows);
    };
  }, [data?.byProcess?.length]);

  const processStats = data?.byProcess ?? [];
  const usePreviewData = settings?.screenPreviewDataEnabled ?? true;
  const refreshCountdown = 5 - (now.getSeconds() % 5);
  const refreshTick = refreshCountdown === 5;
  const displayStats = processStats
    .map((process) => {
      const displayName = SCREEN_PROCESS_NAMES[process.name] ?? process.name;
      const products = (usePreviewData ? previewProducts[displayName] : undefined) ?? process.products ?? [];
      const sortedProducts = sortByElapsedDesc(products);
      const overdueCount = sortedProducts.filter(
        (product) => product.status === 'OVERDUE' || isOverdue(product.currentEnteredAt),
      ).length;
      return { ...process, name: displayName, count: sortedProducts.length, overdueCount, products: sortedProducts };
    })
    .sort((a, b) => {
      const aOrder = SCREEN_PROCESS_ORDER.indexOf(a.name);
      const bOrder = SCREEN_PROCESS_ORDER.indexOf(b.name);
      return (aOrder < 0 ? Number.MAX_SAFE_INTEGER : aOrder) - (bOrder < 0 ? Number.MAX_SAFE_INTEGER : bOrder);
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
          displayStats.map((process, processIndex) => {
            const maxRowOffset = Math.max(0, process.products.length - visibleTableRows);
            const cycleLength = maxRowOffset + 1 + END_HOLD_STEPS;
            const cycleStep = maxRowOffset > 0 ? rowStep % cycleLength : 0;
            const rowOffset = Math.min(cycleStep, maxRowOffset);
            const isResetting = maxRowOffset > 0 && rowStep > 0 && cycleStep === 0;

            return (
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

                <div
                  className="screen-command-list"
                  ref={processIndex === 0 ? firstProcessListRef : undefined}
                  role="table"
                  aria-label={`${process.name}在制产品列表`}
                >
                  <div className="screen-command-grid" aria-hidden="true">
                    {Array.from({ length: visibleTableRows }, (_, index) => (
                      <div className="screen-command-grid-row" key={index}>
                        <span />
                        <span />
                      </div>
                    ))}
                  </div>
                  <div
                    className={`screen-command-data${isResetting ? ' is-resetting' : ''}`}
                    style={{ transform: `translate3d(0, ${-rowOffset * TABLE_ROW_HEIGHT}px, 0)` }}
                    role="rowgroup"
                  >
                    {process.products.map((product) => {
                      const overdue = product.status === 'OVERDUE' || isOverdue(product.currentEnteredAt);
                      return (
                        <div
                          className={`screen-command-data-row${overdue ? ' is-alert' : ''}`}
                          key={product.id}
                          role="row"
                        >
                          <span role="cell">{product.productModel}</span>
                          <span role="cell">{elapsedText(product.currentEnteredAt)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="screen-command-empty">暂无工序数据</div>
        )}
      </section>
    </main>
  );
}
