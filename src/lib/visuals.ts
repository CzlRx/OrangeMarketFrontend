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

function bannerImage(prompt: string) {
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=landscape_16_9`
}

export interface BannerSlide {
  image: string
  eyebrow: string
  title: string
  description: string
  to: string
}

export const BANNER_SLIDES: BannerSlide[] = [
  {
    image: bannerImage(
      'wide e-commerce hero banner, premium orange wireless headphones floating on clean warm gradient studio background, soft shadows, minimal modern commercial photography, negative space on left side',
    ),
    eyebrow: 'NEW ARRIVAL',
    title: '声色俱佳，一戴倾心',
    description: '新潮数码焕新上架，畅享纯净音质',
    to: '/catalog',
  },
  {
    image: bannerImage(
      'wide e-commerce hero banner, minimalist scandinavian home living scene with ceramic vase and warm morning light, clean beige tones, commercial interior photography, negative space on left side',
    ),
    eyebrow: 'HOME LIVING',
    title: '家居好物，治愈日常',
    description: '精选生活百货，让家更有温度',
    to: '/catalog',
  },
  {
    image: bannerImage(
      'wide e-commerce hero banner, smart watch and smartphone on bright clean gradient background, tech gadgets flat lay, modern minimal commercial product photography, negative space on left side',
    ),
    eyebrow: 'SMART TECH',
    title: '智能装备，效率升级',
    description: '爆款数码限时特惠，低至 7 折',
    to: '/catalog',
  },
]

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
