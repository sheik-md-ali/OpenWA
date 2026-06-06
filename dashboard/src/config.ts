function deriveApiOrigin(): string {
  const configuredOrigin = import.meta.env.VITE_API_ORIGIN as string | undefined;
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, '');
  }

  if (window.location.hostname.startsWith('whatsapp.')) {
    const apiHostname = `whatsapp-api.${window.location.hostname.slice('whatsapp.'.length)}`;
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${window.location.protocol}//${apiHostname}${port}`;
  }

  return window.location.origin;
}

export const API_ORIGIN = deriveApiOrigin();
export const API_BASE_URL = `${API_ORIGIN}/api`;
export const SOCKET_URL = (import.meta.env.VITE_WS_URL as string | undefined) || API_ORIGIN;
