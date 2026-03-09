const RFC1918 = [
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^127\./,
];

export function validateIP(ip) {
  if (!ip?.trim()) return { valid: false, message: 'IP requerida' };
  const t = ip.trim();
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(t))
    return { valid: false, message: 'Formato inválido (ej: 192.168.1.1)' };
  const octs = t.split('.').map(Number);
  if (octs.some(o => o < 0 || o > 255))
    return { valid: false, message: 'Octetos deben ser 0-255' };
  if (!RFC1918.some(p => p.test(t)))
    return { valid: false, message: 'Solo IPs privadas RFC1918 (192.168.x.x / 10.x.x.x / 172.16-31.x.x)' };
  return { valid: true, message: '' };
}
