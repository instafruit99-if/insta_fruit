import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { RefundsService } from '../../core/services/refunds.service';
import { Refund } from '../../core/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-refunds-admin',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ConfirmDialogComponent],
  template: `
    <div data-testid="refunds-admin" class="space-y-5">
      <h1 class="text-[22px] font-extrabold">Refunds</h1>
      <div class="bg-white rounded-card shadow-soft overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-[13px]">
            <thead class="bg-[#FAFAFA] text-text-secondary text-[11px] uppercase tracking-wider">
              <tr><th class="px-4 py-3 text-left">Order</th><th class="px-4 py-3 text-left">Reason</th><th class="px-4 py-3 text-right">Amount</th><th class="px-4 py-3 text-center">Status</th><th class="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              @for (r of refunds(); track r.refundId) {
                <tr class="border-t border-border-soft/60">
                  <td class="px-4 py-3 font-semibold">#{{ r.orderId.slice(-8).toUpperCase() }}</td>
                  <td class="px-4 py-3 text-text-secondary">{{ r.reason }}</td>
                  <td class="px-4 py-3 text-right font-bold">₹{{ r.amount.toFixed(0) }}</td>
                  <td class="px-4 py-3 text-center">
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase"
                          [class.bg-yellow-50]="r.status === 'pending'" [class.text-yellow-600]="r.status === 'pending'"
                          [class.bg-primary-light]="r.status === 'approved' || r.status === 'processed'" [class.text-primary]="r.status === 'approved' || r.status === 'processed'"
                          [class.bg-red-50]="r.status === 'rejected'" [class.text-red-500]="r.status === 'rejected'">{{ r.status }}</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    @if (r.status === 'pending') {
                      <button (click)="approve(r)" [attr.data-testid]="'approve-' + r.refundId"
                              class="text-[12px] font-semibold text-primary mr-2">Approve & Refund</button>
                      <button (click)="reject(r.refundId)" class="text-[12px] font-semibold text-red-500">Reject</button>
                    }
                  </td>
                </tr>
              } @empty { <tr><td colspan="5" class="px-4 py-10 text-center text-text-secondary">No refund requests.</td></tr> }
            </tbody>
          </table>
        </div>
      @if (refundToApprove()) {
        <app-confirm-dialog
          title="Process Refund"
          [message]="approveMessage()"
          confirmLabel="Yes, Refund"
          (confirmed)="confirmApprove()"
          (cancelled)="refundToApprove.set(null)" />
      }
    </div>
  `,
})
export class RefundsAdminComponent {
  private readonly refundsSvc = inject(RefundsService);
  readonly refunds = toSignal(this.refundsSvc.list(), { initialValue: [] as Refund[] });
  readonly refundToApprove = signal<Refund | null>(null);
  readonly refundError = signal('');
  readonly approveMessage = computed(() => {
    const r = this.refundToApprove();
    return r ? `Refund ₹${r.amount.toFixed(0)} to order #${r.orderId.slice(-8).toUpperCase()}?` : '';
  });

  approve(r: Refund): void { this.refundToApprove.set(r); }

  async confirmApprove(): Promise<void> {
    const r = this.refundToApprove();
    if (!r) return;
    this.refundToApprove.set(null);
    try {
      await this.refundsSvc.approveAndProcess(r.orderId, r.reason);
    } catch (e) { this.refundError.set('Refund failed: ' + ((e as Error).message ?? '')); }
  }

  async reject(refundId: string): Promise<void> { await this.refundsSvc.reject(refundId); }
}
