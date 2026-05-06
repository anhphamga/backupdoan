const normalizeOrigin = (value = '') => String(value || '').trim().replace(/\/+$/, '')

const parseAllowedOrigins = (raw = '') =>
  String(raw || '')
    .split(',')
    .map((item) => normalizeOrigin(item))
    .filter(Boolean)

export const isGoogleOriginAllowed = () => {
  if (typeof window === 'undefined') return false

  const origin = normalizeOrigin(window.location.origin)
  const allowedFromEnv = parseAllowedOrigins(import.meta.env.VITE_GOOGLE_ALLOWED_ORIGINS)

  if (allowedFromEnv.length > 0) {
    return allowedFromEnv.includes(origin)
  }

  // Safe default: allow localhost/dev, and require explicit allowlist in production deployments.
  return (
    origin.startsWith('http://localhost')
    || origin.startsWith('http://127.0.0.1')
    || origin.startsWith('http://0.0.0.0')
  )
}

