export const DISPLAY_NAME_MIN_LENGTH = 3;
export const DISPLAY_NAME_MAX_LENGTH = 24;
export const DISPLAY_NAME_COOLDOWN_DAYS = 30;

const RESERVED_WORDS = new Set([
  'admin',
  'administrador',
  'administradora',
  'moderacao',
  'moderador',
  'moderadora',
  'oficial',
  'somostopo',
  'suporte',
  'topo',
]);

const BUILT_IN_BLOCKLIST = Object.freeze([
  'arrombada',
  'arrombado',
  'baitola',
  'bicha',
  'bichona',
  'boiola',
  'bosta',
  'buceta',
  'caralho',
  'corno',
  'cuzao',
  'desgracada',
  'desgracado',
  'estuprador',
  'fdp',
  'filha da puta',
  'filhadaputa',
  'filho da puta',
  'filhodaputa',
  'foda se',
  'foder',
  'hitler',
  'nazista',
  'piranha',
  'porra',
  'puta',
  'puto',
  'retardada',
  'retardado',
  'traveco',
  'vagabunda',
  'vagabundo',
  'viado',
]);

export function foldProfileName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function leetFold(value) {
  return foldProfileName(value)
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't');
}

function configuredBlocklist(value) {
  return String(value || '')
    .split(',')
    .map((term) => foldProfileName(term))
    .filter(Boolean);
}

function includesBlockedTerm(value, extraBlocklist) {
  const candidates = [...new Set([foldProfileName(value), leetFold(value)])];
  const terms = [...BUILT_IN_BLOCKLIST, ...configuredBlocklist(extraBlocklist)]
    .map((term) => foldProfileName(term))
    .filter(Boolean);

  return candidates.some((candidate) => {
    const words = candidate.split(' ').filter(Boolean);
    const padded = ` ${candidate} `;
    const compact = words.join('');

    return terms.some((term) => {
      const compactTerm = term.replace(/\s+/g, '');
      if (term.includes(' ')) {
        return padded.includes(` ${term} `) || compact.includes(compactTerm);
      }
      return (
        words.includes(term) || compact === term || (term.length >= 5 && compact.includes(term))
      );
    });
  });
}

function includesReservedIdentity(value) {
  const folded = foldProfileName(value);
  const words = folded.split(' ').filter(Boolean);
  const compact = words.join('');
  if (words.some((word) => RESERVED_WORDS.has(word))) return true;
  return /^(?:admin|administrador|moderador|suporte|somostopo|topooficial|equipetopo)\d*$/.test(
    compact,
  );
}

export function validateDisplayName(value, extraBlocklist = '') {
  if (typeof value !== 'string') return { error: 'required' };
  const displayName = value
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const length = [...displayName].length;

  if (length < DISPLAY_NAME_MIN_LENGTH || length > DISPLAY_NAME_MAX_LENGTH) {
    return { error: 'length' };
  }
  if (
    !/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .'’\-]*[\p{L}\p{M}\p{N}]$/u.test(displayName) ||
    !/[\p{L}]/u.test(displayName)
  ) {
    return { error: 'characters' };
  }
  if (/@|https?:|www\.|\b[a-z0-9-]+\.(?:com|net|org|br)\b/i.test(displayName)) {
    return { error: 'contact' };
  }
  if (/(.)\1{3,}/iu.test(displayName)) return { error: 'repeated' };
  if (includesReservedIdentity(displayName)) return { error: 'reserved' };
  if (includesBlockedTerm(displayName, extraBlocklist)) return { error: 'offensive' };

  return { value: displayName };
}

export function defaultDisplayName(userId) {
  const suffix =
    String(userId || '')
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 4)
      .toUpperCase() || '0000';
  return `Pessoa do TOPO ${suffix}`;
}

export function displayNameChangeState(updatedAt, now = new Date()) {
  if (!updatedAt) return { canChange: true, availableAt: null };
  const changedAt = new Date(updatedAt);
  if (!Number.isFinite(changedAt.getTime())) return { canChange: true, availableAt: null };
  const availableAt = new Date(
    changedAt.getTime() + DISPLAY_NAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  );
  return {
    canChange: availableAt.getTime() <= now.getTime(),
    availableAt: availableAt.toISOString(),
  };
}
