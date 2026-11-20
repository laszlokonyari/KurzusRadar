import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const workspaceGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ensureInitialized();

  if (auth.hasWorkspaceAccess()) {
    return true;
  }

  return router.createUrlTree(['/']);
};

export const guestOnlyAuthGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ensureInitialized();

  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/app/dashboard']);
  }

  return true;
};
