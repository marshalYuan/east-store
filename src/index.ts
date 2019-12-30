import produce, {
  Draft,
  setUseProxies,
  applyPatches,
  Patch,
  isDraftable
} from 'immer'
import {
  useState,
  useEffect,
  useRef,
  SetStateAction,
  Dispatch,
  useMemo
} from 'react'

function generateKey(name: string) {
  return name
}

type SetState<S> = (draft: Draft<S>) => void | S | Promise<void | S>

export interface Actions<S> {
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

export interface Middleware {
  (action: string, payload: any[], store: Store<any, any>, isAsync: boolean):
    | void
    | (() => any)
}

export interface IStoreOptions<S> {
  middlewares?: Middleware[]
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

export interface Store<S, A extends Actions<S>> {
  useStore: () => Return<S, A>
  getState: () => Readonly<S>
  getCommitedState: () => Readonly<S>
  // setState: (s: S) => void
  getActions: () => ReturnActions<S, A>
  readonly length: number
  readonly name: string
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
  let middlewares = (options && options.middlewares) || []
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
  let transientState: S
  let commitedState: S
  let proxy: ReturnActions<S, R>
  let changes: Patch[] = []
  // the inverse of all the changes made in the wizard
  let inverseChanges: Patch[] = []

  let store = {
    getState: () => {
      return transientState || initialState
    },
    getCommitedState: () => {
      return commitedState || initialState
    },
    getActions: () => {
      return proxy
    },
    get length() {
      return updaters.size
    },
    get name() {
      return name
    }
  } as Store<S, R>

  function performUpdate(state: S) {
    if (isDraftable(state)) {
      const result = applyPatches(transientState, changes)
      changes = []
      inverseChanges = []
      transientState = result
    } else {
      transientState = state
    }

    // update peristed storage even though there is no component alive
    if (updaters.size === 0) {
      console &&
        console.warn &&
        console.warn(
          'No alive component to respond this update, just sync to storage if needful'
        )
      isPersisted && storage.set(key, transientState)
    } else {
      updaters.forEach(setState => setState(transientState))
    }
  }
  let middlewareCBs: ReturnType<Middleware>[] = []
  const mapActions = (key: string) => (...args: any[]) => {
    const setState = reducers[key](...args) as any
    const result = produce(
      transientState,
      setState,
      (patches, inversePatches) => {
        changes.push(...patches)
        inverseChanges.push(...inversePatches)
      }
    )
    if (typeof Promise !== 'undefined' && result instanceof Promise) {
      middlewareCBs.push(...middlewares.map(fn => fn(key, args, store, true)))
      result.then(performUpdate)
    } else {
      middlewareCBs.push(...middlewares.map(fn => fn(key, args, store, false)))
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

  function usePersistedEffect(state: S) {
    const didMount = useRef(false)
    useEffect(() => {
      didMount.current && storage.set(key, state)
      didMount.current = true
    }, [state])
  }

  function useMiddlewareEffect(state: S) {
    useEffect(() => {
      middlewareCBs.forEach(f => {
        typeof f === 'function' && f()
      })
      middlewareCBs = []
    })
  }

  function useSharedEffect(state: S, updateState: Updater<S>) {
    transientState = transientState || state
    useEffect(() => {
      commitedState = state
      updaters.add(updateState)
      return () => {
        updaters.delete(updateState)
      }
    }, [state])

    // when all components been unmount, reset sharedState
  }

  function useSharedStore(): Return<S, R> {
    const [state, updateState] = useState(transientState || initialState)

    useSharedEffect(state, updateState)
    useMiddlewareEffect(state)

    return [state, proxy]
  }

  function usePersistedSharedStore(): Return<S, R> {
    const [state, updateState] = useState(
      transientState || storage.get(key as string) || initialState
    )

    useSharedEffect(state, updateState)
    usePersistedEffect(state)
    useMiddlewareEffect(state)

    return [state, proxy]
  }

  store.useStore = isPersisted ? usePersistedSharedStore : useSharedStore

  return store
}
