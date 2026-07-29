import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type DashboardUpdatePayload =
  | {
      reason: 'SCAN';
      productId: number;
      processStepId: number;
    }
  | {
      reason: 'SETTINGS';
    };

export type DashboardUpdate = DashboardUpdatePayload & {
  occurredAt: string;
};

@Injectable()
export class RealtimeService {
  private readonly dashboardUpdates = new Subject<DashboardUpdate>();

  readonly dashboardUpdates$ = this.dashboardUpdates.asObservable();

  notifyDashboardUpdate(update: DashboardUpdatePayload) {
    this.dashboardUpdates.next({ ...update, occurredAt: new Date().toISOString() });
  }
}
