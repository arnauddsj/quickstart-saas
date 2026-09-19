// docs/email.md
import { brand } from '../config/brand.js'
import type { EmailContent } from './templates.js'

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

export function renderEmail(content: EmailContent): {
  subject: string
  html: string
  text: string
} {
  const p = (s: string, style = '') =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#27272a;${style}">${escape(s)}</p>`
  const action = content.action
    ? `<p style="margin:24px 0"><a href="${escape(content.action.url)}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:${brand.accentColor};color:#ffffff;font-weight:600;text-decoration:none">${escape(content.action.label)}</a></p>`
    : ''
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px;background:#ffffff;border-radius:8px">
<p style="margin:0 0 24px;font-weight:700;color:#18181b">${escape(brand.name)}</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#18181b">${escape(content.heading)}</h1>
${content.paragraphs.map((s) => p(s)).join('\n')}
${action}
${content.footnote ? p(content.footnote, 'font-size:13px;color:#71717a') : ''}
</div>
<p style="max-width:520px;margin:16px auto 0;font-size:12px;color:#a1a1aa;text-align:center">${escape(brand.name)} · ${escape(brand.supportEmail)}</p>
</body></html>`

  const text = [
    content.heading,
    '',
    ...content.paragraphs,
    ...(content.action ? ['', `${content.action.label}: ${content.action.url}`] : []),
    ...(content.footnote ? ['', content.footnote] : []),
    '',
    `${brand.name} · ${brand.supportEmail}`,
  ].join('\n')

  return { subject: content.subject, html, text }
}
