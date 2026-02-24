// Centralized tag definitions for Azure Vision content validation.
// Edit these lists to control what types of images are accepted for each upload type.

export const AVATAR_TAGS = [
    'logo',
    'icon',
    'badge',
    'symbol',
    'emblem',          // Great for shield-style logos
    'clipart',
    'illustration',
    'drawing',
    'cartoon',         // Critical for mascots/anime logos
    'vector',          // Usually indicates a clean digital file
    'graphic',         // Better than 'design'
    'text',            // Essential for letter-based logos (T1, G2)
    'font',
    'typography',
    'esports',
    'sports',
    'design'
];

export const AVATAR_TAG_THRESHOLD = 0.2

export const BANNER_TAGS = [
    // The Core Gaming Tags
    'esports',
    'video game',
    'game',
    'screenshot',       // <--- CRITICAL for gameplay images
    'software',         // Azure often tags UI/HUDs as software
    'multimedia',
    'entertainment',

    // The Art/Background Tags
    'abstract',
    'graphic',
    'design',           // Okay for banners (unlike logos) because backgrounds are generic
    'pattern',          // Good for abstract geometric backgrounds
    'digital art',
    'cg artwork',       // <--- CRITICAL for 3D renders/wallpapers
    'illustration',
    'poster',
    'banner',

    // The "League of Legends" Style Tags
    'fantasy',          // Covers magical backgrounds
    'fictional character', // Covers champions (Ahri, Yasuo, etc.)
    'mythology',        // Often used for LoL lore images
    'action',           // Fight scenes
    'darkness',         // Edgy/Dark theme backgrounds
    'light',            // Holy/Bright theme backgrounds

    // Text/Event Info
    'text',
    'typography',
    'tournament',
    'competition',
    'event'
];

export const BANNER_TAG_THRESHOLD = 0.4
