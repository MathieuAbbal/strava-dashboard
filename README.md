# Strava Dashboard

Dashboard Angular pour visualiser vos activites Strava avec graphiques, cartes interactives et analyse detaillee.

## Demo

Deploye automatiquement sur GitHub Pages : **https://mathieuabbal.github.io/strava-dashboard/**

## Stack technique

- **Angular 21** - Standalone components, Signals, Zoneless
- **Chart.js** - Graphiques (barres km/semaine, camembert, analyse altitude/FC/vitesse)
- **MapLibre GL JS** - Cartes interactives des traces GPS avec effet heatmap
- **Tailwind CSS v4** - Styling utilitaire

## Installation

```bash
npm install
```

## Configuration Strava

1. Creer une application sur [strava.com/settings/api](https://www.strava.com/settings/api)
2. Configurer le **Authorization Callback Domain** : `localhost`
3. Autoriser l'application avec les bons scopes :

```
https://www.strava.com/oauth/authorize?client_id=VOTRE_CLIENT_ID&response_type=code&redirect_uri=http://localhost&scope=read,activity:read_all,profile:read_all&approval_prompt=force
```

4. Recuperer le code dans l'URL de redirection et l'echanger :

```bash
curl -X POST https://www.strava.com/oauth/token \
  -d client_id=VOTRE_CLIENT_ID \
  -d client_secret=VOTRE_SECRET \
  -d code=LE_CODE \
  -d grant_type=authorization_code
```

5. Renseigner les tokens dans `src/environments/environment.ts` :

```typescript
export const environment = {
  production: false,
  strava: {
    apiUrl: '/api/v3',
    oauthUrl: '/oauth/token',
    clientId: 'VOTRE_CLIENT_ID',
    clientSecret: 'VOTRE_SECRET',
    accessToken: 'VOTRE_ACCESS_TOKEN',
    refreshToken: 'VOTRE_REFRESH_TOKEN'
  }
};
```

> Le refresh du token est automatique : le service detecte les expirations et renouvelle le token de maniere transparente.

## Lancement

```bash
npm start
```

L'application est disponible sur [http://localhost:4200](http://localhost:4200)

## Deploiement GitHub Pages

Le deploiement est automatique via GitHub Actions a chaque push sur `main`.

Pour activer :
1. Sur GitHub, aller dans **Settings > Pages > Source** et selectionner **GitHub Actions**
2. Pousser sur `main` — le workflow build et deploie automatiquement

Le build de production utilise `environment.production.ts` avec les URLs directes vers l'API Strava (pas de proxy).

## Pages

### Dashboard (`/dashboard`)
- Cards statistiques : nombre d'activites, km total, denivele, temps
- Graphique en barres : kilometres par semaine/mois/annee
- Camembert : repartition par type d'activite
- Vue par jour et comparaison annuelle

### Activites (`/activities`)
- Liste des activites avec icone, distance, duree, denivele
- Filtres par type d'activite et plage de dates
- Clic sur une activite pour voir le detail

### Detail activite (`/activities/:id`)
- Statistiques detaillees (allure, FC, calories, splits...)
- Carte MapLibre avec le trace GPS complet
- Graphique d'analyse : altitude en fond + overlays FC, vitesse/allure, cadence
  - Lissage par moyenne glissante
  - Bandes verticales par metrique (comme Strava)
- Tableau des splits/laps

### Progression (`/progression`)
- Suivi de la progression sur la duree
- Statistiques comparatives

### Carte globale (`/map`)
- Toutes les activites superposees sur une carte avec effet heatmap
- Filtres par type d'activite (Course, Velo, Rando, Natation...)
- Filtres par periode (Tout, 12 mois, 6 mois, 3 mois)
- Popup au survol avec resume de l'activite
- Clic pour acceder au detail

### Navbar
- Navigation responsive : icones sur mobile, texte sur desktop
- Profil athlete avec dropdown (photo, stats globales)

## Structure du projet

```
src/
├── environments/
│   ├── environment.ts                # Config dev (proxy local)
│   └── environment.production.ts     # Config prod (URLs directes Strava)
├── app/
│   ├── core/
│   │   ├── models/strava.models.ts   # Interfaces TypeScript
│   │   ├── services/strava.service.ts # Appels API + refresh auto
│   │   └── utils/
│   │       ├── format.ts             # Formatage (km, duree, couleurs, traductions)
│   │       └── polyline.ts           # Decodeur polyline Google
│   ├── features/
│   │   ├── dashboard/dashboard.ts    # Dashboard + Chart.js
│   │   ├── activities/
│   │   │   ├── activity-list.ts      # Liste filtrable
│   │   │   └── activity-detail.ts    # Detail + carte + analyse
│   │   ├── progression/progression.ts # Suivi progression
│   │   └── maps/global-map.ts        # Carte globale heatmap
│   └── shared/components/
│       └── navbar/navbar.ts          # Navigation + profil athlete
└── .github/workflows/
    └── deploy.yml                    # CI/CD GitHub Pages
```

## API Strava utilisees

| Endpoint | Description |
|----------|-------------|
| `GET /athlete` | Profil de l'athlete |
| `GET /athlete/activities` | Liste des activites (pagine) |
| `GET /activities/:id` | Detail avec trace GPS |
| `GET /activities/:id/streams` | Streams (altitude, FC, vitesse, cadence) |
| `GET /activities/:id/laps` | Splits / laps |
| `GET /athletes/:id/stats` | Statistiques globales |
