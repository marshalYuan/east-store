import { createStore } from '../'
import React from 'react'

import renderer, { act, ReactTestRenderer } from 'react-test-renderer'

describe('sharedStore', () => {
  const sharedStore = createStore(0, {
    increase: () => count => count + 1,
    decrease: n => count => count - n
  })

  const Com1: React.FC = () => {
    const [count, action] = sharedStore.useStore()
    const handleDecrease = () => {
      action.decrease(3)
    }
    return (
      <div>
        <span>{count}</span>
        <button id="increase-btn" onClick={action.increase}>
          increase
        </button>
        <button id="decrease-btn" onClick={handleDecrease}>
          decrease
        </button>
      </div>
    )
  }

  const Com2: React.FC = () => {
    const [count, _] = sharedStore.useStore()
    return (
      <div>
        <span id="count">{count}</span>
      </div>
    )
  }

  const App: React.FC = () => {
    return (
      <div>
        <Com1 />
        <Com2 />
      </div>
    )
  }

  test('shared between 2 component', () => {
    let component = {} as ReactTestRenderer
    // wrapper create for ensuring 'useEfect' be called
    act(() => {
      component = renderer.create(<App />)
    })
    let tree = component.toJSON()
    expect(tree).toMatchSnapshot()

    for (let i = 0; i < 10; i++) {
      // increse 1
      act(component.root.findByProps({ id: 'increase-btn' }).props.onClick)
      expect(component.root.findByProps({ id: 'count' }).children[0]).toBe(
        (i + 1).toString()
      )
    }

    let increaseTree = component.toJSON()
    expect(increaseTree).toMatchSnapshot()

    act(component.root.findByProps({ id: 'decrease-btn' }).props.onClick)
    expect(component.toJSON()).toMatchSnapshot()

    component.unmount()

    // recreate
    act(() => {
      component = renderer.create(<App />)
    })
    // reset shared value after all components been unmounted
    expect(component.root.findByProps({ id: 'count' }).children[0]).toBe('7')
    expect(component.toJSON()).toMatchSnapshot()
  })
})
