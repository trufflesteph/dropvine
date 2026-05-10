// Neutral fallback constants for the white-label PWA — used ONLY when both the
// database and the operator have not provided a value. The intent is for these
// to look obviously generic (greyscale) so a fresh deployment immediately
// signals "you need to configure this".
//
// Every actual rendered colour should come from market_config via either:
//   - the MarketConfigContext  (useMarketConfig() on the client)
//   - the CSS custom properties injected by MarketProviders
//      (--market-primary, --market-accent, --market-bg)
//   - the dynamic /manifest.webmanifest endpoint

export const MARKET_NEUTRAL_DEFAULTS = {
  // Neutral so it's obvious the operator hasn't picked a colour yet.
  primary_color: '#1F1F1E',
  accent_color: '#8C8579',
  pwa_theme_color: '#1F1F1E',
  pwa_background_color: '#FAFAF7',

  // Geometry / counts — left null on purpose so the admin shows a placeholder
  // rather than a misleading default like "12 booths".
  map_booth_count: null,
}

// Generic placeholder strings shown inside empty admin inputs. Crafted to be
// agnostic to any specific market.
export const MARKET_INPUT_PLACEHOLDERS = {
  street_name: 'e.g. Main Street',
  cross_street_start: 'e.g. 1st Ave',
  cross_street_end: 'e.g. 4th Ave',
  venmo_handle: 'your-farm-name',
  instagram_handle: '@yourfarm',
}
