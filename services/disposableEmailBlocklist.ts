/**
 * Disposable Email Blocklist Service
 * 
 * Blocks signups from disposable/temporary email providers
 * to prevent free trial abuse.
 */

// Common disposable email domains - comprehensive list
const DISPOSABLE_EMAIL_DOMAINS = new Set([
    // Popular disposable services
    '10minutemail.com',
    '10minutemail.net',
    '10minmail.com',
    'tempmail.com',
    'temp-mail.org',
    'guerrillamail.com',
    'guerrillamail.info',
    'guerrillamail.net',
    'guerrillamail.org',
    'mailinator.com',
    'maildrop.cc',
    'throwaway.email',
    'throwawaymail.com',
    'trashmail.com',
    'trashmail.net',
    'fakeinbox.com',
    'getnada.com',
    'yopmail.com',
    'yopmail.fr',
    'mohmal.com',
    'tempail.com',
    'tempr.email',
    'discard.email',
    'discardmail.com',
    'spamgourmet.com',
    'mailnesia.com',
    'sharklasers.com',
    'grr.la',
    'guerrillamail.de',
    'spam4.me',
    'mytrashmail.com',
    'mt2009.com',
    'purcell.email',
    'maildrop.cc',
    'mintemail.com',
    'spamavert.com',
    'tempmailaddress.com',
    'emailondeck.com',
    'fakemail.net',
    'getairmail.com',
    'mailcatch.com',
    'mailnull.com',
    'mailzilla.com',
    'nowmymail.com',
    'spamex.com',
    'spamfree24.org',
    'tempinbox.com',
    'tmpmail.org',
    'tmpmail.net',
    'wegwerfmail.de',
    'wegwerfmail.net',
    'wegwerfmail.org',
    'zoemail.org',
    'zoho.com', // Not disposable but often abused for multi-accounts

    // Indian specific
    'email.co.in',
    'tempmail.co.in',
    'fakemailgenerator.com',

    // Additional common ones
    'burnermail.io',
    'hide.biz.st',
    'dropmail.me',
    'emkei.cz',
    'emailfake.com',
    'fakemailgenerator.net',
    'generator.email',
    'harakirimail.com',
    'inbox.ru',
    'mail.ru', // Often abused
    'jetable.org',
    'jourrapide.com',
    'kasmail.com',
    'link2mail.net',
    'mail-temporaire.fr',
    'mailfence.com',
    'mailnator.com',
    'mailsac.com',
    'meltmail.com',
    'moakt.com',
    'nada.email',
    'nomail.xl.cx',
    'protonmail.com', // Privacy focused, sometimes abused
    'shortemail.com',
    'spambox.us',
    'tempomail.fr',
    'throwam.com',
    'tmail.ws',
    'trash-mail.at',
    'trashmail.ws',
    'mailseal.de',
    'randommail.net',

    // New additions 2024
    'emailfake.today',
    'tempym.com',
    'guerrillamail.biz',
    'anonymmail.net',
    'burnmail.io',
    'fakemailnow.com',
    'inboxkitten.com',
    'mailsac.com',
    'mailslurp.com',
]);

// Patterns that indicate disposable emails
const DISPOSABLE_PATTERNS = [
    /^temp/i,
    /^fake/i,
    /^garbage/i,
    /^trash/i,
    /^junk/i,
    /^disposable/i,
    /^throwaway/i,
    /^burner/i,
    /10min/i,
    /minute.*mail/i,
    /mail.*temp/i,
];

/**
 * Check if an email address is from a disposable provider
 */
export function isDisposableEmail(email: string): boolean {
    if (!email) return false;

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;

    // Check exact domain match
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
        return true;
    }

    // Check for subdomain abuse (e.g., user.mailinator.com)
    const domainParts = domain.split('.');
    if (domainParts.length > 2) {
        const baseDomain = domainParts.slice(-2).join('.');
        if (DISPOSABLE_EMAIL_DOMAINS.has(baseDomain)) {
            return true;
        }
    }

    // Check patterns in email or domain
    const localPart = email.split('@')[0]?.toLowerCase();
    for (const pattern of DISPOSABLE_PATTERNS) {
        if (pattern.test(localPart) || pattern.test(domain)) {
            return true;
        }
    }

    return false;
}

/**
 * Get a user-friendly error message for disposable email
 */
export function getDisposableEmailError(): string {
    return 'Please use your personal email address. Temporary/disposable email services are not supported.';
}

/**
 * Validate email format (basic check)
 */
export function isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Full email validation - format + disposable check
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
    if (!email) {
        return { valid: false, error: 'Email is required' };
    }

    if (!isValidEmailFormat(email)) {
        return { valid: false, error: 'Invalid email format' };
    }

    if (isDisposableEmail(email)) {
        return { valid: false, error: getDisposableEmailError() };
    }

    return { valid: true };
}
