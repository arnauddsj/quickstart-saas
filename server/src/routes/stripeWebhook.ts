// docs/billing.md
import type { FastifyInstance } from 'fastify'
import type Stripe from 'stripe'
import { env } from '../config/env.js'
import { reportError } from '../services/reportError.js'
import { applyStripeSubscription, stripe } from '../services/stripe.js'

export async function stripeWebhookRoutes(app: FastifyInstance) {
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) =>
    done(null, body),
  )

  app.post('/webhooks/stripe', async (request, reply) => {
    const signature = request.headers['stripe-signature']
    if (typeof signature !== 'string' || !Buffer.isBuffer(request.body)) {
      return reply.status(400).send({ error: 'missing signature' })
    }
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(request.body, signature, env.STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      return reply
        .status(400)
        .send({ error: err instanceof Error ? err.message : 'invalid signature' })
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object
          if (typeof session.subscription === 'string') {
            const sub = await stripe.subscriptions.retrieve(session.subscription)
            await applyStripeSubscription(sub)
          }
          break
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await applyStripeSubscription(event.data.object)
          break
      }
    } catch (err) {
      reportError({
        severity: 'ERROR',
        type: 'stripe.webhook',
        message: 'Failed to apply Stripe event',
        error: err,
        fingerprint: [event.type],
        context: { eventId: event.id, eventType: event.type },
      })
      return reply.status(500).send({ received: false })
    }
    return { received: true }
  })
}
