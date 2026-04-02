export function allowedEmailDomain(): string {
  return (process.env.ALLOWED_EMAIL_DOMAIN || '@kpcqa.or.kr').trim()
}

export function isEmailDomainAllowed(email: string): boolean {
  const d = allowedEmailDomain()
  if (!d.startsWith('@')) return email.toLowerCase().endsWith(d.toLowerCase())
  return email.toLowerCase().endsWith(d.toLowerCase())
}
