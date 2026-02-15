import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/components/navbar/navbar';

/**
 * Composant racine de l'application
 * Affiche la navbar et le contenu de la route active
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Navbar],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <app-navbar />
      <main class="animate-fade-in">
        <router-outlet />
      </main>
    </div>
  `
})
export class App {}
