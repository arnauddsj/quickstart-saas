import { describe, expect, it, vi } from 'vitest'
import { createEmailProvider } from '../email/index.js'
import { LoopsProvider } from '../email/loops.js'
import { SmtpProvider } from '../email/smtp.js'

const smtpEnv = {
  EMAIL_PROVIDER: 'smtp' as const,
  EMAIL_FROM: 'noreply@localhost',
  SMTP_HOST: 'localhost',
  SMTP_PORT: 1025,
  LOOPS_API_KEY: undefined,
  LOOPS_MAGIC_LINK_TEMPLATE_ID: undefined,
  LOOPS_INVITATION_TEMPLATE_ID: undefined,
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
        LOOPS_MAGIC_LINK_TEMPLATE_ID: 't',
      }),
    ).toBeInstanceOf(LoopsProvider)
    expect(() => createEmailProvider({ ...smtpEnv, EMAIL_PROVIDER: 'loops' })).toThrow(
      /LOOPS_API_KEY/,
    )
  })
})

describe('LoopsProvider', () => {
  it('posts the transactional payload and throws on a non-2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }))
    const provider = new LoopsProvider({ apiKey: 'k', magicLinkTemplateId: 'tpl', fetchImpl })
    await expect(provider.sendMagicLink({ to: 'a@b.test', url: 'http://x' })).rejects.toThrow(/401/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      transactionalId: 'tpl',
      email: 'a@b.test',
      dataVariables: { url: 'http://x' },
    })
  })

  it('refuses invitations without a template id', async () => {
    const provider = new LoopsProvider({ apiKey: 'k', magicLinkTemplateId: 'tpl' })
    await expect(
      provider.sendInvitation({
        to: 'a@b.test',
        url: 'u',
        organizationName: 'Org',
        inviterEmail: 'i@b.test',
      }),
    ).rejects.toThrow(/LOOPS_INVITATION_TEMPLATE_ID/)
  })
})
