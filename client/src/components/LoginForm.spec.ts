import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginForm from './LoginForm.vue'

describe('LoginForm', () => {
  it('emits submit with the typed email', async () => {
    const wrapper = mount(LoginForm)
    await wrapper.find('input[type="email"]').setValue('jane@example.com')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([['jane@example.com']])
  })

  it('disables the button while pending', () => {
    const wrapper = mount(LoginForm, { props: { pending: true } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
