import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class AuthPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder).nonNullable;

  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data,
  });

  protected readonly mode = computed<'login' | 'register'>(() =>
    this.routeData()['mode'] === 'register' ? 'register' : 'login'
  );

  protected readonly authError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);

  protected readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected readonly registerForm = this.fb.group({
    name: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(60)],
    ],
    email: ['', [Validators.required, Validators.email]],
    semester: ['2026/27/1', [Validators.required, Validators.maxLength(20)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected clearError(): void {
    if (this.authError()) {
      this.authError.set(null);
    }
  }

  protected async submitLogin(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    this.authError.set(null);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.authError.set('Add meg az e-mail címed és a jelszavad.');
      return;
    }

    this.submitting.set(true);
    try {
      const { email, password } = this.loginForm.getRawValue();
      const result = await this.auth.login(email, password);

      if (!result.ok) {
        this.authError.set(result.error ?? 'Sikertelen bejelentkezés.');
        return;
      }

      await this.router.navigateByUrl('/app/dashboard');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async submitRegister(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    this.authError.set(null);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.authError.set('Ellenőrizd a megadott mezőket.');
      return;
    }

    const raw = this.registerForm.getRawValue();
    if (raw.password !== raw.confirmPassword) {
      this.authError.set('A két megadott jelszó nem egyezik.');
      return;
    }

    this.submitting.set(true);
    try {
      const result = await this.auth.register({
        name: raw.name,
        email: raw.email,
        password: raw.password,
        semester: raw.semester,
      });

      if (!result.ok) {
        this.authError.set(result.error ?? 'A regisztráció nem sikerült.');
        return;
      }

      await this.router.navigateByUrl('/app/dashboard');
    } finally {
      this.submitting.set(false);
    }
  }

  protected launchDemo(): void {
    this.auth.enterDemoMode();
    void this.router.navigateByUrl('/app/dashboard');
  }

  protected hasFieldError(
    form: 'login' | 'register',
    controlName: string
  ): boolean {
    const control =
      form === 'login'
        ? this.loginForm.get(controlName)
        : this.registerForm.get(controlName);
    return Boolean(control && control.invalid && control.touched);
  }
}
