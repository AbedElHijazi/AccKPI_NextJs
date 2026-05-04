/** Server clears session and redirects to /login */
export function logout() {
  if (typeof window === 'undefined') return;
  window.location.assign('/api/auth/logout');
}
