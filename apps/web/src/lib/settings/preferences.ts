import type { AppLocale } from '@/lib/i18n/dictionaries';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/dictionaries';

export const SETTINGS_PREFS_KEY = 'bries.settings.preferences';

export type DateFormatPref = 'd_mon_y';
export type TimeFormatPref = '12h' | '24h';
export type DisplayCurrencyPref = 'TZS';

export type SettingsPreferences = {
  businessName: string;
  tagline: string;
  currency: DisplayCurrencyPref;
  businessPhone: string;
  businessAddress: string;
  profilePhone: string;
  displayCurrency: DisplayCurrencyPref;
  dateFormat: DateFormatPref;
  timeFormat: TimeFormatPref;
  locale: AppLocale;
  /** Session-only previews are not persisted as file paths. */
};

export const DEFAULT_BUSINESS_NAME = "BRIE'S HOME & KITCHEN";
export const DEFAULT_TAGLINE = 'Quality for a Better Home';

export function defaultSettingsPreferences(locale: AppLocale = 'en'): SettingsPreferences {
  return {
    businessName: DEFAULT_BUSINESS_NAME,
    tagline: DEFAULT_TAGLINE,
    currency: 'TZS',
    businessPhone: '',
    businessAddress: '',
    profilePhone: '',
    displayCurrency: 'TZS',
    dateFormat: 'd_mon_y',
    timeFormat: '12h',
    locale,
  };
}

export function loadSettingsPreferences(): SettingsPreferences {
  const base = defaultSettingsPreferences();
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(SETTINGS_PREFS_KEY);
    if (!raw) {
      const localeRaw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (localeRaw === 'en' || localeRaw === 'sw') base.locale = localeRaw;
      return base;
    }
    const parsed = JSON.parse(raw) as Partial<SettingsPreferences>;
    return {
      ...base,
      ...parsed,
      businessName: parsed.businessName?.trim() || DEFAULT_BUSINESS_NAME,
      tagline: parsed.tagline?.trim() || DEFAULT_TAGLINE,
      currency: 'TZS',
      displayCurrency: 'TZS',
      dateFormat: 'd_mon_y',
      timeFormat: parsed.timeFormat === '24h' ? '24h' : '12h',
      locale: parsed.locale === 'sw' ? 'sw' : 'en',
    };
  } catch {
    return base;
  }
}

export function saveSettingsPreferences(prefs: SettingsPreferences): void {
  window.localStorage.setItem(SETTINGS_PREFS_KEY, JSON.stringify(prefs));
  window.localStorage.setItem(LOCALE_STORAGE_KEY, prefs.locale);
}
