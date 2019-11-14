import { createStore } from '../'
import React, { useEffect } from 'react'

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
      const [count, action] = AtomicStore.useState()
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
      const [{ name, total, score }, action] = studentStore.useState()
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

    const timer = createStore(new Date(1573270100000), {
      check: () => async () => {
        return await fetchRemoteTime()
      }
    })

    const Clock: React.FC = () => {
      const [date, action] = timer.useState()
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
})
