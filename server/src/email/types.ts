// docs/email.md
import type { TemplateData, TemplateName } from './templates.js'

export interface EmailProvider {
  send<K extends TemplateName>(template: K, to: string, data: TemplateData<K>): Promise<void>
}
