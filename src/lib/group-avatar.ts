function hashSeed(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }

  return hash;
}

export function getGroupAvatarLabel(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return '?';
  }

  if (words.length === 1) {
    return words[0].slice(0, 1).toUpperCase();
  }

  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

export function getGroupAvatarStyle(seed: string | number) {
  const hue = hashSeed(String(seed));
  const startHue = 210 + (hue % 20);
  const endHue = 222 + (hue % 14);

  return {
    background: `linear-gradient(135deg, hsl(${startHue} 88% 58%) 0%, hsl(${endHue} 78% 28%) 100%)`
  };
}
