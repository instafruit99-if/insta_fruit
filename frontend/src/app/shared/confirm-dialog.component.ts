import { Component, input, output } from '@angular/core';
import { LucideAngularModule, AlertTriangle } from 'lucide-angular';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div class="bg-white w-full max-w-[340px] rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <lucide-icon [img]="AlertIcon" [size]="24" class="text-red-500"></lucide-icon>
        </div>
        <h3 class="text-center text-[18px] font-extrabold text-text-primary mb-2">{{ title() }}</h3>
        <p class="text-center text-[13px] text-text-secondary mb-6 leading-relaxed">{{ message() }}</p>
        <div class="flex gap-3">
          <button (click)="cancelled.emit()"
                  class="flex-1 h-12 rounded-xl bg-[#F0F0F0] text-text-primary font-bold text-[14px] transition-colors">
            Cancel
          </button>
          <button (click)="confirmed.emit()"
                  class="flex-1 h-12 rounded-xl bg-red-500 text-white font-bold text-[14px] transition-colors shadow-sm">
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  readonly AlertIcon = AlertTriangle;

  title     = input<string>('Are you sure?');
  message   = input<string>('This action cannot be undone.');
  confirmLabel = input<string>('Delete');

  confirmed = output<void>();
  cancelled = output<void>();
}
