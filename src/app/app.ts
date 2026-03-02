import { Component, inject, afterNextRender, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Navbar } from './shared/components/navbar/navbar';
import { StravaService } from './core/services/strava.service';

/**
 * Composant racine de l'application
 * Gère le callback OAuth et affiche la navbar + contenu
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Navbar],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      @if (strava.authenticated()) {
        <app-navbar />
      }
      <main class="animate-fade-in">
        <router-outlet />
      </main>

      <!-- Bandeau mise à jour PWA -->
      @if (updateAvailable()) {
        <div class="fixed bottom-0 left-0 right-0 bg-strava text-white text-center py-3 px-4 text-sm font-medium shadow-lg z-50 animate-fade-in">
          Nouvelle version disponible — mise à jour en cours...
        </div>
      }
    </div>
  `
})
export class App {
  protected readonly strava = inject(StravaService);
  private readonly router = inject(Router);
  private readonly swUpdate = inject(SwUpdate);
  protected readonly updateAvailable = signal(false);

  constructor() {
    afterNextRender(() => {
      this.handleOAuthCallback();
      this.checkForUpdates();
    });
  }

  private checkForUpdates(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates.subscribe(event => {
      if (event.type === 'VERSION_READY') {
        this.updateAvailable.set(true);
        setTimeout(() => {
          document.location.reload();
        }, 2000);
      }
    });
  }

  private async handleOAuthCallback(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    // Nettoyer l'URL (supprimer ?code=... et &scope=...)
    window.history.replaceState({}, '', window.location.pathname);

    const success = await this.strava.handleOAuthCallback(code);
    if (success) {
      this.router.navigate(['/dashboard']);
    }
  }
}
