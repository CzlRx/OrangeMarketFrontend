const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1583394838336-acd977736f90?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?q=80&w=900&auto=format&fit=crop',
]

export const HERO_IMAGE =
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=1600&auto=format&fit=crop'

function hashCode(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export function productImage(product?: { id?: string; name?: string; images?: string[] }, index = 0) {
  if (product?.images?.length) {
    return product.images[index % product.images.length]
  }
  const seed = hashCode(`${product?.id ?? ''}-${product?.name ?? ''}`)
  return FALLBACK_IMAGES[seed % FALLBACK_IMAGES.length]
}
