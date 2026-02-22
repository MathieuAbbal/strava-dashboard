# Strava Dashboard

Dashboard Angular pour visualiser vos activites Strava avec graphiques, cartes interactives et analyse detaillee.

## Stack technique

- **Angular 21** - Standalone components, Signals, Zoneless
- **Chart.js** - Graphiques (barres km/semaine, camembert, analyse altitude/FC/vitesse)
- **MapLibre GL JS** - Cartes interactives des traces GPS avec effet heatmap
- **Tailwind CSS v4** - Styling utilitaire

## Installation

```bash
git clone https://github.com/MathieuAbbal/strava-dashboard.git
cd strava-dashboard
npm install
```

## Configuration Strava

Chaque developpeur doit creer sa propre application Strava pour obtenir ses propres cles API.

### 1. Creer une application Strava

1. Connectez-vous sur [strava.com](https://www.strava.com)
2. Allez sur [strava.com/settings/api](https://www.strava.com/settings/api)
3. Remplissez le formulaire :
   - **Application Name** : le nom de votre choix
   - **Category** : Autre
   - **Website** : votre URL (ou laisser vide)
   - **Authorization Callback Domain** : `localhost`
4. Notez votre **Client ID** et **Client Secret**

### 2. Obtenir vos tokens

Ouvrez cette URL dans votre navigateur (remplacez `VOTRE_CLIENT_ID`) :

```
https://www.strava.com/oauth/authorize?client_id=VOTRE_CLIENT_ID&response_type=code&redirect_uri=http://localhost&scope=read,activity:read_all,profile:read_all&approval_prompt=force
```

Autorisez l'application. Vous serez redirige vers une URL du type :

```
http://localhost/?state=&code=VOTRE_CODE&scope=read,activity:read_all,profile:read_all
```

Copiez le `code` et echangez-le contre des tokens :

```bash
curl -X POST https://www.strava.com/oauth/token \
  -d client_id=VOTRE_CLIENT_ID \
  -d client_secret=VOTRE_SECRET \
  -d code=VOTRE_CODE \
  -d grant_type=authorization_code
```

La reponse contient `access_token`, `refresh_token` et `expires_at`.

### 3. Configurer l'environnement local

Creez ou modifiez le fichier `src/environments/environment.ts` :

```typescript
export const environment = {
  production: false,
  strava: {
    apiUrl: '/api/v3',
    oauthUrl: '/oauth/token',
    redirectUri: 'http://localhost:4200',
    clientId: 'VOTRE_CLIENT_ID',
    clientSecret: 'VOTRE_CLIENT_SECRET',
    accessToken: 'VOTRE_ACCESS_TOKEN',
    refreshToken: 'VOTRE_REFRESH_TOKEN'
  }
};
```

> **Important** : ne commitez jamais vos tokens personnels. Le fichier `environment.ts` contient vos identifiants prives.

> Le refresh du token est automatique : le service detecte les expirations et renouvelle le token de maniere transparente.

## Lancement

```bash
npm start
```

L'application est disponible sur [http://localhost:4200](http://localhost:4200)

## Deploiement GitHub Pages (optionnel)

Si vous forkez le projet et souhaitez le deployer sur votre propre GitHub Pages :

### 1. Configurer l'environnement de production

Modifiez `src/environments/environment.production.ts` avec vos propres cles :

```typescript
export const environment = {
  production: true,
  strava: {
    apiUrl: 'https://www.strava.com/api/v3',
    oauthUrl: 'https://www.strava.com/oauth/token',
    redirectUri: 'https://VOTRE_USER.github.io/strava-dashboard/',
    clientId: 'VOTRE_CLIENT_ID',
    clientSecret: 'VOTRE_CLIENT_SECRET',
    accessToken: '',
    refreshToken: ''
  }
};
```

### 2. Configurer Strava pour la production

Sur [strava.com/settings/api](https://www.strava.com/settings/api), changez le **Authorization Callback Domain** :

```
localhost  →  VOTRE_USER.github.io
```

### 3. Activer GitHub Pages

1. Sur GitHub, allez dans **Settings > Pages > Source** et selectionnez **Deploy from a branch**
2. Selectionnez la branche **gh-pages** / **/ (root)**
3. Poussez sur `main` — le workflow build et deploie automatiquement

En production, l'authentification se fait via OAuth : l'utilisateur clique "Se connecter avec Strava" et autorise l'application. Les tokens sont stockes dans le localStorage du navigateur.

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
│   ├── environment.ts                # Config dev (proxy local) — vos cles ici
│   └── environment.production.ts     # Config prod (URLs directes Strava)
├── app/
│   ├── core/
│   │   ├── models/strava.models.ts   # Interfaces TypeScript
│   │   ├── guards/auth.guard.ts      # Protection des routes (redirection login)
│   │   ├── services/strava.service.ts # Appels API + OAuth + refresh auto
│   │   └── utils/
│   │       ├── format.ts             # Formatage (km, duree, couleurs, traductions)
│   │       └── polyline.ts           # Decodeur polyline Google
│   ├── features/
│   │   ├── auth/login.ts             # Page de connexion OAuth
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
| `POST /oauth/token` | Echange code / refresh token |
| `GET /athlete` | Profil de l'athlete |
| `GET /athlete/activities` | Liste des activites (pagine) |
| `GET /activities/:id` | Detail avec trace GPS |
| `GET /activities/:id/streams` | Streams (altitude, FC, vitesse, cadence) |
| `GET /activities/:id/laps` | Splits / laps |
| `GET /athletes/:id/stats` | Statistiques globales |
