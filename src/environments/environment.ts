/**
 * Configuration de l'environnement
 *
 * Obtenir un token : https://www.strava.com/settings/api
 */
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
