import { Middleware } from 'east-store'
import { formatTime } from './utils'

const timer =
  typeof performance !== 'undefined' &&
  performance !== null &&
  typeof performance.now === 'function'
    ? performance
    : Date

export const logger: Middleware = (action, payload, store, isAsync) => {
  const start = timer.now()
  const startTime = new Date()
  const title = [`%c action`]
  const css = ['color: gray; font-weight: lighter;']
  // action = isAsnc? `${action}>` : action
  title.push(`%c ${store.name}.${action}(${payload})`)
  css.push('inherit')

  const prevState = store.getState()
  return () => {
    const nextState = store.getState()
    const end = timer.now()

    title.push(`%c @ ${formatTime(startTime)}`)
    css.push('color: gray; font-weight: lighter;')

    title.push(`%c (in ${(end - start).toFixed(2)}ms)`)
    css.push('color: #b83f45; font-weight: lighter;')

    console.group(title.join(' '), ...css)
    console.log('%c prevState:', 'color: #9E9E9E;', prevState)

    console.log('%c payload:', 'color: #03A9F4;', ...payload)

    console.log('%c nextState:', 'color: #4CAF50;', nextState)
    console.groupEnd()
  }
}
