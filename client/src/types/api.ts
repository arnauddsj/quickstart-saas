import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from 'server/router'

export type RouterOutputs = inferRouterOutputs<AppRouter>
export type Me = RouterOutputs['user']['me']
export type CurrentOrg = RouterOutputs['org']['current']
export type OrgMember = RouterOutputs['org']['members'][number]
export type OrgInvitation = RouterOutputs['org']['invitations'][number]
export type Subscription = RouterOutputs['billing']['getSubscription']
export type AdminUser = RouterOutputs['admin']['listUsers']['users'][number]
export type AdminOrganization = RouterOutputs['admin']['listOrganizations'][number]
export type DataExport = RouterOutputs['user']['exportData']
export type AdminStats = RouterOutputs['admin']['stats']
export type Project = RouterOutputs['project']['list']['projects'][number]
export type AppNotification = RouterOutputs['notification']['list']['items'][number]
export type ProductAnalytics = RouterOutputs['admin']['analytics']
