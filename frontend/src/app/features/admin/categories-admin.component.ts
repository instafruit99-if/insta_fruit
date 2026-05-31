import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Plus, Pencil, Trash2, Upload, X } from 'lucide-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { CategoriesService } from '../../core/services/categories.service';
import { StorageService } from '../../core/services/storage.service';
import { Category } from '../../core/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-categories-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ConfirmDialogComponent],
  template: `
    <div data-testid="categories-admin" class="space-y-5">
      <div class="flex items-center justify-between">
        <h1 class="text-[22px] font-extrabold">Categories</h1>
        <button (click)="openNew()" data-testid="add-category" class="bg-primary text-white px-4 py-2 rounded-btn text-[13px] font-bold shadow-green flex items-center gap-2">
          <lucide-icon [img]="PlusIcon" [size]="14"></lucide-icon>Add Category
        </button>
      </div>
      <div class="bg-white rounded-card shadow-soft p-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          @for (c of categories(); track c.id) {
            <div class="bg-[#FAFAFA] rounded-card p-4 flex flex-col items-center gap-2 relative">
              <div class="absolute top-2 right-2 flex gap-1">
                <button (click)="openEdit(c)" class="text-primary"><lucide-icon [img]="EditIcon" [size]="14"></lucide-icon></button>
                <button (click)="remove(c.id)" class="text-red-500"><lucide-icon [img]="TrashIcon" [size]="14"></lucide-icon></button>
              </div>
              <div class="w-14 h-14 rounded-full bg-primary-light flex items-center justify-center text-2xl">
                @if (c.imageUrl) { <img [src]="c.imageUrl" class="w-12 h-12 object-contain" /> } @else { <span>{{ c.icon ?? '🍎' }}</span> }
              </div>
              <p class="text-[13px] font-bold">{{ c.name }}</p>
              <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    [class.bg-primary-light]="c.isActive" [class.text-primary]="c.isActive"
                    [class.bg-red-50]="!c.isActive" [class.text-red-500]="!c.isActive">
                {{ c.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
          } @empty { <p class="col-span-full text-text-secondary text-center py-6 text-[13px]">No categories yet.</p> }
        </div>
      </div>

      @if (catToDelete()) {
        <app-confirm-dialog
          title="Delete Category"
          message="Delete this category? This cannot be undone."
          confirmLabel="Delete"
          (confirmed)="confirmDelete()"
          (cancelled)="catToDelete.set(null)" />
      }

      @if (modal()) {
        <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="modal.set(false)">
          <div class="bg-white rounded-card p-6 w-full max-w-sm" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-[16px] font-extrabold">{{ form().id ? 'Edit Category' : 'New Category' }}</h2>
              <button (click)="modal.set(false)"><lucide-icon [img]="XIcon" [size]="18"></lucide-icon></button>
            </div>
            <div class="space-y-3">
              <input [(ngModel)]="form().name" placeholder="Name" class="w-full px-3 py-2 rounded-input border border-border-soft text-[13px]" />
              <input [(ngModel)]="form().icon" placeholder="Emoji icon (e.g. 🍎)" class="w-full px-3 py-2 rounded-input border border-border-soft text-[13px]" />
              <div class="flex items-center gap-3">
                @if (form().imageUrl) { <img [src]="form().imageUrl" class="w-14 h-14 rounded-xl object-contain bg-primary-light" /> }
                <label class="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-input border border-dashed border-primary/40 text-[12px] text-primary font-semibold">
                  <lucide-icon [img]="UploadIcon" [size]="14"></lucide-icon> Upload
                  <input type="file" accept="image/*" class="hidden" (change)="upload($event)" />
                </label>
              </div>
              <label class="flex items-center gap-2 text-[12px]"><input type="checkbox" [(ngModel)]="form().isActive" /> Active</label>
            </div>
            <button (click)="save()" [disabled]="saving()" class="w-full mt-5 bg-primary text-white py-3 rounded-btn text-[14px] font-bold shadow-green disabled:opacity-60">
              {{ saving() ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class CategoriesAdminComponent {
  private readonly catsSvc = inject(CategoriesService);
  private readonly storage = inject(StorageService);
  readonly categories = toSignal(this.catsSvc.listAll(), { initialValue: [] as Category[] });
  readonly modal = signal(false);
  readonly saving = signal(false);
  readonly catToDelete = signal<string | null>(null);
  readonly form = signal<{ id?: string; name: string; icon: string; imageUrl: string; isActive: boolean; }>({
    name: '', icon: '🍎', imageUrl: '', isActive: true,
  });
  readonly PlusIcon = Plus; readonly EditIcon = Pencil; readonly TrashIcon = Trash2;
  readonly UploadIcon = Upload; readonly XIcon = X;

  openNew(): void { this.form.set({ name: '', icon: '🍎', imageUrl: '', isActive: true }); this.modal.set(true); }
  openEdit(c: Category): void {
    this.form.set({ id: c.id, name: c.name, icon: c.icon ?? '🍎', imageUrl: c.imageUrl, isActive: c.isActive });
    this.modal.set(true);
  }
  async upload(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = await this.storage.upload('categories', file);
    this.form.update((f) => ({ ...f, imageUrl: url }));
  }
  async save(): Promise<void> {
    const f = this.form();
    if (!f.name) return;
    this.saving.set(true);
    try {
      if (f.id) await this.catsSvc.update(f.id, { name: f.name, icon: f.icon, imageUrl: f.imageUrl, isActive: f.isActive });
      else await this.catsSvc.create({ name: f.name, icon: f.icon, imageUrl: f.imageUrl, isActive: f.isActive, sortOrder: 100 });
      this.modal.set(false);
    } finally { this.saving.set(false); }
  }
  remove(id: string): void { this.catToDelete.set(id); }
  async confirmDelete(): Promise<void> {
    const id = this.catToDelete();
    if (!id) return;
    this.catToDelete.set(null);
    await this.catsSvc.remove(id);
  }
}
