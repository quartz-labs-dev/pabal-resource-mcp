/**
 * Site data type definitions
 * Structure for public/site/ directory
 * - contacts.json: Contact information
 * - locales/en-US.json: Localized content (meta, hero, developer)
 */

export interface SiteData {
  meta: {
    title: string;
    description: string;
  };
  hero: {
    brand: string;
    tagline: string;
    subtitle: string;
  };
  contacts: { id: string; label: string; icon: string; value: string }[];
  developer: {
    name: string;
    heading: string;
    role: string;
    bio: string;
    principles: string[];
    stack: string[];
    now: string;
    availability: string;
    likes: string[];
    location?: string;
    timezone?: string;
    visited: {
      countries: {
        code: string;
        name: string;
        flagEmoji: string;
        cities: string[];
      }[];
    };
  };
}
