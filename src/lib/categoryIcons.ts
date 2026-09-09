import {
  Camera,
  Gamepad2,
  Headphones,
  Home as HomeIcon,
  Laptop,
  Package,
  Shirt,
  Smartphone,
  Speaker,
  Watch,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Laptop,
  Smartphone,
  Headphones,
  Watch,
  Speaker,
  Camera,
  Gamepad2,
  Shirt,
  Home: HomeIcon,
}

export function categoryIcon(icon?: string): LucideIcon {
  return (icon && CATEGORY_ICONS[icon]) || Package
}
