import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule, ChevronLeft, MapPin, Wallet, Banknote, Pencil, AlertCircle, Loader2, Trash2 } from 'lucide-angular';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { OrdersService } from '../../core/services/orders.service';
import { RazorpayService } from '../../core/services/razorpay.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { Address, PaymentMethod } from '../../core/models';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div data-testid="checkout-page" class="min-h-screen bg-[#FAFAFA] pb-32">
      <div class="px-5 pt-12 pb-4 flex items-center justify-between bg-white border-b border-border-soft/50">
        <button data-testid="back-btn" (click)="back()" class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
          <lucide-icon [img]="ChevronIcon" [size]="20" class="text-primary"></lucide-icon>
        </button>
        <h1 class="text-[16px] font-extrabold text-text-primary">Checkout</h1>
        <div class="w-10"></div>
      </div>

      <div class="px-5 pt-5 space-y-5">
        <div>
          <h2 class="text-[14px] font-bold text-text-primary mb-2">Delivery Address</h2>
          @if (isEditingAddress()) {
            <div class="bg-white rounded-card p-4 shadow-soft space-y-3">
              <input #addrLabel class="w-full text-[13px] px-3 py-2 rounded-input border border-border-soft" placeholder="Label (e.g. Home)" [value]="address()?.label || ''">
              <input #addrLine1 class="w-full text-[13px] px-3 py-2 rounded-input border border-border-soft" placeholder="Street Address" [value]="address()?.line1 || ''">
              <div class="flex gap-2">
                <input #addrCity class="w-1/2 text-[13px] px-3 py-2 rounded-input border border-border-soft" placeholder="City" [value]="address()?.city || ''">
                <input #addrState class="w-1/2 text-[13px] px-3 py-2 rounded-input border border-border-soft" placeholder="State" [value]="address()?.state || ''">
              </div>
              <input #addrPin class="w-full text-[13px] px-3 py-2 rounded-input border border-border-soft" placeholder="Postal Code" [value]="address()?.postalCode || ''">
              <div class="flex gap-2 mt-2">
                <button (click)="isEditingAddress.set(false)" class="flex-1 bg-gray-100 text-text-primary text-[13px] font-semibold py-2 rounded-xl">Cancel</button>
                <button (click)="saveAddress(addrLabel.value, addrLine1.value, addrCity.value, addrState.value, addrPin.value)" class="flex-1 bg-primary text-white text-[13px] font-bold py-2 rounded-xl shadow-green flex items-center justify-center">
                  @if (loading()) { <lucide-icon [img]="LoaderIcon" [size]="16" class="animate-spin"></lucide-icon> } @else { Save Address }
                </button>
              </div>
            </div>
          } @else if (address()) {
            <div data-testid="address-card" class="bg-white rounded-card p-4 shadow-soft flex items-start gap-3">
              <div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                <lucide-icon [img]="MapPinIcon" [size]="18" class="text-primary"></lucide-icon>
              </div>
              <div class="flex-1">
                <p class="text-[13px] font-bold text-text-primary">{{ address()!.label }}</p>
                <p class="text-[12px] text-text-secondary leading-relaxed mt-0.5">{{ address()!.line1 }}<br/>{{ address()!.city }}, {{ address()!.state }} {{ address()!.postalCode }}</p>
              </div>
                  <div class="flex flex-col gap-2 shrink-0">
                    <button (click)="isEditingAddress.set(true)" class="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-border-soft shadow-sm transition-colors active:bg-gray-50">
                      <lucide-icon [img]="PencilIcon" [size]="16" class="text-text-secondary"></lucide-icon>
                    </button>
                    <button (click)="confirmDeleteAddress()" class="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center border border-red-100 shadow-sm transition-colors active:bg-red-100">
                      <lucide-icon [img]="TrashIcon" [size]="16" class="text-red-500"></lucide-icon>
                    </button>
                  </div>
            </div>
          } @else {
            <div class="bg-white rounded-card p-4 shadow-soft flex flex-col items-center justify-center py-6 border-2 border-dashed border-border-soft">
               <p class="text-[12px] text-text-secondary mb-3 font-medium">No delivery address found</p>
               <button (click)="isEditingAddress.set(true)" class="text-[13px] font-bold text-primary border border-primary/30 px-5 py-2.5 rounded-xl bg-primary-light hover:bg-primary/20 transition-colors">Add Address</button>
            </div>
          }
        </div>

        <div>
          <h2 class="text-[14px] font-bold text-text-primary mb-2">Delivery Slot</h2>
          <div class="bg-white rounded-card p-4 shadow-soft text-[13px] font-semibold text-text-primary">
            7AM – 9AM (next available)
          </div>
        </div>

        <div>
          <h2 class="text-[14px] font-bold text-text-primary mb-2">Payment Method</h2>
          <div class="space-y-3">
            <button data-testid="payment-cod" (click)="payment.set('cod')"
                    class="w-full bg-white rounded-card p-4 shadow-soft flex items-center gap-3 transition-all"
                    [class.ring-2]="payment() === 'cod'" [class.ring-primary]="payment() === 'cod'">
              <div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
                <lucide-icon [img]="CashIcon" [size]="18" class="text-primary"></lucide-icon>
              </div>
              <div class="flex-1 text-left">
                <p class="text-[13px] font-bold text-text-primary">Cash on Delivery</p>
                <p class="text-[11px] text-text-secondary">Pay when your order arrives</p>
              </div>
              <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                [class.border-primary]="payment() === 'cod'" [class.border-border-soft]="payment() !== 'cod'">
                @if (payment() === 'cod') { <span class="w-2.5 h-2.5 rounded-full bg-primary"></span> }
              </span>
            </button>

            <button data-testid="payment-razorpay" (click)="payment.set('razorpay')"
                    class="w-full bg-white rounded-card p-4 shadow-soft flex items-center gap-3 transition-all"
                    [class.ring-2]="payment() === 'razorpay'" [class.ring-primary]="payment() === 'razorpay'">
              <div class="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
                <lucide-icon [img]="WalletIcon" [size]="18" class="text-primary"></lucide-icon>
              </div>
              <div class="flex-1 text-left">
                <p class="text-[13px] font-bold text-text-primary">Razorpay</p>
                <p class="text-[11px] text-text-secondary">UPI, Cards, Wallets, Net banking</p>
              </div>
              <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                [class.border-primary]="payment() === 'razorpay'" [class.border-border-soft]="payment() !== 'razorpay'">
                @if (payment() === 'razorpay') { <span class="w-2.5 h-2.5 rounded-full bg-primary"></span> }
              </span>
            </button>
          </div>
        </div>

        <div>
          <h2 class="text-[14px] font-bold text-text-primary mb-2">Price Summary</h2>
          <div class="bg-white rounded-card p-4 shadow-soft space-y-2">
            <div class="flex justify-between text-[13px]"><span class="text-text-secondary">Subtotal</span><span class="font-semibold">₹{{ cart.subtotal().toFixed(2) }}</span></div>
            <div class="flex justify-between text-[13px]"><span class="text-text-secondary">Delivery fee</span><span class="font-semibold">₹{{ cart.deliveryFee().toFixed(2) }}</span></div>
            <div class="flex justify-between text-[13px]"><span class="text-text-secondary">Discount</span><span class="font-semibold text-primary">- ₹0.00</span></div>
            <div class="h-px bg-border-soft my-2"></div>
            <div class="flex justify-between text-[15px] font-extrabold"><span>Total</span><span class="text-primary">₹{{ cart.total().toFixed(2) }}</span></div>
          </div>
        </div>

      @if (error()) {
        <div class="fixed top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-[380px] z-[100] shadow-2xl">
          <div class="bg-white border-l-4 border-red-500 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top-2 fade-in duration-200">
            <lucide-icon [img]="AlertIcon" [size]="18" class="text-red-500 shrink-0 mt-0.5"></lucide-icon>
            <div class="flex-1">
              <p class="text-[14px] font-bold text-text-primary">Oops!</p>
              <p class="text-[12px] text-text-secondary mt-0.5" data-testid="checkout-error">{{ error() }}</p>
            </div>
            <button (click)="error.set('')" class="text-text-secondary hover:text-text-primary p-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
      }
      </div>

      <div class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app bg-white border-t border-border-soft px-5 py-4 z-40">
        <button data-testid="place-order-btn" (click)="placeOrder()" [disabled]="placingOrder() || loading() || cart.items().length === 0 || isEditingAddress()"
                class="w-full h-14 bg-primary text-white rounded-btn text-[15px] font-bold shadow-green active:scale-[0.98] disabled:opacity-60">
          {{ placingOrder() ? 'Processing…' : 'Place Order • ₹' + cart.total().toFixed(2) }}
        </button>
      </div>

      @if (showDeleteConfirm()) {
        <div class="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div class="bg-white w-full max-w-[340px] rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <lucide-icon [img]="TrashIcon" [size]="24" class="text-red-500"></lucide-icon>
            </div>
            <h3 class="text-center text-[18px] font-extrabold text-text-primary mb-2">Delete Address</h3>
            <p class="text-center text-[13px] text-text-secondary mb-6 leading-relaxed">Are you sure you want to delete this address? This action cannot be undone.</p>
            <div class="flex gap-3">
              <button (click)="showDeleteConfirm.set(false)" class="flex-1 h-12 rounded-xl bg-[#F0F0F0] hover:bg-[#E5E5E5] text-text-primary font-bold text-[14px] transition-colors">Cancel</button>
              <button (click)="deleteAddress()" class="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-[14px] transition-colors shadow-sm">Delete</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class CheckoutComponent {
  readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly orders = inject(OrdersService);
  private readonly razorpay = inject(RazorpayService);
  private readonly analytics = inject(AnalyticsService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly payment = signal<PaymentMethod>('cod');
  readonly loading = signal(false);
  readonly placingOrder = signal(false);
  readonly error = signal('');
  private placeOrderRequestId: string | null = null;
  readonly ChevronIcon = ChevronLeft; readonly MapPinIcon = MapPin;
  readonly WalletIcon = Wallet; readonly CashIcon = Banknote; readonly PencilIcon = Pencil;
  readonly AlertIcon = AlertCircle; readonly TrashIcon = Trash2;

  readonly isEditingAddress = signal(false);
  readonly showDeleteConfirm = signal(false);
  readonly LoaderIcon = Loader2;

  readonly address = computed<Address | undefined>(() => this.auth.profile()?.defaultAddress);

  async saveAddress(label: string, line1: string, city: string, state: string, postalCode: string): Promise<void> {
    const profile = this.auth.profile();
    if (!profile) return;
    if (!label.trim() || !line1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
      this.error.set('All address fields are required');
      return;
    }
    this.error.set('');
    const newAddr: Address = {
      label: label.trim(), line1: line1.trim(), city: city.trim(), state: state.trim(), postalCode: postalCode.trim(), country: 'India'
    };
    try {
      this.loading.set(true);
      await this.auth.updateProfile(profile.uid, { defaultAddress: newAddr });
      this.isEditingAddress.set(false);
    } catch (e) {
      this.error.set('Failed to save address');
    } finally {
      this.loading.set(false);
    }
  }

  confirmDeleteAddress(): void {
    this.showDeleteConfirm.set(true);
  }

  async deleteAddress(): Promise<void> {
    const profile = this.auth.profile();
    if (!profile) return;
    
    this.showDeleteConfirm.set(false);
    try {
      this.loading.set(true);
      await this.auth.updateProfile(profile.uid, { defaultAddress: null as any });
      this.error.set('');
    } catch (e) {
      this.error.set('Failed to delete address');
    } finally {
      this.loading.set(false);
    }
  }

  async placeOrder(): Promise<void> {
    const profile = this.auth.profile();
    if (!profile) { this.error.set('Please sign in to continue'); return; }
    if (!this.address()) { this.error.set('Please add a delivery address first'); return; }
    if (this.cart.items().length === 0) return;
    if (this.placingOrder()) return;
    this.placingOrder.set(true);
    this.error.set('');
    if (!this.placeOrderRequestId) {
      this.placeOrderRequestId = crypto.randomUUID();
    }
    try {
      const orderId = await this.orders.create({
        requestId: this.placeOrderRequestId,
        userName: profile.fullName,
        userPhone: profile.phone,
        paymentMethod: this.payment(),
        deliverySlot: '7AM - 9AM',
        address: this.address()!,
      });

      if (this.payment() === 'razorpay') {
        const rzpOrder = await this.orders.createRazorpayOrder({
          orderId, amount: +this.cart.total().toFixed(2), currency: 'INR',
        });
        const success = await this.razorpay.openCheckout({
          razorpayOrderId: rzpOrder.razorpayOrderId,
          amountInr: rzpOrder.amount, orderId,
        });
        await this.orders.verifyRazorpayPayment({
          razorpayOrderId: success.razorpay_order_id,
          razorpayPaymentId: success.razorpay_payment_id,
          razorpaySignature: success.razorpay_signature,
          orderId,
        });
      }

      this.analytics.track('purchase', { orderId, total: this.cart.total() });
      this.placeOrderRequestId = null;
      this.cart.clear();
      this.router.navigate(['/order-success', orderId]);
    } catch (e) {
      this.error.set((e as Error)?.message ?? 'Please try again');
    } finally {
      this.placingOrder.set(false);
    }
  }

  back(): void { this.location.back(); }
}
