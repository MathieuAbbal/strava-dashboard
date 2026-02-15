import { Component, inject, afterNextRender } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
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
    </div>
  `
})
export class App {
  protected readonly strava = inject(StravaService);
  private readonly router = inject(Router);

  constructor() {
    afterNextRender(() => {
      this.handleOAuthCallback();
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
