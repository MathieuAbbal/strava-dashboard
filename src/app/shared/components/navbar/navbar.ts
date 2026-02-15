import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Barre de navigation principale
 * Liens vers Dashboard, Activités et Carte
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="bg-orange-600 text-white shadow-lg">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex items-center justify-between h-16">
          <!-- Logo / Titre -->
          <a routerLink="/" class="flex items-center gap-2 text-xl font-bold">
            <span class="text-2xl">🏃</span>
            <span>Strava Dashboard</span>
          </a>

          <!-- Liens de navigation -->
          <div class="flex gap-1">
            <a routerLink="/dashboard"
               routerLinkActive="bg-orange-700"
               class="px-4 py-2 rounded-lg hover:bg-orange-500 transition-colors">
              Dashboard
            </a>
            <a routerLink="/activities"
               routerLinkActive="bg-orange-700"
               class="px-4 py-2 rounded-lg hover:bg-orange-500 transition-colors">
              Activités
            </a>
            <a routerLink="/map"
               routerLinkActive="bg-orange-700"
               class="px-4 py-2 rounded-lg hover:bg-orange-500 transition-colors">
              Carte
            </a>
          </div>
        </div>
      </div>
    </nav>
  `
})
export class Navbar {}
