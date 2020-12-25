import * as React from 'react'
import { Footer } from './footer'
import { TodoItem } from './todoItem'
import { appStore, routerStore, initRouter } from './store'
import { ENTER_KEY, APP_MENUS } from './constants'

const Main: React.FC = () => {
  const [{ todos, editing }, actions] = appStore.useStore()
  const [nowShowing] = routerStore.useStore()
  let activeTodoCount = todos.reduce(
    (accum, todo) => (todo.completed ? accum : accum + 1),
    0
  )
  function handleToggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    let checked = e.target.checked
    actions.toggleAll(checked)
  }

  var shownTodos = todos.filter(todo => {
    switch (nowShowing) {
      case APP_MENUS.ACTIVE_TODOS:
        return !todo.completed
      case APP_MENUS.COMPLETED_TODOS:
        return todo.completed
      default:
        return true
    }
  })

  var todoItems = shownTodos.map(todo => {
    return (
      <TodoItem
        key={todo.id}
        todo={todo}
        onEdit={() => actions.setEditting(todo.id)}
        editing={editing === todo.id}
        onCancel={() => actions.setEditting(null)}
      />
    )
  })

  React.useEffect(initRouter, [])

  return (
    <section className="main">
      <input
        id="toggle-all"
        className="toggle-all"
        type="checkbox"
        onChange={handleToggleAll}
        checked={activeTodoCount === 0}
      />
      <label htmlFor="toggle-all">Mark all as complete</label>
      <ul className="todo-list">{todoItems}</ul>
    </section>
  )
}

const Loading = () => (
  <div className="loading">
    <div className="lds-roller">
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  </div>
)

const App: React.FC = () => {
  const [{ todos, loading }, actions] = appStore.useStore()
  const [newTodo, setNewTodo] = React.useState('')
  const completedCount = todos.filter(todo => todo.completed).length
  const activeCount = todos.length - completedCount
  let footer

  function handleNewTodoKeyDown(event: React.KeyboardEvent) {
    if (event.keyCode !== ENTER_KEY) {
      return
    }
    event.preventDefault()
    setNewTodo('')
    actions.addTodo(newTodo)
  }

  if (activeCount || completedCount) {
    footer = <Footer />
  }
  return (
    <div>
      {loading && <Loading />}
      <header className="header">
        <h1>todos</h1>
        <input
          className="new-todo"
          placeholder="What needs to be done?"
          value={newTodo}
          onKeyDown={handleNewTodoKeyDown}
          onChange={e => setNewTodo(e.target.value)}
          autoFocus={true}
        />
      </header>
      {todos.length ? <Main /> : null}
      {footer}
    </div>
  )
}

export default App
