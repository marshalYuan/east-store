import { createStore, Middleware } from '../'
import React, { useEffect } from 'react'
import moment from 'moment'

import renderer, { act, ReactTestRenderer } from 'react-test-renderer'

describe('simpleStore', () => {
  jest.useFakeTimers()

  test('initialstate is atomic', () => {
    // atomic store
    const AtomicStore = createStore(0, {
      increase: () => count => count + 1,
      decrease: n => count => count - n
    })

    const Counter: React.FC = () => {
      const [count, action] = AtomicStore.useStore()
      const handleDecrease = () => {
        expect(action.decrease(3)).toBe(void 0)
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
    let component = {} as ReactTestRenderer
    act(() => {
      component = renderer.create(<Counter />)
    })
    let tree = component.toJSON()
    expect(tree).toMatchSnapshot()

    for (let i = 0; i < 3; i++) {
      // increse 1
      act(component.root.findByProps({ id: 'increase-btn' }).props.onClick)
    }

    let increaseTree = component.toJSON()
    expect(increaseTree).toMatchSnapshot()
    // decrease 3
    act(() => {
      component.root.findByProps({ id: 'decrease-btn' }).props.onClick()
    })

    let decreaseTree = component.toJSON()
    expect(decreaseTree).toMatchSnapshot()
  })

  test('initialstate is complex', () => {
    const amy = {
      name: 'Amy',
      total: 130,
      score: { math: 60, english: 70 }
    }
    const buildStudentStore = (student: typeof amy) =>
      createStore(student, {
        modify: (subject: 'math' | 'english', score: number) => student => {
          student.score[subject] = score
          student.total = student.score.math + student.score.english
        }
      })

    const TestResult: React.FC<{
      studentStore: ReturnType<typeof buildStudentStore>
    }> = ({ studentStore }) => {
      const [{ name, total, score }, action] = studentStore.useStore()
      useEffect(() => {
        setTimeout(() => {
          action.modify('math', 90)
        }, 500)
      }, [])
      return (
        <div>
          <span>name: {name}</span>
          <span>mathScore: {score.math}</span>
          <span>englishStore: {score.english}</span>
          <span>totalStore: {total}</span>
        </div>
      )
    }
    const amyStore = buildStudentStore(amy)
    const component = renderer.create(<TestResult studentStore={amyStore} />)
    let tree = component.toJSON()
    expect(tree).toMatchSnapshot()

    expect(setTimeout).toHaveBeenCalledTimes(1)
    act(() => {
      jest.runAllTimers()
    })

    let afterTree = component.toJSON()
    expect(afterTree).toMatchSnapshot()
  })

  test('async action', async () => {
    const fetchRemoteTime = jest.fn(async () => {
      return await new Date(1573270146704)
    })

    const timer = createStore(
      {
        date: new Date(1573270100000)
      },
      {
        check: () => async state => {
          state.date = await fetchRemoteTime()
        }
      }
    )

    const Clock: React.FC = () => {
      const [{ date }, action] = timer.useStore()
      useEffect(() => {
        setTimeout(() => {
          expect(action.check()).toBe(void 0)
        }, 500)
      }, [])
      return <div>{date.toUTCString()}</div>
    }

    let component = {} as ReactTestRenderer
    act(() => {
      component = renderer.create(<Clock />)
    })
    let tree = component.toJSON()
    expect(tree).toMatchSnapshot()
    await act(async () => {
      jest.runAllTimers()
      let d = await fetchRemoteTime.mock.results[0].value
      expect(d).toStrictEqual(new Date(1573270146704))
    })

    let afterTree = component.toJSON()
    expect(afterTree).toMatchSnapshot()
  })

  test('concurrent async action', async () => {
    const fetchRemoteTime = jest.fn(async () => {
      return await new Date(1573270146704)
    })

    const timer = createStore(
      {
        date: new Date(1573270100000),
        flag: 0
      },
      {
        check: () => async state => {
          timer.getActions().mark(1)
          state.date = await fetchRemoteTime()
          timer.getActions().mark(0)
        },
        mark: (flag: number) => state => {
          state.flag = flag
        }
      }
    )

    const Clock: React.FC = () => {
      const [{ date, flag }, action] = timer.useStore()
      useEffect(() => {
        setTimeout(() => {
          action.check()
          // action.mark()
        }, 500)
      }, [])
      return (
        <div>
          <span>{flag}</span>
          <span>{date.toUTCString()}</span>
        </div>
      )
    }

    let component = {} as ReactTestRenderer
    act(() => {
      component = renderer.create(<Clock />)
    })
    let tree = component.toJSON()
    expect(tree).toMatchSnapshot()
    await act(async () => {
      jest.runAllTimers()
      let d = await fetchRemoteTime.mock.results[0].value
      expect(d).toStrictEqual(new Date(1573270146704))
    })

    let afterTree = component.toJSON()
    expect(afterTree).toMatchSnapshot()
  })

  test('store length', () => {
    const AtomicStore = createStore(0, {
      increase: () => count => count + 1,
      decrease: n => count => count - n
    })
    expect(AtomicStore.length).toBe(0)

    const A: React.FC = () => {
      const [count, actions] = AtomicStore.useStore()
      return <div>{count}</div>
    }

    let a = {} as ReactTestRenderer
    act(() => {
      a = renderer.create(<A />)
    })

    expect(AtomicStore.length).toBe(1)

    const B: React.FC = () => {
      const [count, actions] = AtomicStore.useStore()
      return <div>{count}</div>
    }

    let b = {} as ReactTestRenderer
    act(() => {
      b = renderer.create(<B />)
    })

    expect(AtomicStore.length).toBe(2)

    a.unmount()
    b.unmount()

    expect(AtomicStore.length).toBe(0)
  })

  test('store.getState() & store.getActions()', () => {
    let counterStore = createStore(0, {
      increase: () => count => count + 1
    })

    let store = createStore(
      { status: 'pending' },
      {
        start: () => state => {
          counterStore.getActions().increase()
          expect(counterStore.getCommitedState()).toBe(0)
          // get transient state
          expect(counterStore.getState()).toBe(1)
          state.status = 'start'
        }
      }
    )

    expect(counterStore.getState()).toBe(0)
    counterStore.getActions().increase()
    expect(counterStore.getState()).toBe(0)

    const A: React.FC = () => {
      const [count, _] = counterStore.useStore()
      const [{ status }, actions] = store.useStore()

      return (
        <div>
          <span>{count}</span>
          <span>{status}</span>
        </div>
      )
    }

    let a = {} as ReactTestRenderer
    act(() => {
      a = renderer.create(<A />)
    })
    expect(a.toJSON()).toMatchSnapshot()

    act(store.getActions().start)

    expect(a.toJSON()).toMatchSnapshot()
  })

  test('middleware', async () => {
    jest.useRealTimers()
    const sleep = async (timeout: number) =>
      await new Promise(r => setTimeout(r, timeout))

    let middlewareCB = jest.fn(() => {})
    const middleware: Middleware = jest.fn(
      (action, payload, store, isAsync) => {
        return middlewareCB
      }
    )
    const store = createStore(
      { foo: 'foo', bar: 0 },
      {
        increase: (n: number) => state => {
          state.bar += n
        },
        delayIncrease: () => async state => {
          await sleep(100)
          state.bar += 2
        }
      },
      {
        middlewares: [middleware]
      }
    )

    const A: React.FC = () => {
      const [state, actions] = store.useStore()

      return (
        <div>
          <span>{state.foo}</span>
          <span>{state.bar}</span>
        </div>
      )
    }

    let a = {} as ReactTestRenderer
    act(() => {
      a = renderer.create(<A />)
    })
    act(() => store.getActions().increase(2))

    expect(middleware).toBeCalledWith('increase', [2], store, false)
    expect(middlewareCB).toBeCalled()

    act(() => {
      store.getActions().delayIncrease()
      expect(middleware).lastCalledWith('delayIncrease', [], store, true)
      expect(middlewareCB).toBeCalledTimes(1)
    })

    await act(async () => {
      await sleep(200)
    })
    expect(middlewareCB).toBeCalledTimes(2)
  })

  test('state.xxx with moment', () => {
    const store = createStore(
      {
        date: moment('2020-12-22')
      },
      {
        setDate: date => state => {
          state.date = date
        }
      }
    )

    const A: React.FC = () => {
      const [{ date }, actions] = store.useStore()

      function handleChange() {
        actions.setDate(moment('2020-12-25'))
      }

      return (
        <div>
          <span className="date">{date.format('YYYY-MM-DD')}</span>
          <button id="moment-change-btn" onClick={handleChange}>
            change btn
          </button>
        </div>
      )
    }

    let a = {} as ReactTestRenderer
    act(() => {
      a = renderer.create(<A />)
    })

    act(a.root.findByProps({ id: 'moment-change-btn' }).props.onClick)
    expect(a.root.findByProps({ className: 'date' }).children).toEqual([
      '2020-12-25'
    ])
    expect(store.getState().date.format('YYYY-MM-DD')).toBe('2020-12-25')
  })
})
