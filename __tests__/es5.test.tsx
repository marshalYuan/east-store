import React from 'react'
import renderer, { act, ReactTestRenderer } from 'react-test-renderer'
test('compatible es5', () => {
  let originMap = global.Map
  let originSet = global.Set
  let g = global as any
  g.Map = undefined
  g.Set = undefined
  g.Proxy = undefined
  const { createStore } = require('../')
  // react-test-render need Set, Map
  g.Set = originSet
  g.Map = originMap

  const AtomicStore = createStore(0, {
    increase: () => (count: number) => count + 1
  })

  const A: React.FC = () => {
    const [count, actions] = AtomicStore.useStore()
    return <div id="count">{count}</div>
  }

  let a = {} as ReactTestRenderer
  act(() => {
    a = renderer.create(<A />)
  })

  act(AtomicStore.getActions().increase)

  expect(a.root.findByProps({ id: 'count' }).children[0]).toBe('1')

  const B: React.FC = () => {
    const [count, actions] = AtomicStore.useStore()
    return <div>{count}</div>
  }

  let b = {} as ReactTestRenderer
  act(() => {
    b = renderer.create(<B />)
  })

  expect(AtomicStore.length).toBe(2)
})
