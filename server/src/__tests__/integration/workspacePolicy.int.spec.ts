// docs/branding.md
import { beforeEach, describe, expect, it } from 'vitest'
import { workspacePolicy } from '../../services/workspacePolicy.js'
import { addMember, resetDatabase, seedOrg, seedUser } from './helpers.js'

beforeEach(resetDatabase)

describe('workspace policy', () => {
  it('in solo mode allows one workspace per user and no invitations', async () => {
    const solo = workspacePolicy(false)
    const user = await seedUser({ email: 'solo@test.io' })
    const allow = solo.allowUserToCreateOrganization as (u: { id: string }) => Promise<boolean>
    expect(await allow(user)).toBe(true)
    await addMember((await seedOrg({ name: 'Personal' })).id, user.id, 'owner')
    expect(await allow(user)).toBe(false)
    expect(solo.invitationLimit).toBe(0)
  })

  it('in teams mode leaves creation and invitations open', () => {
    expect(workspacePolicy(true)).toEqual({
      allowUserToCreateOrganization: true,
      invitationLimit: 100,
    })
  })
})
