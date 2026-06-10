import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-angular';
import { AuthService, friendlyAuthError } from '../../core/services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  template: `
    <div data-testid="signup-page" class="min-h-screen w-full flex flex-col" style="background:#08B44D;">
      <div class="flex-shrink-0 px-6 pt-14 pb-8 text-white">
        <div class="w-16 h-16 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center mb-5">
          <span class="text-3xl">🥝</span>
        </div>
        <h1 class="text-3xl font-extrabold leading-tight">Create your<br/>account</h1>
        <p class="text-white/85 text-sm mt-2">Join InstaFruit and get fresh fruits delivered.</p>
      </div>

      <div class="flex-1 bg-white px-6 pt-8 pb-10 animate-slide-up" style="border-top-left-radius:40px; border-top-right-radius:40px;">
        <form (ngSubmit)="onSubmit()" class="space-y-4">
          <div class="bg-[#F7F7F7] rounded-input px-4 h-14 flex items-center gap-3">
            <lucide-icon [img]="UserIcon" [size]="18" class="text-text-secondary"></lucide-icon>
            <input data-testid="signup-name" name="name" required [(ngModel)]="name"
                   placeholder="Full Name" class="flex-1 bg-transparent outline-none text-sm" />
          </div>
          <div class="bg-[#F7F7F7] rounded-input px-4 h-14 flex items-center gap-3">
            <lucide-icon [img]="MailIcon" [size]="18" class="text-text-secondary"></lucide-icon>
            <input data-testid="signup-email" name="email" type="email" required [(ngModel)]="email"
                   placeholder="Email Address" class="flex-1 bg-transparent outline-none text-sm" />
          </div>
          <div class="bg-[#F7F7F7] rounded-input px-4 h-14 flex items-center gap-3">
            <lucide-icon [img]="LockIcon" [size]="18" class="text-text-secondary"></lucide-icon>
            <input data-testid="signup-password" name="password" required
                   [type]="showPwd() ? 'text' : 'password'" [(ngModel)]="password"
                   placeholder="Password (min 6 characters)" class="flex-1 bg-transparent outline-none text-sm" />
            <button type="button" (click)="showPwd.set(!showPwd())" class="text-text-secondary">
              <lucide-icon [img]="showPwd() ? EyeOffIcon : EyeIcon" [size]="18"></lucide-icon>
            </button>
          </div>

          @if (error()) {
            <div class="bg-red-50 text-red-600 rounded-input px-4 py-3 text-[12px] font-medium flex items-center gap-2" data-testid="signup-error">
              <lucide-icon [img]="AlertIcon" [size]="14"></lucide-icon>
              {{ error() }}
            </div>
          }

          <button type="submit" data-testid="signup-submit" [disabled]="loading()"
                  class="w-full h-14 bg-primary text-white rounded-btn text-[15px] font-bold shadow-green active:scale-[0.98] disabled:opacity-60">
            {{ loading() ? 'Creating account…' : 'Sign Up' }}
          </button>
        </form>

        <div class="flex items-center gap-3 my-6">
          <div class="flex-1 h-px bg-border-soft"></div>
          <span class="text-[11px] text-text-secondary font-medium">or continue with</span>
          <div class="flex-1 h-px bg-border-soft"></div>
        </div>

        <button type="button" data-testid="signup-phone" (click)="goPhone()"
                class="w-full h-14 bg-white border border-border-soft rounded-btn flex items-center justify-center gap-3 text-[14px] font-semibold text-text-primary">
          📱 Continue with Phone OTP
        </button>

        <p class="text-center text-[13px] text-text-secondary mt-6">
          Already have an account?
          <a routerLink="/login" data-testid="goto-login" class="text-primary font-semibold ml-1">Sign In</a>
        </p>
      </div>
    </div>
  `,
})
export class SignupComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  name = ''; email = ''; password = '';
  showPwd = signal(false);
  loading = signal(false);
  error = signal('');
  readonly MailIcon = Mail; readonly LockIcon = Lock; readonly UserIcon = User;
  readonly EyeIcon = Eye; readonly EyeOffIcon = EyeOff; readonly AlertIcon = AlertCircle;

  async onSubmit(): Promise<void> {
    if (!this.name || !this.email || !this.password) { this.error.set('All fields are required'); return; }
    if (this.password.length < 6) { this.error.set('Password must be at least 6 characters'); return; }
    this.loading.set(true); this.error.set('');
    try {
      await this.auth.signUp(this.name.trim(), this.email.trim(), this.password);
      this.router.navigate(['/home']);
    } catch (e: unknown) {
      this.error.set(friendlyAuthError(e, 'Signup failed'));
    } finally { this.loading.set(false); }
  }

  goPhone(): void { this.router.navigate(['/otp']); }
}
