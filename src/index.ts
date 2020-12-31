import produce, {
  Draft,
  setUseProxies,
  applyPatches,
  Patch,
  isDraftable,
  enableAllPlugins
} from 'immer'
import {
  useState,
  useEffect,
  useRef,
  SetStateAction,
  Dispatch,
  useCallback
} from 'react'

enableAllPlugins()

function generateKey(name: string) {
  return name
}

type SetState<S> = (draft: Draft<S>) => void | S | Promise<void | S>

export interface Actions<S> {
  [key: string]: (...payload: any[]) => SetState<S>
}

const isSupportedProxy = typeof Proxy !== 'undefined'
if (!isSupportedProxy) {
  setUseProxies(false)
}

type Obj = Record<string | number | symbol, unknown>

function shallowEqual<T extends any, U extends any>(objA: T, objB: U) {
  if (Object.is(objA, objB)) {
    return true
  }
  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false
  }
  const keysA = Object.keys(objA as object)
  if (keysA.length !== Object.keys(objB as object).length) {
    return false
  }
  for (let i = 0; i < keysA.length; i++) {
    if (
      !Object.prototype.hasOwnProperty.call(objB, keysA[i]) ||
      !Object.is((objA as Obj)[keysA[i]], (objB as Obj)[keysA[i]])
    ) {
      return false
    }
  }
  return true
}

const store: Map<string, any> = new Map()
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
type Hooks<S, A extends Actions<S>, E = S> = [Readonly<E>, ReturnActions<S, A>]

const DEFAULT_STORE_NAME = 'east-store'

function isStorage(obj: any) {
  if (obj && typeof obj.set === 'function' && typeof obj.get === 'function') {
    return true
  }
  throw new Error('Expect a valid storage implementation')
}

type Selector<S, E> = (state: S) => E

export interface Store<S, A extends Actions<S>> {
  useStore(): Hooks<S, A>
  useStore<E = S>(
    selector: Selector<S, E>,
    compareFn?: (prev: E, curr: E) => boolean
  ): Hooks<S, A, E>
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
  if (isPersisted) {
    const persitedState = storage.get(key)
    persitedState && (initialState = persitedState)
  }
  // use a set to cache all updaters that share this state
  let updaters = new Set<Dispatch<SetStateAction<S>>>()
  // shared state's current value
  let transientState: S = initialState
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
    proxy = Object.keys(reducers).reduce((pre: any, key: string) => {
      pre[key] = mapActions(key)
      return pre
    }, {} as R)
  }

  function usePersistedEffect() {
    const didMount = useRef(false)
    useEffect(() => {
      didMount.current && storage.set(key, transientState)
      didMount.current = true
    }, [transientState])
  }

  function useMiddlewareEffect() {
    useEffect(() => {
      middlewareCBs.forEach(f => {
        typeof f === 'function' && f()
      })
      middlewareCBs = []
    })
  }

  function useSharedEffect(updateState: Updater<S>) {
    useEffect(() => {
      commitedState = transientState
      updaters.add(updateState)
      return () => {
        updaters.delete(updateState)
      }
    }, [transientState])

    // when all components been unmount, reset sharedState
  }

  function useSelector<E>(
    selector?: Selector<S, E>,
    compareFn: (prev: E, curr: E) => boolean = shallowEqual
  ): [E, Updater<S>] {
    const [state, setState] = useState(() =>
      selector ? selector(transientState) : transientState
    )
    const stateRef = useRef(state)
    stateRef.current = state
    const updater = useCallback((ts: S) => {
      if (selector) {
        const current = selector(ts)
        if (!compareFn(stateRef.current as E, current)) {
          setState(current)
        }
      } else {
        setState(ts)
      }
    }, [])

    return [state as E, updater as Updater<S>]
  }

  function useSharedStore<E = S>(
    selector?: Selector<S, E>,
    compareFn?: (prev: E, curr: E) => boolean
  ): Hooks<S, R, E> {
    const [state, updater] = useSelector(selector, compareFn)
    useSharedEffect(updater)
    useMiddlewareEffect()

    return [state, proxy]
  }

  function usePersistedSharedStore<E = S>(
    selector?: Selector<S, E>,
    compareFn?: (prev: E, curr: E) => boolean
  ): Hooks<S, R, E> {
    const [state, updater] = useSelector(selector, compareFn)
    useSharedEffect(updater)
    usePersistedEffect()
    useMiddlewareEffect()

    return [state, proxy]
  }

  store.useStore = isPersisted ? usePersistedSharedStore : useSharedStore

  return store
}
