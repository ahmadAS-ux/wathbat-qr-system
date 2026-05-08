const DEFAULT_PASSWORDS = new Set<string>([
  'admin123',
  'password',
  '12345678',
  'admin',
  'wathbah',
  'password123',
]);

export function isDefaultPassword(password: string): boolean {
  return DEFAULT_PASSWORDS.has(password);
}
