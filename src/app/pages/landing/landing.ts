import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.html',
})
export class LandingPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected launchDemo(): void {
    this.auth.enterDemoMode();
    this.router.navigateByUrl('/app/dashboard');
  }
}
