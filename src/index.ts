import produce, { Draft } from 'immer'
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  SetStateAction,
  Dispatch
} from 'react'

function generateKey(name: string) {
  return name + ':' + (+new Date() + Math.random()).toString(36)
}

type SetState<S> = (draft: Draft<S>) => void | S | Promise<void | S>

interface Actions<S> {
  [key: string]: (...payload: any[]) => SetState<S>
}

const PersistedStore = new Map()
function getPersistedStore<S>(key: string): S | null {
  return PersistedStore.get(key)
}

function setPersistedStore<S>(key: string, state: S) {
  return PersistedStore.set(key, state)
}

export enum UpdateMode {
  RealTime = 1,
  Performace = 2
}

export interface IPersistedStorage<S> {
  generateKey?(name: string): string
  set(key: string, value: S, preValue?: S): void
  get(key: string): S | null
}

export interface IStoreOptions<S = {}> {
  name?: string
  persist?: IPersistedStorage<S> | boolean
  updateMode?: UpdateMode
}

type ArgumentTypes<T> = T extends (...args: infer U) => infer R ? U : never
type ReplaceReturnType<T, TNewReturn> = (...a: ArgumentTypes<T>) => TNewReturn
type ReturnActions<S, A extends Actions<S>> = {
  [K in keyof A]: ReplaceReturnType<A[K], void>
}

const DEFAULT_STORE_NAME = 'east-store'

function isStorage(obj: any) {
  if (obj && typeof obj.set === 'function' && typeof obj.get === 'function') {
    return true
  }
  throw new Error('Expect a valid storage implementation')
}

interface Store<S, A extends Actions<S>> {
  useState: () => [Readonly<S>, ReturnActions<S, A>]
  borrowState: () => Readonly<S>
  borrowActions: () => ReturnActions<S, A>
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
  type Updater<S> = Dispatch<SetStateAction<S>>
  type Return = [Readonly<S>, ReturnActions<S, R>]

  let isPersisted = !!(options && options.persist === true)
  let name = (options && options.name) || DEFAULT_STORE_NAME
  let storage: IPersistedStorage<S> = {
    set: setPersistedStore,
    get: getPersistedStore,
    generateKey
  }
  if (
    options &&
    typeof options.persist === 'object' &&
    isStorage(options.persist)
  ) {
    isPersisted = true
    storage = options.persist
  }

  storage.generateKey = storage.generateKey || generateKey
  const updateMode = (options && options.updateMode) || UpdateMode.RealTime
  let usePersistedEffect = useRealTimeUpdate
  switch (updateMode) {
    case UpdateMode.Performace:
      usePersistedEffect = usePerformanceUpdate
      break
    case UpdateMode.RealTime:
      usePersistedEffect = useRealTimeUpdate
      break
    default:
      console.warn('Unexpectd updateMode')
  }

  // generate key for storage
  const key = storage.generateKey(name)
  // use a set to cache all updaters that share this state
  let updaters = new Set<Dispatch<SetStateAction<S>>>()
  // shared state's current value
  let currentState = initialState
  let currentActions: ReturnActions<S, R>

  function borrowCheck() {
    if (!currentActions) {
      throw new Error('No alive components with used the store')
    }
  }

  let store = {
    borrowState: () => {
      borrowCheck()
      return currentState
    },
    borrowActions: () => {
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
    if (typeof Proxy !== 'undefined') {
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

  function usePerformanceUpdate(state: S) {
    const val = useRef<S>()
    useEffect(
      () => () => {
        val.current = state
      },
      [state]
    )
    useEffect(
      () => () => {
        storage.set(key as string, val.current as S)
      },
      []
    )
  }

  function useRealTimeUpdate(state: S) {
    useEffect(() => () => storage.set(key, state), [state])
  }

  function reset() {
    currentState = initialState
    currentActions = null as any
  }

  function useSharedEffect(state: S, updateState: Updater<S>) {
    useEffect(() => {
      currentState = state
      updaters.add(updateState)
      return () => {
        updaters.delete(updateState)
        // reset all components been unmount, reset sharedState
        if (updaters.size === 0) reset()
      }
    }, [state, updateState])
  }

  function useSharedStore(): Return {
    const [state, updateState] = useState(currentState || initialState)
    useSharedEffect(state, updateState)

    const cb = useCallback(() => useProxy(state), [state])
    return [state, cb()]
  }

  function usePersistedSharedStore(): Return {
    const [state, updateState] = useState(
      storage.get(key as string) || currentState || initialState
    )

    useSharedEffect(state, updateState)
    usePersistedEffect(state)

    const cb = useCallback(() => useProxy(state), [state])
    return [state, cb()]
  }

  let _useState = isPersisted ? usePersistedSharedStore : useSharedStore

  store.useState = _useState
  return store
}
