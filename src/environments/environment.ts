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
    clientId: '166994',
    clientSecret: '0a96d93dc3c7d23aa25562690e84fd830718bdec',
    accessToken: 'e44e2e323800f3530c6b8c70c1b4cbe129028ce6',
    refreshToken: '0b63786f5db6b0992541b0137769f627a4418009'
  }
};
