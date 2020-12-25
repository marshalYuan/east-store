import { createStore } from '../'
import React from 'react'

import renderer, { act, ReactTestRenderer } from 'react-test-renderer'
import { stat } from 'fs'
import { equal } from 'assert'

describe('selector', () => {
  const complex = createStore(
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

  test('base', () => {
    const Com1: React.FC = () => {
      const [n, _] = complex.useStore(s => s.baz.a + s.foo)
      return <div id="number">{n}</div>
    }

    const e1 = renderer.create(<Com1 />)
    expect(e1.root.findByProps({ id: 'number' }).children[0]).toBe('101')
  })

  test('dispatch action', () => {
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
})
