export type AppLocale = 'en' | 'sw';

export const DEFAULT_LOCALE: AppLocale = 'en';

export const LOCALE_STORAGE_KEY = 'bries.locale';

type Dictionary = Record<string, string>;

const en: Dictionary = {
  'settings.title': 'Settings',
  'settings.subtitle': 'Manage your business and account preferences.',
  'settings.business.title': 'Business Information',
  'settings.business.subtitle': 'Update your business details and branding.',
  'settings.business.name': 'Business Name',
  'settings.business.tagline': 'Tagline / Slogan',
  'settings.business.currency': 'Currency',
  'settings.business.phone': 'Business Phone',
  'settings.business.address': 'Business Address',
  'settings.branding.title': 'Branding',
  'settings.branding.subtitle': 'Update your logo and profile photo.',
  'settings.branding.changeLogo': 'Change Logo',
  'settings.branding.remove': 'Remove',
  'settings.branding.logoHint':
    'Use a PNG or SVG file. Recommended size: 512 × 512 pixels.',
  'settings.profile.title': 'User Profile',
  'settings.profile.subtitle': 'Update your personal information.',
  'settings.profile.fullName': 'Full Name',
  'settings.profile.email': 'Email Address',
  'settings.profile.phone': 'Phone Number',
  'settings.profile.role': 'Role',
  'settings.profile.photo': 'Profile Photo (Optional)',
  'settings.profile.changePhoto': 'Change Photo',
  'settings.profile.removePhoto': 'Remove',
  'settings.profile.photoHint':
    'Use a PNG or JPG file. Recommended size: 256 × 256 pixels.',
  'settings.profile.roleOwner': 'Owner',
  'settings.preferences.title': 'Preferences',
  'settings.preferences.subtitle': 'Set your personal and system preferences.',
  'settings.preferences.displayCurrency': 'Display Currency',
  'settings.preferences.dateFormat': 'Date Format',
  'settings.preferences.timeFormat': 'Time Format',
  'settings.preferences.language': 'Language',
  'settings.preferences.currencyTzs': 'TZS (Tanzanian Shilling)',
  'settings.preferences.dateExample': '24 Sep 2026',
  'settings.preferences.time12': '12 Hour (4:26 PM)',
  'settings.preferences.time24': '24 Hour (16:26)',
  'settings.preferences.langEn': 'English',
  'settings.preferences.langSw': 'Swahili',
  'settings.save': 'Save Changes',
  'settings.saved': 'Settings saved',
  'settings.saveFailed': 'Unable to save settings. Please try again.',
};

const sw: Dictionary = {
  'settings.title': 'Mipangilio',
  'settings.subtitle': 'Dhibiti taarifa za biashara na mapendeleo ya akaunti yako.',
  'settings.business.title': 'Taarifa za Biashara',
  'settings.business.subtitle': 'Sasisha taarifa za biashara na chapa yako.',
  'settings.business.name': 'Jina la Biashara',
  'settings.business.tagline': 'Kauli mbiu',
  'settings.business.currency': 'Sarafu',
  'settings.business.phone': 'Simu ya Biashara',
  'settings.business.address': 'Anwani ya Biashara',
  'settings.branding.title': 'Chapa',
  'settings.branding.subtitle': 'Sasisha nembo na picha ya wasifu.',
  'settings.branding.changeLogo': 'Badilisha Nembo',
  'settings.branding.remove': 'Ondoa',
  'settings.branding.logoHint':
    'Tumia faili ya PNG au SVG. Ukubwa unaopendekezwa: 512 × 512 pixels.',
  'settings.profile.title': 'Wasifu wa Mtumiaji',
  'settings.profile.subtitle': 'Sasisha taarifa zako binafsi.',
  'settings.profile.fullName': 'Jina Kamili',
  'settings.profile.email': 'Barua Pepe',
  'settings.profile.phone': 'Nambari ya Simu',
  'settings.profile.role': 'Wadhifa',
  'settings.profile.photo': 'Picha ya Wasifu (Si lazima)',
  'settings.profile.changePhoto': 'Badilisha Picha',
  'settings.profile.removePhoto': 'Ondoa',
  'settings.profile.photoHint':
    'Tumia faili ya PNG au JPG. Ukubwa unaopendekezwa: 256 × 256 pixels.',
  'settings.profile.roleOwner': 'Mmiliki',
  'settings.preferences.title': 'Mapendeleo',
  'settings.preferences.subtitle': 'Weka mapendeleo yako binafsi na ya mfumo.',
  'settings.preferences.displayCurrency': 'Sarafu ya Kuonyesha',
  'settings.preferences.dateFormat': 'Muundo wa Tarehe',
  'settings.preferences.timeFormat': 'Muundo wa Saa',
  'settings.preferences.language': 'Lugha',
  'settings.preferences.currencyTzs': 'TZS (Shilingi ya Tanzania)',
  'settings.preferences.dateExample': '24 Sep 2026',
  'settings.preferences.time12': 'Saa 12 (4:26 PM)',
  'settings.preferences.time24': 'Saa 24 (16:26)',
  'settings.preferences.langEn': 'English',
  'settings.preferences.langSw': 'Swahili',
  'settings.save': 'Hifadhi Mabadiliko',
  'settings.saved': 'Mipangilio imehifadhiwa',
  'settings.saveFailed': 'Imeshindikana kuhifadhi mipangilio. Jaribu tena.',
};

export const dictionaries: Record<AppLocale, Dictionary> = { en, sw };

export type TranslationKey = keyof typeof en;

export function translate(locale: AppLocale, key: string): string {
  return dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
}
