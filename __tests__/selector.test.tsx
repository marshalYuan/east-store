import { createStore } from '../'
import React, { useCallback, useState } from 'react'

import renderer, { act, ReactTestRenderer } from 'react-test-renderer'

function createComplexStore() {
  return createStore(
    {
      foo: 1,
      bar: 'bar',
      baz: {
        a: 100,
        b: 1
      }
    },
    {
      setFoo: (n: number) => state => {
        state.foo = n
      },
      setBar: (s: string) => state => {
        state.bar = s
      },
      setBazA: (a: number) => state => {
        state.baz.a = a
      },
      setBaz: (baz: { a: number; b: number }) => state => {
        state.baz = baz
      }
    }
  )
}

describe('selector', () => {
  test('base', () => {
    const complex = createComplexStore()
    const Com1: React.FC = () => {
      const [n, _] = complex.useStore(s => s.baz.a + s.foo)
      return <div id="number">{n}</div>
    }

    const e1 = renderer.create(<Com1 />)
    expect(e1.root.findByProps({ id: 'number' }).children[0]).toBe('101')
  })

  test('dispatch action', () => {
    const complex = createComplexStore()
    const renderSentinal = jest.fn()
    const Com2: React.FC = () => {
      const [n, _] = complex.useStore(s => s.baz.a + s.foo)
      renderSentinal()
      return <div>{n}</div>
    }

    let component = {} as ReactTestRenderer
    act(() => {
      component = renderer.create(<Com2 />)
    })
    expect(renderSentinal).toBeCalledTimes(1)
    act(() => {
      complex.getActions().setBar('hello') // not trigger render
    })
    expect(renderSentinal).toBeCalledTimes(1)
    act(() => {
      complex.getActions().setBazA(1) // trigger render
    })
    expect(renderSentinal).toBeCalledTimes(2)

    act(() => {
      complex.getActions().setBaz({ a: 1, b: 1 }) // shallow equal, not trigger render
    })
    expect(renderSentinal).toBeCalledTimes(2)
  })

  test('selector capture environment', () => {
    const complex = createComplexStore()
    const renderSentinal = jest.fn()
    const Com3: React.FC = () => {
      const [payload, setPayload] = useState(0)
      renderSentinal()
      const [n, _] = complex.useStore(s => s.baz.a + s.foo + payload)
      // consistent effect
      // const [n, _] = complex.useStore(useCallback(s => s.baz.a + s.foo + payload, [payload]));
      return (
        <div id="number" onClick={() => setPayload(payload + 1)}>
          {n}
        </div>
      )
    }

    let component = {} as ReactTestRenderer
    act(() => {
      component = renderer.create(<Com3 />) // render 1
    })

    expect(component.root.findByProps({ id: 'number' }).children[0]).toBe('101')

    act(() => {
      component.root.findByProps({ id: 'number' }).props.onClick() // render 2
    })

    expect(component.root.findByProps({ id: 'number' }).children[0]).toBe('102')

    act(() => {
      complex.getActions().setBazA(1) // render 3
    })

    expect(component.root.findByProps({ id: 'number' }).children[0]).toBe('3')

    expect(renderSentinal).toBeCalledTimes(3)
  })
})
