import { Controller, Get, MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, Observable, of } from 'rxjs';
import { RealtimeService } from '../realtime/realtime.service';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly realtimeService: RealtimeService,
  ) {}

  @Get('summary')
  summary() {
    return this.dashboardService.summary();
  }

  @Sse('events')
  events(): Observable<MessageEvent> {
    return merge(
      of({ type: 'connected', data: { connectedAt: new Date().toISOString() } }),
      this.realtimeService.dashboardUpdates$.pipe(map((data) => ({ type: 'dashboard-update', data }))),
      interval(15_000).pipe(map(() => ({ type: 'heartbeat', data: { at: new Date().toISOString() } }))),
    );
  }
}
