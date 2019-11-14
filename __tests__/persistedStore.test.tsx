import { createStore, IPersistedStorage } from '../'
import React from 'react'

import renderer, { act, ReactTestRenderer } from 'react-test-renderer'

describe('persistedStore', () => {
  // jest.useFakeTimers()

  test('persist store after unmount', () => {
    const persistedStore = createStore(
      0,
      {
        increase: () => count => count + 1,
        decrease: n => count => count - n
      },
      { persist: true }
    )

    const Com1: React.FC = () => {
      const [count, action] = persistedStore.useStore()
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
      const [count, _] = persistedStore.useStore()
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

    let component = {} as ReactTestRenderer
    act(() => {
      component = renderer.create(<App />)
    })
    expect(component.toJSON()).toMatchSnapshot()

    act(component.root.findByProps({ id: 'increase-btn' }).props.onClick)
    // shared
    expect(component.root.findByProps({ id: 'count' }).children[0]).toBe('1')
    expect(component.toJSON()).toMatchSnapshot()

    component.unmount()

    // recreate
    act(() => {
      component = renderer.create(<App />)
    })
    expect(component.root.findByProps({ id: 'count' }).children[0]).toBe('1')
    expect(component.toJSON()).toMatchSnapshot()
  })

  test('use custom storage', () => {
    const m = new Map()
    const g = jest.fn((name: string): string => {
      return name
    })
    const set = jest.fn((key: string, val: number) => {
      return m.set(key, val)
    })
    const get = jest.fn((key: string): number => {
      return m.get(key)
    })
    const myStorage = {
      generateKey: g,
      set,
      get
    }
    const NAME = 'FooStore'
    const store = createStore(
      0,
      {
        increase: () => count => count + 1
      },
      { persist: myStorage, name: NAME }
    )

    const Counter: React.FC = () => {
      const [count, action] = store.useStore()
      return (
        <div>
          <span id="count">{count}</span>
          <button id="increase-btn" onClick={action.increase}>
            increase
          </button>
        </div>
      )
    }

    let component = {} as ReactTestRenderer
    act(() => {
      component = renderer.create(<Counter />)
    })
    expect(component.toJSON()).toMatchSnapshot()

    expect(g).toBeCalledWith(NAME)
    expect(get).toBeCalledWith(NAME)

    act(component.root.findByProps({ id: 'increase-btn' }).props.onClick)

    expect(set).toBeCalledTimes(1)
    expect(set).toBeCalledWith(NAME, 1)
    expect(m.get(NAME)).toBe(1)
  })

  test('store value after all components unmount', async () => {
    const m = new Map()
    const g = jest.fn((name: string): string => {
      return name
    })
    const set = jest.fn((key: string, val: number) => {
      return m.set(key, val)
    })
    const get = jest.fn((key: string): number => {
      return m.get(key)
    })
    const myStorage = {
      generateKey: g,
      set,
      get
    }
    const NAME = 'FooStore'
    const fakeAction = jest.fn(async count => {
      await new Promise(r => setTimeout(r, 100))
      return count + 1
    })
    const store = createStore(
      0,
      {
        delayIncrease: () => fakeAction
      },
      { persist: myStorage, name: NAME }
    )

    const Counter: React.FC = () => {
      const [count, action] = store.useStore()
      return (
        <div>
          <span id="count">{count}</span>
          <button id="increase-btn" onClick={action.delayIncrease}>
            increase
          </button>
        </div>
      )
    }

    let component = {} as ReactTestRenderer
    act(() => {
      component = renderer.create(<Counter />)
    })
    expect(component.toJSON()).toMatchSnapshot()
    act(component.root.findByProps({ id: 'increase-btn' }).props.onClick)
    expect(fakeAction).toBeCalled()
    expect(set).toBeCalledTimes(0)

    component.unmount()
    // jest.runAllTimers()

    await new Promise(r => setTimeout(r, 200))

    expect(set).toBeCalledTimes(1)
    expect(set).toBeCalledWith(NAME, 1)
  })
})
