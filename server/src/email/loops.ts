// docs/email.md
import type { TemplateData, TemplateName } from './templates.js'
import type { EmailProvider } from './types.js'

export class LoopsProvider implements EmailProvider {
  constructor(
    private readonly options: {
      apiKey: string
      templateIds: Partial<Record<TemplateName, string>>
      fetchImpl?: typeof fetch
    },
  ) {}

  async send<K extends TemplateName>(template: K, to: string, data: TemplateData<K>) {
    const transactionalId = this.options.templateIds[template]
    if (!transactionalId) throw new Error(`LOOPS_TEMPLATE_IDS has no id for ${template}`)
    const fetchImpl = this.options.fetchImpl ?? fetch
    const res = await fetchImpl('https://app.loops.so/api/v1/transactional', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transactionalId, email: to, dataVariables: data }),
    })
    if (!res.ok) {
      throw new Error(`Loops responded ${res.status}: ${await res.text()}`)
    }
  }
}
