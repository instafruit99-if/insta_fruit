import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Plus, Pencil, Trash2, Upload, X, Loader2 } from 'lucide-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { BannersService } from '../../core/services/banners.service';
import { StorageService } from '../../core/services/storage.service';
import { Banner } from '../../core/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-banners-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ConfirmDialogComponent],
  template: `
    <div data-testid="banners-admin" class="space-y-5">
      <div class="flex items-center justify-between">
        <h1 class="text-[22px] font-extrabold">Banners</h1>
        <button (click)="openNew()" data-testid="add-banner" class="bg-primary text-white px-4 py-2 rounded-btn text-[13px] font-bold shadow-green flex items-center gap-2">
          <lucide-icon [img]="PlusIcon" [size]="14"></lucide-icon>Add Banner
        </button>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        @for (b of banners(); track b.id) {
          <div class="bg-white rounded-card p-4 shadow-soft">
            <div class="aspect-[2/1] rounded-2xl overflow-hidden mb-3 bg-primary-light">
              @if (b.imageUrl) { <img [src]="b.imageUrl" class="w-full h-full object-cover" /> }
            </div>
            <p class="text-[14px] font-bold">{{ b.title }}</p>
            @if (b.subtitle) { <p class="text-[11px] text-text-secondary mt-0.5">{{ b.subtitle }}</p> }
            <div class="flex items-center justify-between mt-3">
              <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    [class.bg-primary-light]="b.isActive" [class.text-primary]="b.isActive"
                    [class.bg-red-50]="!b.isActive" [class.text-red-500]="!b.isActive">
                {{ b.isActive ? 'Visible' : 'Hidden' }}
              </span>
              <div class="flex gap-2">
                <button (click)="toggle(b)" class="text-text-secondary text-[12px] font-semibold">Toggle</button>
                <button (click)="openEdit(b)" class="text-primary"><lucide-icon [img]="EditIcon" [size]="14"></lucide-icon></button>
                <button (click)="remove(b.id)" class="text-red-500"><lucide-icon [img]="TrashIcon" [size]="14"></lucide-icon></button>
              </div>
            </div>
          </div>
        } @empty { <p class="text-text-secondary text-[13px] py-6">No banners yet.</p> }
      </div>

      @if (bannerToDelete()) {
        <app-confirm-dialog
          title="Delete Banner"
          message="Delete this banner? This cannot be undone."
          confirmLabel="Delete"
          (confirmed)="confirmDelete()"
          (cancelled)="bannerToDelete.set(null)" />
      }

      @if (modal()) {
        <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="modal.set(false)">
          <div class="bg-white rounded-card p-6 w-full max-w-md" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-[16px] font-extrabold">{{ form().id ? 'Edit Banner' : 'New Banner' }}</h2>
              <button (click)="modal.set(false)"><lucide-icon [img]="XIcon" [size]="18"></lucide-icon></button>
            </div>
            <div class="space-y-3">
              <input [(ngModel)]="form().title" placeholder="Title" class="w-full px-3 py-2 rounded-input border border-border-soft text-[13px]" />
              <input [(ngModel)]="form().subtitle" placeholder="Subtitle (optional)" class="w-full px-3 py-2 rounded-input border border-border-soft text-[13px]" />
              <input [(ngModel)]="form().ctaLabel" placeholder="CTA label (e.g. Shop Now)" class="w-full px-3 py-2 rounded-input border border-border-soft text-[13px]" />
              <input [(ngModel)]="form().redirectUrl" placeholder="Redirect URL (/products)" class="w-full px-3 py-2 rounded-input border border-border-soft text-[13px]" />
              <div class="flex items-center gap-3">
                @if (form().imageUrl) { <img [src]="form().imageUrl" class="w-14 h-14 rounded-xl object-cover bg-primary-light" /> }
                <label class="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-input border border-dashed border-primary/40 text-[12px] text-primary font-semibold"
                       [class.opacity-50]="uploading()" [class.pointer-events-none]="uploading()">
                  @if (uploading()) {
                    <lucide-icon [img]="LoaderIcon" [size]="14" class="animate-spin"></lucide-icon> Uploading...
                  } @else {
                    <lucide-icon [img]="UploadIcon" [size]="14"></lucide-icon> Upload Image
                  }
                  <input type="file" accept="image/*" class="hidden" (change)="upload($event)" [disabled]="uploading()" />
                </label>
              </div>
              <input [(ngModel)]="form().imageUrl" placeholder="…or paste image URL" class="w-full px-3 py-2 rounded-input border border-border-soft text-[12px]" />
              <label class="flex items-center gap-2 text-[12px]"><input type="checkbox" [(ngModel)]="form().isActive" /> Visible</label>
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
export class BannersAdminComponent {
  private readonly bannersSvc = inject(BannersService);
  private readonly storage = inject(StorageService);
  readonly banners = toSignal(this.bannersSvc.listAll(), { initialValue: [] as Banner[] });
  readonly modal = signal(false);
  readonly saving = signal(false);
  readonly form = signal<{ id?: string; title: string; subtitle: string; ctaLabel: string; imageUrl: string; redirectUrl: string; isActive: boolean; }>({
    title: '', subtitle: '', ctaLabel: 'Shop Now', imageUrl: '', redirectUrl: '/products', isActive: true,
  });
  readonly uploading = signal(false);
  readonly bannerToDelete = signal<string | null>(null);
  readonly PlusIcon = Plus; readonly EditIcon = Pencil; readonly TrashIcon = Trash2;
  readonly UploadIcon = Upload; readonly XIcon = X; readonly LoaderIcon = Loader2;

  openNew(): void { this.form.set({ title: '', subtitle: '', ctaLabel: 'Shop Now', imageUrl: '', redirectUrl: '/products', isActive: true }); this.modal.set(true); }
  openEdit(b: Banner): void {
    this.form.set({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? '',
      ctaLabel: b.ctaLabel ?? '',
      imageUrl: b.imageUrl,
      redirectUrl: b.redirectUrl ?? '',
      isActive: b.isActive,
    });
    this.modal.set(true);
  }
  async upload(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    try {
      const url = await this.storage.upload('banners', file);
      this.form.update((f) => ({ ...f, imageUrl: url }));
    } finally {
      this.uploading.set(false);
    }
  }
  async save(): Promise<void> {
    const f = this.form();
    if (!f.title) return;
    this.saving.set(true);
    try {
      const payload = {
        title: f.title,
        subtitle: f.subtitle || '',
        ctaLabel: f.ctaLabel || '',
        imageUrl: f.imageUrl,
        redirectUrl: f.redirectUrl || '',
        isActive: f.isActive,
        sortOrder: 100,
      };
      if (f.id) await this.bannersSvc.update(f.id, payload);
      else await this.bannersSvc.create(payload);
      this.modal.set(false);
    } finally { this.saving.set(false); }
  }
  async toggle(b: Banner): Promise<void> { await this.bannersSvc.update(b.id, { isActive: !b.isActive }); }
  remove(id: string): void { this.bannerToDelete.set(id); }
  async confirmDelete(): Promise<void> {
    const id = this.bannerToDelete();
    if (!id) return;
    this.bannerToDelete.set(null);
    await this.bannersSvc.remove(id);
  }
}
