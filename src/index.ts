import produce, { Draft, setUseProxies } from 'immer'
import {
  useState,
  useEffect,
  useRef,
  SetStateAction,
  Dispatch,
  useMemo
} from 'react'

function generateKey(name: string) {
  return name + ':' + (+new Date() + Math.random()).toString(36)
}

type SetState<S> = (draft: Draft<S>) => void | S | Promise<void | S>

interface Actions<S> {
  [key: string]: (...payload: any[]) => SetState<S>
}

const iMap =
  Map ||
  class<K, V> {
    private table: Array<[K, V]> = []
    get(key: K) {
      for (let index = 0; index < this.table.length; index++) {
        const element = this.table[index]
        if (element[0] == key) {
          return element[1]
        }
      }
    }
    set(key: K, value: V) {
      for (let index = 0; index < this.table.length; index++) {
        const element = this.table[index]
        if (element[0] == key) {
          element[1] = value
          break
        }
      }
      this.table.push([key, value])
    }
    delete(key: K) {
      let i = -1
      for (let index = 0; index < this.table.length; index++) {
        const element = this.table[index]
        if (element[0] === key) {
          i = index
        }
      }
      if (i > -1) {
        this.table.splice(i, 1)
        return true
      }
      return false
    }
    forEach(f: (v: V, k: K, m: Map<K, V>) => void) {
      for (let index = 0; index < this.table.length; index++) {
        const element = this.table[index]
        f(element[1], element[0], this as any)
      }
    }
    get size() {
      return this.table.length
    }
  }

const iSet =
  Set ||
  class<V> {
    private map: Map<V, V> = new iMap()
    add(v: V) {
      this.map.set(v, v)
    }
    delete(v: V) {
      return this.map.delete(v)
    }
    forEach(f: (k: V, v: V, set: Set<V>) => void) {
      this.map.forEach((v, k) => {
        f(v, k, this as any)
      })
    }
    get size() {
      return this.map.size
    }
  }

const isSupportedProxy = typeof Proxy !== 'undefined'
if (!isSupportedProxy) {
  setUseProxies(false)
}

const store: Map<string, any> = new iMap()
const defaultStorage = {
  generateKey,
  get: (key: string) => store.get(key),
  set: (key: string, value: any) => {
    store.set(key, value)
  }
}

export interface IPersistedStorage<S> {
  generateKey?(name: string): string
  set(key: string, value: S): void
  get(key: string): S | null
}

export interface IStoreOptions<S = {}> {
  name?: string
  persist?: IPersistedStorage<S> | boolean
}

type ArgumentTypes<T> = T extends (...args: infer U) => infer R ? U : never
type ReplaceReturnType<T, TNewReturn> = (...a: ArgumentTypes<T>) => TNewReturn
type ReturnActions<S, A extends Actions<S>> = {
  [K in keyof A]: ReplaceReturnType<A[K], void>
}
type Updater<S> = Dispatch<SetStateAction<S>>
type Return<S, A extends Actions<S>> = [Readonly<S>, ReturnActions<S, A>]

const DEFAULT_STORE_NAME = 'east-store'

function isStorage(obj: any) {
  if (obj && typeof obj.set === 'function' && typeof obj.get === 'function') {
    return true
  }
  throw new Error('Expect a valid storage implementation')
}

interface Store<S, A extends Actions<S>> {
  useStore: () => Return<S, A>
  getState: (transient?: boolean) => Readonly<S>
  getActions: () => ReturnActions<S, A>
  readonly length: number
}

/**
 * @description createStore with initialState and reducers
 * @param initialState
 * @param reducers
 * @param options
 */
export function createStore<S, R extends Actions<S>>(
  initialState: S,
  reducers: R,
  options?: IStoreOptions<S>
) {
  let isPersisted = !!(options && options.persist === true)
  let name = (options && options.name) || DEFAULT_STORE_NAME
  let storage = defaultStorage as IPersistedStorage<S>
  if (
    options &&
    typeof options.persist === 'object' &&
    isStorage(options.persist)
  ) {
    isPersisted = true
    storage = options.persist
  }

  storage.generateKey = storage.generateKey || generateKey

  // generate key for storage
  const key = storage.generateKey(name)
  // use a set to cache all updaters that share this state
  let updaters = new iSet<Dispatch<SetStateAction<S>>>()
  // shared state's current value
  let transientState = initialState
  let commitedState = initialState
  let currentActions: ReturnActions<S, R>

  function borrowCheck() {
    if (!currentActions) {
      throw new Error('No alive components with used the store')
    }
  }

  let store = {
    getState: (transient?: boolean) => {
      return transient ? transientState : commitedState
    },
    getActions: () => {
      borrowCheck()
      return currentActions
    },
    get length() {
      return updaters.size
    }
  } as Store<S, R>

  function performUpdate(state: S) {
    updaters.forEach(setState => setState(state))
    // update peristed storage even though there is no component alive
    if (updaters.size === 0 && isPersisted) {
      storage.set(key, state)
    }
    transientState = state
  }

  const useProxy = (state: S) => {
    let proxy: ReturnActions<S, R>
    const mapActions = (key: string) => (...args: any[]) => {
      const setState = reducers[key](...args) as any
      const result = produce(state, draft => {
        return setState(draft, proxy)
      })
      if (typeof Promise !== 'undefined' && result instanceof Promise) {
        result.then(performUpdate)
      } else {
        performUpdate(result)
      }
    }
    if (isSupportedProxy) {
      proxy = new Proxy(reducers, {
        get(target, key, desc) {
          return mapActions(key as string)
        }
      })
    } else {
      proxy = Object.keys(reducers).reduce(
        (pre: any, key: string) => {
          pre[key] = mapActions(key)
          return pre
        },
        {} as R
      )
    }
    currentActions = proxy
    return proxy
  }

  function usePersistedEffect(state: S) {
    const didMount = useRef(false)
    useEffect(() => {
      didMount.current && storage.set(key, state)
      didMount.current = true
    }, [state])
  }

  function reset() {
    commitedState = transientState = initialState
    currentActions = null as any
  }

  function useSharedEffect(state: S, updateState: Updater<S>) {
    useEffect(() => {
      commitedState = state
      updaters.add(updateState)
      return () => {
        updaters.delete(updateState)
      }
    }, [state])

    // when all components been unmount, reset sharedState
    useEffect(
      () => () => {
        if (updaters.size === 0) reset()
      },
      []
    )
  }

  function useSharedStore(): Return<S, R> {
    const [state, updateState] = useState(commitedState)
    useSharedEffect(state, updateState)

    const p = useMemo(() => useProxy(state), [state])
    return [state, p]
  }

  function usePersistedSharedStore(): Return<S, R> {
    const [state, updateState] = useState(
      storage.get(key as string) || commitedState
    )

    useSharedEffect(state, updateState)
    usePersistedEffect(state)

    const p = useMemo(() => useProxy(state), [state])
    return [state, p]
  }

  store.useStore = isPersisted ? usePersistedSharedStore : useSharedStore

  return store
}
