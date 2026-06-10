import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, onAuthStateChanged, User,  GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { Firestore, doc, setDoc, updateDoc, serverTimestamp, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import { AppUser } from '../models';

/** Firestore rejects `undefined` anywhere in nested maps — strip before writes. */
function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (typeof (value as { _methodName?: unknown })._methodName === 'string') return value;
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefinedDeep(v)]),
  );
}

/** Map Firebase auth errors to user-friendly messages. Shared by login, signup and OTP screens. */
export function friendlyAuthError(e: unknown, fallback = 'Something went wrong. Please try again'): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Invalid email or password';
  if (code.includes('user-not-found')) return 'No account with this email';
  if (code.includes('email-already-in-use')) return 'Email is already registered';
  if (code.includes('weak-password')) return 'Password is too weak';
  if (code.includes('invalid-email')) return 'Invalid email address';
  if (code.includes('invalid-phone-number')) return 'Invalid phone number';
  if (code.includes('invalid-verification-code')) return 'Incorrect code. Check and try again';
  if (code.includes('code-expired')) return 'Code expired. Tap Resend OTP to get a new one';
  if (code.includes('too-many-requests')) return 'Too many attempts. Try again later';
  if (code.includes('network-request-failed')) return 'Network error — check connection';
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return 'Sign-in was cancelled';
  if (code) return fallback;
  return (e as Error)?.message || fallback;
}

/** Normalize legacy Firestore field `profileImageUrl` (Google sign-in) into `profileImage`. */
function docToAppUser(raw: Record<string, unknown>, uid?: string): AppUser {
  const d = raw as unknown as AppUser & { profileImageUrl?: string };
  const profileImage = d.profileImage ?? d.profileImageUrl;
  return {
    ...d,
    uid: d.uid ?? uid ?? '',
    profileImage: profileImage || undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly db = inject(Firestore);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null>(null);
  private readonly _profile = signal<AppUser | null>(null);
  private readonly _loading = signal<boolean>(true);

  readonly user = this._user.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly isAdmin = signal(false);

  private confirmationResult: ConfirmationResult | null = null;
  private recaptchaVerifier: RecaptchaVerifier | null = null;

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this._user.set(user);
      if (user) this.loadProfile(user.uid);
      else { this._profile.set(null); this._loading.set(false); }
    });
  }

  /** Monotonic token so a slow profile read can never overwrite a newer one (e.g. set by verifyOtp). */
  private profileLoadSeq = 0;

  /** Single place that applies a profile to the signals; invalidates any in-flight loadProfile read. */
  private applyProfile(profile: AppUser | null): void {
    this.profileLoadSeq++;
    this._profile.set(profile);
    this.isAdmin.set(profile?.role === 'admin');
  }

  private async loadProfile(uid: string): Promise<void> {
    const seq = ++this.profileLoadSeq;
    try {
      const ref = doc(this.db, `users/${uid}`);
      const snapshot = await getDoc(ref);
      if (seq !== this.profileLoadSeq) return; // a newer load/apply won — discard stale read

      const profile = snapshot.exists()
        ? docToAppUser(snapshot.data() as Record<string, unknown>, uid)
        : null;

      if (profile?.isBlocked) {
        await this.signOutUser();
        return;
      }

      this._profile.set(profile);
      this.isAdmin.set(profile?.role === 'admin');
    } catch (e) {
      console.log(e);
    } finally {
      this._loading.set(false);
    }
  }
  profile$(): Observable<AppUser | null> {
    return new Observable<AppUser | null>((subscriber) => {

      const unsub = onAuthStateChanged(this.auth, async (u) => {

        if (!u) {
          subscriber.next(null);
          return;
        }

        try {
          const snapshot = await getDoc(doc(this.db, `users/${u.uid}`));

          if (snapshot.exists()) {
            subscriber.next(docToAppUser(snapshot.data() as Record<string, unknown>, u.uid));
          } else {
            subscriber.next(null);
          }

        } catch (e) {
          console.log(e);
          subscriber.next(null);
        }

      });

      return () => unsub();
    });
  }

  async signUp(fullName: string, email: string, password: string, phone = ''): Promise<void> {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    const userDoc: AppUser = {
      uid: cred.user.uid,
      fullName,
      email,
      phone,
      role: 'customer',
      isPhoneVerified: false,
      favoriteProductIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await setDoc(doc(this.db, `users/${cred.user.uid}`), {
      ...userDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    await this.assertNotBlocked(cred.user.uid);
  }

  /**
   * Signs the user back out and throws if their profile is blocked by an admin.
   * Otherwise applies the freshly read profile so role-based redirects are immediate.
   */
  private async assertNotBlocked(uid: string): Promise<void> {
    const snapshot = await getDoc(doc(this.db, `users/${uid}`));
    if (snapshot.exists() && (snapshot.data() as { isBlocked?: boolean }).isBlocked) {
      await signOut(this.auth);
      throw new Error('Your account has been blocked. Please contact support.');
    }
    if (snapshot.exists()) {
      this.applyProfile(docToAppUser(snapshot.data() as Record<string, unknown>, uid));
    }
  }

  async signOutUser(): Promise<void> {
    await signOut(this.auth);
    await this.router.navigate(['/login']);
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  /** Phone OTP: send code. Pass an element id that holds the invisible reCAPTCHA. Safe to call again for resend. */
  async sendOtp(phoneE164: string, recaptchaContainerId: string): Promise<void> {
    this.clearRecaptcha(recaptchaContainerId);
    this.recaptchaVerifier = new RecaptchaVerifier(this.auth, recaptchaContainerId, { size: 'invisible' });
    this.confirmationResult = await signInWithPhoneNumber(this.auth, phoneE164, this.recaptchaVerifier);
  }

  /** Phone OTP: verify code. Creates user doc if first-time. Returns the user's profile. */
  async verifyOtp(code: string): Promise<AppUser> {
    if (!this.confirmationResult) throw new Error('OTP not requested');
    const cred = await this.confirmationResult.confirm(code);
    this.confirmationResult = null;
    this.clearRecaptcha();

    const ref = doc(this.db, `users/${cred.user.uid}`);
    const existing = await getDoc(ref);
    if (existing.exists() && (existing.data() as { isBlocked?: boolean }).isBlocked) {
      await signOut(this.auth);
      throw new Error('Your account has been blocked. Please contact support.');
    }
    if (existing.exists()) {
      await updateDoc(ref, {
        phone: cred.user.phoneNumber ?? '',
        isPhoneVerified: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: cred.user.uid,
        fullName: cred.user.displayName ?? '',
        email: cred.user.email ?? '',
        phone: cred.user.phoneNumber ?? '',
        role: 'customer',
        isPhoneVerified: true,
        favoriteProductIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const snapshot = await getDoc(ref);
    const profile = docToAppUser(snapshot.data() as Record<string, unknown>, cred.user.uid);
    this.applyProfile(profile);
    return profile;
  }

  private clearRecaptcha(containerId?: string): void {
    try { this.recaptchaVerifier?.clear(); } catch { /* already destroyed */ }
    this.recaptchaVerifier = null;
    if (containerId) {
      const container = document.getElementById(containerId);
      if (container) container.innerHTML = '';
    }
  }

  async updateProfile(uid: string, patch: Partial<AppUser>): Promise<void> {
    const authUid = this.auth.currentUser?.uid;
    if (!authUid || authUid !== uid) {
      throw new Error('Unauthorized profile update');
    }

    const ref = doc(this.db, `users/${authUid}`);
    const clean = stripUndefinedDeep(
      Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
    ) as Partial<AppUser>;

    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, { ...clean, updatedAt: serverTimestamp() });
    } else {
      const user = this.auth.currentUser!;
      await setDoc(ref, stripUndefinedDeep({
        uid: authUid,
        fullName: user.displayName ?? '',
        email: user.email ?? '',
        phone: user.phoneNumber ?? '',
        role: 'customer',
        isPhoneVerified: false,
        favoriteProductIds: [],
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }) as Record<string, unknown>);
    }

    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      this.applyProfile(docToAppUser(snapshot.data() as Record<string, unknown>, authUid));
    }
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(this.auth, provider);
    const user = cred.user;

    const userRef = doc(this.db, `users/${user.uid}`);
    const existing = await getDoc(userRef);

    if (existing.exists()) {
      const data = existing.data() as { isBlocked?: boolean; profileImage?: string; profileImageUrl?: string };
      if (data.isBlocked) {
        await signOut(this.auth);
        throw new Error('Your account has been blocked. Please contact support.');
      }
      // Returning user: never touch role/fullName; only backfill a missing profile photo.
      if (!data.profileImage && !data.profileImageUrl && user.photoURL) {
        await updateDoc(userRef, { profileImage: user.photoURL, updatedAt: serverTimestamp() });
      }
    } else {
      await setDoc(userRef, {
        uid: user.uid,
        fullName: user.displayName || '',
        email: user.email || '',
        phone: user.phoneNumber || '',
        profileImage: user.photoURL || '',
        role: 'customer',
        isPhoneVerified: false,
        favoriteProductIds: [],
        authProvider: 'google',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const snapshot = await getDoc(userRef);
    this.applyProfile(docToAppUser(snapshot.data() as Record<string, unknown>, user.uid));
  }
}
