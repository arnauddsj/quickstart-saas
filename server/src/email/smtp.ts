// docs/email.md
import nodemailer from 'nodemailer'
import { brand } from '../config/brand.js'
import { renderEmail } from './render.js'
import { templates, type TemplateData, type TemplateName } from './templates.js'
import type { EmailProvider } from './types.js'

export class SmtpProvider implements EmailProvider {
  private readonly transport: ReturnType<typeof nodemailer.createTransport>

  constructor(private readonly options: { host: string; port: number; from: string }) {
    this.transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: false,
    })
  }

  async send<K extends TemplateName>(template: K, to: string, data: TemplateData<K>) {
    const render = templates[template] as (d: TemplateData<K>) => ReturnType<(typeof templates)[K]>
    await this.transport.sendMail({
      from: { name: brand.name, address: this.options.from },
      to,
      ...renderEmail(render(data)),
    })
  }
}
