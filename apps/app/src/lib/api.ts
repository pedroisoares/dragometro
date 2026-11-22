import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Endereço da API do Dragômetro (apps/api), vindo de EXPO_PUBLIC_API_URL no `.env`.
 *
 * No celular, "localhost" seria o próprio celular. Então, se o `.env` aponta para
 * localhost, trocamos pelo IP do computador que está servindo o app (o mesmo do
 * QR Code do Expo). Assim o mesmo `.env` funciona no navegador e no celular.
 */
export function urlDaApi(): string | undefined {
  const configurada = process.env.EXPO_PUBLIC_API_URL;
  if (!configurada) return undefined;
  if (Platform.OS === 'web') return configurada;

  const hostDoExpo = Constants.expoConfig?.hostUri?.split(':')[0];
  if (hostDoExpo && /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configurada)) {
    return configurada.replace(/\/\/(localhost|127\.0\.0\.1)/, `//${hostDoExpo}`);
  }
  return configurada;
}
