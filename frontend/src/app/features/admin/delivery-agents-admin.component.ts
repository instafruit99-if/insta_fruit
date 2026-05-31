import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Plus, Pencil, Trash2, X, Check } from 'lucide-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { DeliveryAgentsService } from '../../core/services/delivery-agents.service';
import { DeliveryAgent } from '../../core/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-delivery-agents-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ConfirmDialogComponent],
  template: `
    <div data-testid="delivery-agents-admin" class="space-y-5">
      <div class="flex items-center justify-between">
        <h1 class="text-[22px] font-extrabold">Delivery Agents</h1>
        <button (click)="openNew()" class="bg-primary text-white px-4 py-2 rounded-btn text-[13px] font-bold shadow-green flex items-center gap-2">
          <lucide-icon [img]="PlusIcon" [size]="14"></lucide-icon>Add Agent
        </button>
      </div>

      @if (error()) {
        <p class="text-[12px] text-red-500 font-semibold">{{ error() }}</p>
      }

      <!-- Add / Edit form -->
      @if (showForm()) {
        <div class="bg-white rounded-card shadow-soft p-5 space-y-3">
          <h2 class="text-[14px] font-bold">{{ editingId() ? 'Edit Agent' : 'New Agent' }}</h2>

          <div>
            <input [(ngModel)]="formName" placeholder="Full name" maxlength="80"
                   class="w-full text-[13px] px-3 py-2 rounded-input border"
                   [class.border-red-400]="nameError()" [class.border-border-soft]="!nameError()"
                   (blur)="touchName()" />
            @if (nameError()) {
              <p class="text-[11px] text-red-500 mt-1">{{ nameError() }}</p>
            }
          </div>

          <div>
            <input [ngModel]="formPhone" (ngModelChange)="onPhoneInput($event)"
                   placeholder="98765 43210" inputmode="numeric" maxlength="11"
                   class="w-full text-[13px] px-3 py-2 rounded-input border"
                   [class.border-red-400]="phoneError()" [class.border-border-soft]="!phoneError()"
                   (blur)="touchPhone()" />
            @if (phoneError()) {
              <p class="text-[11px] text-red-500 mt-1">{{ phoneError() }}</p>
            }
          </div>

          <div class="flex gap-2 pt-1">
            <button type="button" (click)="cancelForm()"
                    class="flex-1 h-10 rounded-xl bg-gray-100 text-text-primary text-[13px] font-semibold flex items-center justify-center">
              Cancel
            </button>
            <button type="button" (click)="saveForm()" [disabled]="saving()"
                    class="flex-1 h-10 rounded-xl bg-primary text-[13px] font-bold disabled:opacity-60 flex items-center justify-center"
                    style="color: #ffffff;">
              @if (saving()) { Saving… } @else { Save }
            </button>
          </div>
        </div>
      }

      @if (agentToDelete()) {
        <app-confirm-dialog
          title="Delete Agent"
          [message]="deleteMessage()"
          confirmLabel="Delete"
          (confirmed)="confirmDelete()"
          (cancelled)="agentToDelete.set(null)" />
      }

      <div class="bg-white rounded-card shadow-soft overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-[13px]">
            <thead class="bg-[#FAFAFA] text-text-secondary text-[11px] uppercase tracking-wider">
              <tr>
                <th class="px-4 py-3 text-left">Name</th>
                <th class="px-4 py-3 text-left">Phone</th>
                <th class="px-4 py-3 text-center">Status</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (a of agents(); track a.id) {
                <tr class="border-t border-border-soft/60">
                  <td class="px-4 py-3 font-semibold">{{ a.name }}</td>
                  <td class="px-4 py-3 text-text-secondary">{{ a.phone }}</td>
                  <td class="px-4 py-3 text-center">
                    <button (click)="toggleActive(a)"
                            class="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase"
                            [class.bg-primary-light]="a.isActive" [class.text-primary]="a.isActive"
                            [class.bg-red-50]="!a.isActive" [class.text-red-500]="!a.isActive">
                      {{ a.isActive ? 'Active' : 'Inactive' }}
                    </button>
                  </td>
                  <td class="px-4 py-3 text-right flex items-center justify-end gap-3">
                    <button (click)="openEdit(a)" class="text-primary text-[12px] font-semibold">Edit</button>
                    <button (click)="remove(a)" class="text-red-500 text-[12px] font-semibold">Delete</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="px-4 py-10 text-center text-text-secondary">No agents added yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class DeliveryAgentsAdminComponent {
  private readonly svc = inject(DeliveryAgentsService);

  readonly agents = toSignal(this.svc.list(), { initialValue: [] as DeliveryAgent[] });
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly agentToDelete = signal<DeliveryAgent | null>(null);
  readonly deleteMessage = computed(() => {
    const a = this.agentToDelete();
    return a ? `Delete agent "${a.name}"? This cannot be undone.` : '';
  });

  readonly PlusIcon = Plus;

  formName = '';
  formPhone = '';

  private nameTouched = signal(false);
  private phoneTouched = signal(false);

  nameError = () => {
    if (!this.nameTouched()) return '';
    return this.formName.trim() ? '' : 'Name is required.';
  };

  phoneError = () => {
    if (!this.phoneTouched()) return '';
    const digits = this.formPhone.replace(/\D/g, '');
    if (!digits) return 'Phone number is required.';
    if (digits.length !== 10) return 'Enter a valid 10-digit phone number.';
    if (!/^[6-9]/.test(digits)) return 'Phone must start with 6, 7, 8 or 9.';
    return '';
  };

  touchName(): void { this.nameTouched.set(true); }
  touchPhone(): void { this.phoneTouched.set(true); }

  onPhoneInput(raw: string): void {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    this.formPhone = digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
  }

  openNew(): void {
    this.editingId.set(null);
    this.formName = '';
    this.formPhone = '';
    this.error.set('');
    this.nameTouched.set(false);
    this.phoneTouched.set(false);
    this.showForm.set(true);
  }

  openEdit(a: DeliveryAgent): void {
    this.editingId.set(a.id);
    this.formName = a.name;
    const digits = a.phone.replace(/\D/g, '').slice(0, 10);
    this.formPhone = digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
    this.error.set('');
    this.nameTouched.set(false);
    this.phoneTouched.set(false);
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  async saveForm(): Promise<void> {
    this.nameTouched.set(true);
    this.phoneTouched.set(true);

    const name = this.formName.trim();
    const digits = this.formPhone.replace(/\D/g, '');

    if (!name) return;
    if (digits.length !== 10 || !/^[6-9]/.test(digits)) return;

    this.error.set('');
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id) {
        await this.svc.update(id, name, digits);
      } else {
        await this.svc.create(name, digits);
      }
      this.showForm.set(false);
      this.editingId.set(null);
    } catch (e) {
      this.error.set((e as Error).message ?? 'Save failed.');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(a: DeliveryAgent): Promise<void> {
    try {
      await this.svc.setActive(a.id, !a.isActive);
    } catch (e) {
      this.error.set((e as Error).message ?? 'Update failed.');
    }
  }

  remove(a: DeliveryAgent): void {
    this.agentToDelete.set(a);
  }

  async confirmDelete(): Promise<void> {
    const a = this.agentToDelete();
    if (!a) return;
    this.agentToDelete.set(null);
    try {
      await this.svc.delete(a.id);
    } catch (e) {
      this.error.set((e as Error).message ?? 'Delete failed.');
    }
  }
}
