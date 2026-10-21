// Where to go after signing in. Only same-site paths are accepted, so a crafted
// /login?next=https://evil.example link cannot bounce someone to another site.
export function safeNext(value) {
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) {
    return value;
  }
  return '/dashboard';
}
