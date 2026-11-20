import { Component, computed, inject, signal } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AcademicStoreService } from '../../services/academic-store.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-workspace-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './workspace-shell.html',
  styleUrl: './workspace-shell.css',
})
export class WorkspaceShell {
  protected readonly store = inject(AcademicStoreService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mobileMenuOpen = signal(false);
  protected readonly confirmClearOpen = signal(false);
  protected readonly actionFeedback = signal<string | null>(null);

  protected readonly activeSemester = computed(
    () => this.auth.currentUser()?.semester ?? '2026/27/1'
  );

  protected readonly conflictSummaryState = computed<
    'critical' | 'warning' | 'clear'
  >(() => {
    if (this.store.criticalConflicts().length > 0) {
      return 'critical';
    }
    if (this.store.warningConflicts().length > 0) {
      return 'warning';
    }
    return 'clear';
  });

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  protected requestClearWorkspace(): void {
    this.confirmClearOpen.set(true);
  }

  protected cancelClearWorkspace(): void {
    this.confirmClearOpen.set(false);
  }

  protected confirmClearWorkspace(): void {
    this.store.clearAllData();
    this.confirmClearOpen.set(false);
    this.showFeedback('Munkaterület kiürítve');
  }

  protected handleResetDemo(): void {
    this.store.resetToDemoData();
    this.confirmClearOpen.set(false);
    this.showFeedback('Demó adatok visszaállítva');
  }

  protected handleExitSession(): void {
    this.auth.logout();
    this.closeMobileMenu();
    this.router.navigateByUrl('/');
  }

  protected goToRegisterFromDemo(): void {
    this.auth.logout();
    this.closeMobileMenu();
    this.router.navigateByUrl('/auth/register');
  }

  private showFeedback(message: string): void {
    this.actionFeedback.set(message);
    setTimeout(() => {
      if (this.actionFeedback() === message) {
        this.actionFeedback.set(null);
      }
    }, 2200);
  }
}
