import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AcademicStoreService } from './services/academic-store.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly store = inject(AcademicStoreService);
  protected readonly mobileMenuOpen = signal(false);
  protected readonly resetFeedback = signal(false);

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

  protected handleResetDemo(): void {
    this.store.resetToDemoData();
    this.resetFeedback.set(true);
    setTimeout(() => {
      this.resetFeedback.set(false);
    }, 1800);
  }
}
