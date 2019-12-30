import { createStore } from 'east-store'
import { uuid, sleep } from './utils'
import { logger } from './middlewares'
import { APP_MENUS } from './constants'

const { Router } = require('director/build/director.js')

export interface ITodo {
  id: string
  title: string
  completed: boolean
}

let route: APP_MENUS
switch (window.location.hash) {
  case '#/completed':
    route = APP_MENUS.COMPLETED_TODOS
    break
  case '#/active':
    route = APP_MENUS.ACTIVE_TODOS
    break
  default:
    route = APP_MENUS.ALL_TODOS
}

export const routerStore = createStore(
  route,
  {
    routeTo: (i: APP_MENUS) => state => i
  },
  {
    name: 'ROUTER-STORE',
    middlewares: [logger]
  }
)

export function initRouter() {
  const { routeTo } = routerStore.getActions()
  var router = new Router({
    '/': () => routeTo(APP_MENUS.ALL_TODOS),
    '/active': () => routeTo(APP_MENUS.ACTIVE_TODOS),
    '/completed': () => routeTo(APP_MENUS.COMPLETED_TODOS)
  })
  router.init('/')
}

const initState = {
  editing: null as null | string,
  newTodo: '',
  loading: false,
  todos: [] as Array<ITodo>
}
export const appStore = createStore(
  initState,
  {
    clearCompleted: () => state => {
      state.todos = state.todos.filter(i => !i.completed)
    },
    handleChange: text => state => {
      state.newTodo = text
    },
    toggle: (item: ITodo) => state => {
      let todo = state.todos.find(i => i.id === item.id)
      todo && (todo.completed = !todo.completed)
    },
    toggleAll: (checked: boolean) => state => {
      state.todos.forEach(i => (i.completed = checked))
    },
    destroy: (item: ITodo) => state => {
      let i = state.todos.findIndex(i => i.id === item.id)
      if (i > -1) {
        state.todos.splice(i, 1)
      }
    },
    addTodo: (title: string) => state => {
      state.todos.push({
        id: uuid(),
        title,
        completed: false
      })
      state.newTodo = ''
    },
    setEditting: (id: string | null) => state => {
      state.editing = id
    },
    setLoading: (loading: boolean) => state => {
      state.loading = loading
    },
    save: (id: string, text: string) => async state => {
      let todo = state.todos.find(i => i.id === id)
      let s = appStore.getActions().setLoading(true) as any
      await sleep(2000)
      todo && (todo.title = text)
      state.editing = null
      state.loading = true
    }
  },
  {
    name: 'TODO-STORE',
    persist: {
      get(key) {
        return {
          ...initState,
          todos: JSON.parse(localStorage.getItem(key) || '[]')
        }
      },
      set(key, value) {
        localStorage.setItem(key, JSON.stringify(value.todos))
      }
    },
    middlewares: [logger]
  }
)
