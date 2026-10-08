// Editable homepage copy (site_config keys read by app/page.js).
//
// HOME_COPY_DEFAULTS is the text the homepage shows when a key is missing or
// empty, so the page never renders a blank. It matches the rows inserted by
// scripts/one-off/2026-10-homepage-site-config.sql; change both together.
// Edited in /admin/direct/settings.

export const HOME_COPY_DEFAULTS = {
  // Hero
  home_hero_eyebrow: 'For cottage bakers',
  home_hero_headline_1: 'You bake.',
  home_hero_headline_2: 'Dropvine handles the selling.',
  home_hero_subtext: 'No more taking orders through DMs. Fill out one form and Dropvine builds your order page, emails your customers, and keeps every order in one place.',
  home_hero_cta: 'Start your 30-day free trial',
  home_hero_note: 'Dropvine never takes a cut of your sales. No card needed to start.',

  // Pricing
  home_pricing_headline: 'Try it free for 30 days.',
  home_pricing_subtext: 'Your trial includes everything in Shop. No card needed.',
  home_tier_maker_price: '$10',
  home_tier_maker_period: '/ month',
  home_tier_maker_tagline: 'For bakers who sell every week.',
  home_tier_maker_features: [
    'Unlimited drops',
    'All five ways to sell',
    'Custom sales page for every drop',
    'Automatic emails to your list',
    'Order list, stock limits, and sold-out alerts',
    'Dropvine badge',
  ].join('\n'),
  home_tier_shop_price: '$24',
  home_tier_shop_period: '/ month',
  home_tier_shop_tagline: 'For bakers building a following.',
  home_tier_shop_features: [
    'Everything in Maker',
    'Your own shop page, always on, even between drops',
    'Automatic emails + texts (coming soon)',
    'Follow button to organically grow your list',
    'Customer reviews',
    'No Dropvine badge',
  ].join('\n'),
  home_tier_premium_price: '$455',
  home_tier_premium_period: '/ year',
  home_tier_premium_tagline: 'For bakers who want it done with them.',
  home_tier_premium_features: [
    'Everything in Shop',
    'Help setting up your first drop',
    'A direct line to me, plus a monthly check-in',
    'Monthly product photo touch-ups',
    'A featured spot on Dropvine each month',
  ].join('\n'),

  // Premium Shop Annual
  home_premium_badge: 'Launch pricing · 25 spots',
  home_premium_original_price: '$650',
  home_premium_deadline_note: 'Launch pricing through Dec 31.',

  // Final call to action
  home_final_headline: 'Spend your week baking, not answering messages.',
  home_final_cta: 'Start your 30-day free trial',
}

export const HOME_COPY_KEYS = Object.keys(HOME_COPY_DEFAULTS)

// { key: value } from site_config → every key resolved, falling back to the
// default when the stored value is missing or blank.
export function resolveHomeCopy(values = {}) {
  const copy = {}
  for (const key of HOME_COPY_KEYS) {
    const v = typeof values[key] === 'string' ? values[key].trim() : ''
    copy[key] = v || HOME_COPY_DEFAULTS[key]
  }
  return copy
}

// A *_features value → its non-blank lines, trimmed.
export function featureLines(text) {
  return String(text || '').split('\n').map((line) => line.trim()).filter(Boolean)
}
