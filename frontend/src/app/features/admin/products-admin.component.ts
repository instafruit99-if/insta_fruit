import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Plus, Trash2, Pencil, Upload, X } from 'lucide-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProductsService } from '../../core/services/products.service';
import { CategoriesService } from '../../core/services/categories.service';
import { StorageService } from '../../core/services/storage.service';
import { Product } from '../../core/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-products-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ConfirmDialogComponent],
  template: `
    <div data-testid="products-admin" class="space-y-5">
      <div class="flex items-center justify-between">
        <h1 class="text-[22px] font-extrabold text-text-primary">Products</h1>
        <button data-testid="add-product" (click)="openNew()" class="bg-primary text-white px-4 py-2 rounded-btn text-[13px] font-bold shadow-green flex items-center gap-2">
          <lucide-icon [img]="PlusIcon" [size]="14"></lucide-icon>Add Product
        </button>
      </div>

      <div class="bg-white rounded-card shadow-soft overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-[13px]">
            <thead class="bg-[#FAFAFA] text-text-secondary text-[11px] uppercase tracking-wider">
              <tr><th class="px-4 py-3 text-left">Product</th><th class="px-4 py-3 text-left">Category</th><th class="px-4 py-3 text-right">Price</th><th class="px-4 py-3 text-right">Stock</th><th class="px-4 py-3 text-center">Status</th><th class="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              @for (p of products(); track p.id) {
                <tr class="border-t border-border-soft/60">
                  <td class="px-4 py-3 flex items-center gap-3">
                    <img [src]="p.thumbnail" [alt]="p.name" class="w-10 h-10 rounded-xl bg-primary-light object-contain" />
                    <span class="font-semibold">{{ p.name }}</span>
                  </td>
                  <td class="px-4 py-3 text-text-secondary">{{ p.categoryName }}</td>
                  <td class="px-4 py-3 text-right font-bold">₹{{ p.price }}</td>
                  <td class="px-4 py-3 text-right">{{ p.stock }}</td>
                  <td class="px-4 py-3 text-center">
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          [class.bg-primary-light]="p.isAvailable" [class.text-primary]="p.isAvailable"
                          [class.bg-red-50]="!p.isAvailable" [class.text-red-500]="!p.isAvailable">
                      {{ p.isAvailable ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button (click)="toggle(p)" class="text-text-secondary mr-3" title="Toggle">
                      {{ p.isAvailable ? '✓' : '✗' }}
                    </button>
                    <button (click)="openEdit(p)" class="text-primary mr-3" [attr.data-testid]="'edit-' + p.id"><lucide-icon [img]="EditIcon" [size]="14"></lucide-icon></button>
                    <button (click)="remove(p.id)" class="text-red-500" [attr.data-testid]="'delete-' + p.id"><lucide-icon [img]="TrashIcon" [size]="14"></lucide-icon></button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="px-4 py-10 text-center text-text-secondary">No products yet. Click "Add Product".</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      @if (modal()) {
        <div data-testid="product-modal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="closeModal()">
          <div class="bg-white rounded-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-[16px] font-extrabold">{{ form().id ? 'Edit Product' : 'New Product' }}</h2>
              <button (click)="closeModal()"><lucide-icon [img]="XIcon" [size]="18"></lucide-icon></button>
            </div>
            <div class="space-y-3">
              <input data-testid="form-name" [(ngModel)]="form().name" placeholder="Name" class="w-full px-3 py-2 rounded-input border border-border-soft text-[13px]" />
              <textarea [(ngModel)]="form().description" placeholder="Description" rows="3" class="w-full px-3 py-2 rounded-input border border-border-soft text-[13px]"></textarea>
              <div class="grid grid-cols-2 gap-3">
                <input type="number" [(ngModel)]="form().price" placeholder="Price" class="px-3 py-2 rounded-input border border-border-soft text-[13px]" />
                <input type="number" [(ngModel)]="form().stock" placeholder="Stock" class="px-3 py-2 rounded-input border border-border-soft text-[13px]" />
              </div>
              <input [(ngModel)]="form().unit" placeholder="Unit (e.g. 1 kg)" class="w-full px-3 py-2 rounded-input border border-border-soft text-[13px]" />
              <select [(ngModel)]="form().categoryId" class="w-full px-3 py-2 rounded-input border border-border-soft text-[13px]">
                <option value="">Select category</option>
                @for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
              </select>
              <div>
                <label class="block text-[12px] text-text-secondary mb-1">Image</label>
                <div class="flex items-center gap-3">
                  @if (form().thumbnail) {
                    <img [src]="form().thumbnail" class="w-14 h-14 rounded-xl object-contain bg-primary-light" />
                  }
                  <label class="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-input border border-dashed border-primary/40 text-[12px] text-primary font-semibold">
                    <lucide-icon [img]="UploadIcon" [size]="14"></lucide-icon> Upload
                    <input type="file" accept="image/*" class="hidden" (change)="upload($event)" />
                  </label>
                </div>
                <input [(ngModel)]="form().thumbnail" placeholder="…or paste image URL" class="w-full px-3 py-2 mt-2 rounded-input border border-border-soft text-[12px]" />
              </div>
              <label class="flex items-center gap-2 text-[12px]">
                <input type="checkbox" [(ngModel)]="form().isAvailable" /> Active
              </label>
            </div>
            <button data-testid="form-save" (click)="save()" [disabled]="saving()"
                    class="w-full mt-5 bg-primary text-white py-3 rounded-btn text-[14px] font-bold shadow-green disabled:opacity-60">
              {{ saving() ? 'Saving…' : 'Save Product' }}
            </button>
          </div>
        </div>
      }

      @if (productToDelete()) {
        <app-confirm-dialog
          title="Delete Product"
          message="Delete this product? This cannot be undone."
          confirmLabel="Delete"
          (confirmed)="confirmDelete()"
          (cancelled)="productToDelete.set(null)" />
      }
    </div>
  `,
})
export class ProductsAdminComponent {
  private readonly productsSvc = inject(ProductsService);
  private readonly catsSvc = inject(CategoriesService);
  private readonly storage = inject(StorageService);

  readonly products = toSignal(this.productsSvc.list(), { initialValue: [] as Product[] });
  readonly categories = toSignal(this.catsSvc.listAll(), { initialValue: [] });

  readonly modal = signal(false);
  readonly saving = signal(false);
  readonly productToDelete = signal<string | null>(null);
  readonly form = signal<{ id?: string; name: string; description: string; price: number; stock: number; unit: string; categoryId: string; thumbnail: string; isAvailable: boolean; }>({
    name: '', description: '', price: 0, stock: 0, unit: '', categoryId: '', thumbnail: '', isAvailable: true,
  });

  readonly PlusIcon = Plus; readonly TrashIcon = Trash2; readonly EditIcon = Pencil;
  readonly UploadIcon = Upload; readonly XIcon = X;

  openNew(): void {
    this.form.set({ name: '', description: '', price: 0, stock: 0, unit: '1 kg', categoryId: '', thumbnail: '', isAvailable: true });
    this.modal.set(true);
  }
  openEdit(p: Product): void {
    this.form.set({
      id: p.id, name: p.name, description: p.description, price: p.price,
      stock: p.stock, unit: p.unit, categoryId: p.categoryId, thumbnail: p.thumbnail, isAvailable: p.isAvailable,
    });
    this.modal.set(true);
  }
  closeModal(): void { this.modal.set(false); }

  async upload(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = await this.storage.upload('products', file);
    this.form.update((f) => ({ ...f, thumbnail: url }));
  }

  async save(): Promise<void> {
    const f = this.form();
    if (!f.name || !f.price || !f.categoryId) return;
    const cat = this.categories().find((c) => c.id === f.categoryId);
    if (!cat) return;
    this.saving.set(true);
    try {
      const payload = {
        name: f.name, slug: f.name.toLowerCase().replace(/\s+/g, '-'),
        description: f.description, price: +f.price, stock: +f.stock, unit: f.unit,
        categoryId: f.categoryId, categoryName: cat.name,
        thumbnail: f.thumbnail, images: [f.thumbnail],
        searchKeywords: [f.name.toLowerCase(), cat.name.toLowerCase()],
        isAvailable: f.isAvailable,
      };
      if (f.id) await this.productsSvc.update(f.id, payload);
      else await this.productsSvc.create(payload);
      this.modal.set(false);
    } finally { this.saving.set(false); }
  }

  async toggle(p: Product): Promise<void> { await this.productsSvc.update(p.id, { isAvailable: !p.isAvailable }); }
  remove(id: string): void { this.productToDelete.set(id); }
  async confirmDelete(): Promise<void> {
    const id = this.productToDelete();
    if (!id) return;
    this.productToDelete.set(null);
    await this.productsSvc.remove(id);
  }
}
