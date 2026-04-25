import { API_BASE_URL } from '../config/env'

const toText = (value) => String(value ?? '').trim()

const API_ORIGIN = toText(API_BASE_URL).replace(/\/api\/?$/i, '')

const isLocalhostUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\b/i.test(url)

const safeEncodeUrl = (url) => (url.includes(' ') ? encodeURI(url) : url)

export const normalizeImageUrl = (value) => {
  const raw = toText(value)
  if (!raw) return ''

  if (raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw
  }

  if (raw.startsWith('//')) {
    return safeEncodeUrl(`https:${raw}`)
  }

  if (raw.startsWith('/')) {
    return safeEncodeUrl(`${API_ORIGIN}${raw}`)
  }

  if (/^https?:\/\//i.test(raw)) {
    if (raw.startsWith('http://') && !isLocalhostUrl(raw)) {
      return safeEncodeUrl(`https://${raw.slice('http://'.length)}`)
    }
    return safeEncodeUrl(raw)
  }

  // Relative path (e.g. "uploads/..." or "images/...")
  return safeEncodeUrl(`${API_ORIGIN}/${raw}`)
}

const pushAll = (target, value) => {
  if (Array.isArray(value)) {
    value.forEach((item) => target.push(item))
    return
  }
  if (value) {
    target.push(value)
  }
}

export const getProductPrimaryImageUrl = (product = {}) => {
  const candidates = []

  pushAll(candidates, product?.image)
  pushAll(candidates, product?.imageUrl)
  pushAll(candidates, product?.thumbnail)
  pushAll(candidates, product?.images)

  const colorVariants = Array.isArray(product?.colorVariants) ? product.colorVariants : []
  colorVariants.forEach((variant) => pushAll(candidates, variant?.images))

  const variants = Array.isArray(product?.variants) ? product.variants : []
  variants.forEach((variant) => pushAll(candidates, variant?.images))

  return candidates.map(normalizeImageUrl).find(Boolean) || ''
}

