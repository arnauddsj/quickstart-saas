// docs/testing.md
/* eslint-disable vue/one-component-per-file -- one tiny stub per overlay component, used only by specs */
import { defineComponent, h } from 'vue'

const passthrough = (name: string) =>
  defineComponent({
    name,
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  })

const openable = (name: string) =>
  defineComponent({
    name,
    props: { open: { type: Boolean, default: false } },
    setup:
      (props, { slots }) =>
      () =>
        props.open ? h('div', slots.default?.()) : null,
  })

const selectable = defineComponent({
  name: 'DropdownMenuItem',
  emits: ['select'],
  setup:
    (_, { slots, emit }) =>
    () =>
      h(
        'button',
        { type: 'button', 'data-menu-item': '', onClick: () => emit('select') },
        slots.default?.(),
      ),
})

export const overlayStubs = {
  Dialog: openable('Dialog'),
  DialogContent: passthrough('DialogContent'),
  DialogHeader: passthrough('DialogHeader'),
  DialogTitle: passthrough('DialogTitle'),
  DialogDescription: passthrough('DialogDescription'),
  DialogFooter: passthrough('DialogFooter'),
  DropdownMenu: passthrough('DropdownMenu'),
  DropdownMenuTrigger: passthrough('DropdownMenuTrigger'),
  DropdownMenuContent: passthrough('DropdownMenuContent'),
  DropdownMenuSeparator: passthrough('DropdownMenuSeparator'),
  DropdownMenuItem: selectable,
}
