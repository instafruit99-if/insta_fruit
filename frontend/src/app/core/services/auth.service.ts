import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, onAuthStateChanged, User,  GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { Firestore, doc, setDoc, updateDoc, serverTimestamp, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import { AppUser } from '../models';

/** Normalize legacy Firestore field `profileImageUrl` (Google sign-in) into `profileImage`. */
function docToAppUser(raw: Record<string, unknown>): AppUser {
  const d = raw as unknown as AppUser & { profileImageUrl?: string };
  const profileImage = d.profileImage ?? d.profileImageUrl;
  return {
    ...d,
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

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this._user.set(user);
      if (user) this.loadProfile(user.uid);
      else { this._profile.set(null); this._loading.set(false); }
    });
  }

  private async loadProfile(uid: string): Promise<void> {
    try {
      const ref = doc(this.db, `users/${uid}`);
      const snapshot = await getDoc(ref);

      if (snapshot.exists()) {
        this._profile.set(docToAppUser(snapshot.data() as Record<string, unknown>));
        this.isAdmin.set((this._profile()?.role) === 'admin');
      } else {
        this._profile.set(null);
      }
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
            subscriber.next(docToAppUser(snapshot.data() as Record<string, unknown>));
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
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async signOutUser(): Promise<void> {
    await signOut(this.auth);
    await this.router.navigate(['/login']);
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  /** Phone OTP: send code. Pass an element id that holds the invisible reCAPTCHA. */
  async sendOtp(phoneE164: string, recaptchaContainerId: string): Promise<void> {
    const verifier = new RecaptchaVerifier(this.auth, recaptchaContainerId, { size: 'invisible' });
    this.confirmationResult = await signInWithPhoneNumber(this.auth, phoneE164, verifier);
  }

  /** Phone OTP: verify code. Creates user doc if first-time. */
  async verifyOtp(code: string, fullName = ''): Promise<void> {
    if (!this.confirmationResult) throw new Error('OTP not requested');
    const cred = await this.confirmationResult.confirm(code);
    const ref = doc(this.db, `users/${cred.user.uid}`);
    await setDoc(ref, {
      uid: cred.user.uid,
      fullName: fullName || cred.user.displayName || '',
      email: cred.user.email ?? '',
      phone: cred.user.phoneNumber ?? '',
      role: 'customer',
      isPhoneVerified: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  async updateProfile(uid: string, patch: Partial<AppUser>): Promise<void> {
    const ref = doc(this.db, `users/${uid}`);
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<AppUser>;
    await updateDoc(ref, { ...clean, updatedAt: serverTimestamp() });
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      this._profile.set(docToAppUser(snapshot.data() as Record<string, unknown>));
      this.isAdmin.set(this._profile()?.role === 'admin');
    }
  }

  async signInWithGoogle(): Promise<void> {

    const provider = new GoogleAuthProvider();

    const cred = await signInWithPopup(this.auth, provider);

    const user = cred.user;

    const userRef = doc(this.db, `users/${user.uid}`);

    await setDoc(userRef, {
      uid: user.uid,
      fullName: user.displayName || '',
      email: user.email || '',
      phone: user.phoneNumber || '',
      profileImage: user.photoURL || '',
      role: 'customer',
      isPhoneVerified: false,
      authProvider: 'google',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
}
