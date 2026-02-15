# Strava Dashboard

Dashboard Angular pour visualiser vos activites Strava avec graphiques et cartes interactives.

## Stack technique

- **Angular 21** - Standalone components, Signals, Zoneless
- **Chart.js** - Graphiques (barres km/semaine, camembert par type)
- **MapLibre GL JS** - Cartes interactives des traces GPS
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

## Pages

### Dashboard (`/dashboard`)
- Cards statistiques : nombre d'activites, km total, denivele, temps
- Graphique en barres : kilometres par semaine (12 dernieres semaines)
- Camembert : repartition par type d'activite

### Activites (`/activities`)
- Liste des activites avec icone, distance, duree, denivele
- Filtres par type d'activite et plage de dates
- Clic sur une activite pour voir le detail

### Detail activite (`/activities/:id`)
- Statistiques detaillees (allure, FC, calories...)
- Carte MapLibre avec le trace GPS complet

### Carte globale (`/map`)
- Toutes les activites superposees sur une carte
- Couleur par type : rouge (course), bleu (velo), cyan (natation), vert (rando)

## Structure du projet

```
src/app/
├── core/
│   ├── models/strava.models.ts    # Interfaces TypeScript
│   ├── services/strava.service.ts # Appels API + refresh auto
│   └── utils/
│       ├── format.ts              # Formatage (km, duree, couleurs)
│       └── polyline.ts            # Decodeur polyline Google
├── features/
│   ├── dashboard/dashboard.ts     # Page dashboard + Chart.js
│   ├── activities/
│   │   ├── activity-list.ts       # Liste filtrable
│   │   └── activity-detail.ts     # Detail + carte MapLibre
│   └── maps/global-map.ts        # Carte globale
└── shared/components/
    └── navbar/navbar.ts           # Navigation
```

## API Strava utilisees

| Endpoint | Description |
|----------|-------------|
| `GET /athlete` | Profil de l'athlete |
| `GET /athlete/activities` | Liste des activites (pagine) |
| `GET /activities/:id` | Detail avec trace GPS |
| `GET /athletes/:id/stats` | Statistiques globales |
