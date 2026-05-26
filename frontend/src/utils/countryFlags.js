const COUNTRY_FLAGS = {
  'US': '🇺🇸', 'GB': '🇬🇧', 'FR': '🇫🇷', 'DE': '🇩🇪', 'IT': '🇮🇹',
  'ES': '🇪🇸', 'NL': '🇳🇱', 'BE': '🇧🇪', 'CH': '🇨🇭', 'AT': '🇦🇹',
  'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'PL': '🇵🇱',
  'CZ': '🇨🇿', 'HU': '🇭🇺', 'RO': '🇷🇴', 'GR': '🇬🇷', 'PT': '🇵🇹',
  'JP': '🇯🇵', 'KR': '🇰🇷', 'CN': '🇨🇳', 'IN': '🇮🇳', 'TH': '🇹🇭',
  'VN': '🇻🇳', 'ID': '🇮🇩', 'MY': '🇲🇾', 'SG': '🇸🇬', 'PH': '🇵🇭',
  'BN': '🇧🇳', 'KH': '🇰🇭', 'LA': '🇱🇦', 'MM': '🇲🇲', 'BD': '🇧🇩',
  'PK': '🇵🇰', 'NP': '🇳🇵', 'LK': '🇱🇰', 'AU': '🇦🇺', 'NZ': '🇳🇿',
  'CA': '🇨🇦', 'MX': '🇲🇽', 'BR': '🇧🇷', 'AR': '🇦🇷', 'CL': '🇨🇱',
  'CO': '🇨🇴', 'PE': '🇵🇪', 'ZA': '🇿🇦', 'EG': '🇪🇬', 'KE': '🇰🇪',
  'NG': '🇳🇬', 'AE': '🇦🇪', 'SA': '🇸🇦', 'IL': '🇮🇱', 'TR': '🇹🇷',
};

export function getCountryFlag(countryCode) {
  return COUNTRY_FLAGS[countryCode?.toUpperCase()] || '🌍';
}

export function isValidCountryCode(code) {
  return !!(code && code.length === 2 && code.toUpperCase() in COUNTRY_FLAGS);
}
