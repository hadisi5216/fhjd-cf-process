import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type DashboardUpdate = {
  reason: 'SCAN';
  productId: number;
  processStepId: number;
  occurredAt: string;
};

@Injectable()
export class RealtimeService {
  private readonly dashboardUpdates = new Subject<DashboardUpdate>();

  readonly dashboardUpdates$ = this.dashboardUpdates.asObservable();

  notifyDashboardUpdate(update: Omit<DashboardUpdate, 'occurredAt'>) {
    this.dashboardUpdates.next({ ...update, occurredAt: new Date().toISOString() });
  }
}
