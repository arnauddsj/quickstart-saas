import { describe, expect, it, vi } from 'vitest'
import { brand } from '../config/brand.js'
import { createEmailProvider, parseLoopsTemplateIds } from '../email/index.js'
import { LoopsProvider } from '../email/loops.js'
import { renderEmail } from '../email/render.js'
import { SmtpProvider } from '../email/smtp.js'
import { TEMPLATE_NAMES, templates } from '../email/templates.js'

const smtpEnv = {
  EMAIL_PROVIDER: 'smtp' as const,
  EMAIL_FROM: 'noreply@localhost',
  SMTP_HOST: 'localhost',
  SMTP_PORT: 1025,
  LOOPS_API_KEY: undefined,
  LOOPS_TEMPLATE_IDS: undefined,
}

describe('createEmailProvider', () => {
  it('selects SMTP', () => {
    expect(createEmailProvider(smtpEnv)).toBeInstanceOf(SmtpProvider)
  })

  it('selects Loops when configured and refuses when not', () => {
    expect(
      createEmailProvider({
        ...smtpEnv,
        EMAIL_PROVIDER: 'loops',
        LOOPS_API_KEY: 'k',
        LOOPS_TEMPLATE_IDS: 'magicLink=t',
      }),
    ).toBeInstanceOf(LoopsProvider)
    expect(() => createEmailProvider({ ...smtpEnv, EMAIL_PROVIDER: 'loops' })).toThrow(
      /LOOPS_API_KEY/,
    )
  })
})

describe('parseLoopsTemplateIds', () => {
  it('maps template names to ids and rejects unknown names', () => {
    expect(parseLoopsTemplateIds('magicLink=a, invitation = b')).toEqual({
      magicLink: 'a',
      invitation: 'b',
    })
    expect(() => parseLoopsTemplateIds('magicLnk=a')).toThrow(/magicLnk=a/)
  })
})

describe('LoopsProvider', () => {
  it('posts the template data as variables and throws on a non-2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }))
    const provider = new LoopsProvider({
      apiKey: 'k',
      templateIds: { magicLink: 'tpl' },
      fetchImpl,
    })
    await expect(provider.send('magicLink', 'a@b.test', { url: 'http://x' })).rejects.toThrow(/401/)
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      transactionalId: 'tpl',
      email: 'a@b.test',
      dataVariables: { url: 'http://x' },
    })
  })

  it('refuses a template without an id', async () => {
    const provider = new LoopsProvider({ apiKey: 'k', templateIds: { magicLink: 'tpl' } })
    await expect(
      provider.send('invitation', 'a@b.test', {
        url: 'u',
        organizationName: 'Org',
        inviterEmail: 'i@b.test',
      }),
    ).rejects.toThrow(/invitation/)
  })
})

describe('templates', () => {
  const sample = {
    url: 'https://app.test/x?token=1&a=2',
    newEmail: 'new@test.io',
    organizationName: '<script>alert(1)</script>',
    inviterEmail: 'i@test.io',
  }

  it.each(TEMPLATE_NAMES)('%s renders branded html and text with its link', (name) => {
    const render = templates[name] as (d: typeof sample) => Parameters<typeof renderEmail>[0]
    const { subject, html, text } = renderEmail(render(sample))
    expect(subject).toBeTruthy()
    expect(html).toContain(brand.name)
    expect(html).toContain('https://app.test/x?token=1&amp;a=2')
    expect(text).toContain('https://app.test/x?token=1&a=2')
    expect(html).not.toContain('<script>')
  })
})
