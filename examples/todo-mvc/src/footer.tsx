import React from 'react'
import classNames from 'classnames'

import { appStore, routerStore } from './store'
import { APP_MENUS } from './constants'

export const Footer: React.FC = () => {
  const [nowShowing] = routerStore.useStore()
  const [{ todos }, actions] = appStore.useStore()
  const completedCount = todos.filter(todo => todo.completed).length
  const activeCount = todos.length - completedCount
  const activeTodoWord = activeCount > 1 ? 'items' : 'item'
  const clearButton =
    completedCount > 0 ? (
      <button className="clear-completed" onClick={actions.clearCompleted}>
        Clear completed
      </button>
    ) : null
  return (
    <footer className="footer">
      <span className="todo-count">
        <strong>{activeCount}</strong> {activeTodoWord} left
      </span>
      <ul className="filters">
        <li>
          <a
            href="#/"
            className={classNames({
              selected: nowShowing === APP_MENUS.ALL_TODOS
            })}
          >
            All
          </a>
        </li>{' '}
        <li>
          <a
            href="#/active"
            className={classNames({
              selected: nowShowing === APP_MENUS.ACTIVE_TODOS
            })}
          >
            Active
          </a>
        </li>{' '}
        <li>
          <a
            href="#/completed"
            className={classNames({
              selected: nowShowing === APP_MENUS.COMPLETED_TODOS
            })}
          >
            Completed
          </a>
        </li>
      </ul>
      {clearButton}
    </footer>
  )
}
