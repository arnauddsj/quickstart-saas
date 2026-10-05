// docs/branding.md
import { brand } from 'server/brand'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export { brand }

export const workspace = {
  one: brand.workspace.one,
  many: brand.workspace.many,
  One: capitalize(brand.workspace.one),
  Many: capitalize(brand.workspace.many),
}
