import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  template: `
    <div data-testid="login-page" class="min-h-screen w-full flex flex-col" style="background:#08B44D;">
      <div class="flex-shrink-0 px-6 pt-14 pb-8 text-white">
        <div class="w-16 h-16 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center mb-5">
          <span class="text-3xl">🥝</span>
        </div>
        <h1 class="text-3xl font-extrabold leading-tight">Welcome back<br/>to InstaFruit</h1>
        <p class="text-white/85 text-sm mt-2">Sign in to continue shopping fresh fruits.</p>
      </div>

      <div class="flex-1 bg-white px-6 pt-8 pb-10 animate-slide-up" style="border-top-left-radius:40px; border-top-right-radius:40px;">
        <form (ngSubmit)="onSubmit()" class="space-y-4">
          <div class="bg-[#F7F7F7] rounded-input px-4 h-14 flex items-center gap-3">
            <lucide-icon [img]="MailIcon" [size]="18" class="text-text-secondary"></lucide-icon>
            <input data-testid="login-email" name="email" type="email" required
                   [(ngModel)]="email" placeholder="Email Address"
                   class="flex-1 bg-transparent outline-none text-sm" />
          </div>
          <div class="bg-[#F7F7F7] rounded-input px-4 h-14 flex items-center gap-3">
            <lucide-icon [img]="LockIcon" [size]="18" class="text-text-secondary"></lucide-icon>
            <input data-testid="login-password" name="password" required
                   [type]="showPwd() ? 'text' : 'password'"
                   [(ngModel)]="password" placeholder="Password"
                   class="flex-1 bg-transparent outline-none text-sm" />
            <button type="button" (click)="showPwd.set(!showPwd())" class="text-text-secondary">
              <lucide-icon [img]="showPwd() ? EyeOffIcon : EyeIcon" [size]="18"></lucide-icon>
            </button>
          </div>

          <button type="button" (click)="loginWithGoogle()">
              Continue with Google 
          </button>

          <div class="text-right">
            <a data-testid="forgot-password" (click)="forgot()" class="text-[12px] text-primary font-semibold cursor-pointer">Forgot password?</a>
          </div>

          @if (resetSent()) {
            <div class="bg-green-50 text-green-700 rounded-input px-4 py-3 text-[12px] font-medium flex items-center gap-2">
              <lucide-icon [img]="MailIcon" [size]="14"></lucide-icon>
              Password reset email sent to {{ email }}
            </div>
          }

          @if (error()) {
            <div class="bg-red-50 text-red-600 rounded-input px-4 py-3 text-[12px] font-medium flex items-center gap-2" data-testid="login-error">
              <lucide-icon [img]="AlertIcon" [size]="14"></lucide-icon>
              {{ error() }}
            </div>
          }

          <button type="submit" data-testid="login-submit" [disabled]="loading()"
                  class="w-full h-14 bg-primary text-white rounded-btn text-[15px] font-bold shadow-green active:scale-[0.98] disabled:opacity-60">
            {{ loading() ? 'Signing in…' : 'Sign In' }}
          </button>
        </form>

        <div class="flex items-center gap-3 my-6">
          <div class="flex-1 h-px bg-border-soft"></div>
          <span class="text-[11px] text-text-secondary font-medium">or continue with</span>
          <div class="flex-1 h-px bg-border-soft"></div>
        </div>

        <button type="button" data-testid="login-phone" (click)="goPhone()"
                class="w-full h-14 bg-white border border-border-soft rounded-btn flex items-center justify-center gap-3 text-[14px] font-semibold text-text-primary">
          📱 Continue with Phone OTP
        </button>

        <p class="text-center text-[13px] text-text-secondary mt-6">
          Don't have an account?
          <a routerLink="/signup" data-testid="goto-signup" class="text-primary font-semibold ml-1">Sign Up</a>
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  email = '';
  password = '';
  showPwd = signal(false);
  loading = signal(false);
  error = signal('');
  resetSent = signal(false);
  readonly MailIcon = Mail; readonly LockIcon = Lock; readonly EyeIcon = Eye; readonly EyeOffIcon = EyeOff;
  readonly AlertIcon = AlertCircle;

  readonly authService = inject(AuthService);

  async onSubmit(): Promise<void> {
    if (!this.email || !this.password) { this.error.set('Email and password are required'); return; }
    this.loading.set(true); this.error.set('');
    try {
      await this.auth.signIn(this.email.trim(), this.password);
      // Wait for profile/role to load via guard, then route.
      this.router.navigate([this.auth.isAdmin() ? '/admin/dashboard' : '/home']);
    } catch (e: unknown) {
      this.error.set(this.friendly(e));
    } finally {
      this.loading.set(false);
    }
  }

  async forgot(): Promise<void> {
    if (!this.email) { this.error.set('Enter your email above first'); return; }
    try {
      await this.auth.resetPassword(this.email.trim());
      this.error.set('');
      this.resetSent.set(true);
    } catch (e) { this.error.set(this.friendly(e)); }
  }

  goPhone(): void { this.router.navigate(['/otp']); }

  private friendly(e: unknown): string {
    const code = (e as { code?: string })?.code ?? '';
    if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Invalid email or password';
    if (code.includes('user-not-found')) return 'No account with this email';
    if (code.includes('too-many-requests')) return 'Too many attempts. Try again later';
    if (code.includes('network-request-failed')) return 'Network error — check connection';
    return (e as Error)?.message ?? 'Login failed';
  }

  async loginWithGoogle() {
    try {
      await this.authService.signInWithGoogle();
    } catch (e) {
      console.log(e);
    }
  }
}
