import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './auth.html',
})
export class AuthPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly mode: 'login' | 'register' =
    this.route.snapshot.data['mode'] === 'register' ? 'register' : 'login';
}
