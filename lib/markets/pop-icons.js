// Map pop_stamp_types.icon string → lucide-react component.
import {
  Apple, Hand, ShoppingBag, Music, Smile, Sparkles, Star, Heart, Leaf,
  Cookie, Carrot, Cherry, Coffee, Bike, Sun, Cloud,
} from 'lucide-react'

const MAP = {
  Apple, Hand, ShoppingBag, Music, Smile, Sparkles, Star, Heart, Leaf,
  Cookie, Carrot, Cherry, Coffee, Bike, Sun, Cloud,
}

export function iconFor(name) {
  return MAP[name] || Sparkles
}

// Deterministic colour from a string (used for child avatars when no avatar_url).
export function colorFromString(s = '') {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffff
  const palette = ['#7B9E5C', '#E2A93C', '#9C7BAA', '#C46B3A', '#5B7BA0', '#C2647F', '#7A8DA1', '#B68660']
  return palette[Math.abs(h) % palette.length]
}
