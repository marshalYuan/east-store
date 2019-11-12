import produce, { Draft } from 'immer'
import { useState, useEffect, useCallback, useRef } from 'react'

function generateKey(name: string) {
  return name + ':' + (+new Date() + Math.random()).toString(36)
}

function useImmer<S = any>(
  initialValue: S | (() => S)
): [S, (f: SetState<S>) => void] {
  const [val, updateValue] = useState(initialValue)
  return [
    val,
    useCallback(
      updater => {
        let result = produce(val, updater)
        if (typeof Promise !== 'undefined' && result instanceof Promise) {
          result.then(r => updateValue(r as S))
        } else {
          updateValue(result as S)
        }
      },
      [val]
    )
  ]
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

interface IPersistedStorage<S> {
  generateKey?(name: string): string
  set(key: string, value: S): void
  get(key: string): S | null
}

export interface IStoreOptions<S = {}> {
  name?: string
  persist?: IPersistedStorage<S> | boolean
  shared?: boolean
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
  type Updater<S> = (f: SetState<S>) => void
  type Return = [Readonly<S>, ReturnActions<S, R>]

  let isPersisted = !!(options && options.persist === true)
  let isShared = !!(options && options.shared)
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
  if (isPersisted && options && options.shared != undefined && !isShared) {
    console.warn('persisted store must be shared')
  }

  storage.generateKey = storage.generateKey || generateKey

  // generate key for storage
  const key = storage.generateKey(name)
  // use a set to cache all updaters that share this state
  let updaters = new Set<Updater<S>>()
  // shared state's current value
  let currentShareState: S | null

  let proxy: R = Object.keys(reducers).reduce(
    (pre: any, cur: keyof R) => {
      pre[cur] = (...args: any[]) => {
        let setState = reducers[cur](...args) as any
        updaters.forEach((updateState: any) => updateState(setState))
      }
      return pre
    },
    {} as R
  )

  const useProxy = (updater?: Updater<S>) => {
    if (updater) {
      return Object.keys(reducers).reduce(
        (pre: any, cur: keyof R) => {
          pre[cur] = (...args: any[]) => {
            updater(reducers[cur](...args) as any)
          }
          return pre
        },
        {} as R
      )
    }
    return proxy
  }

  function useSimpleStore(): Return {
    const [state, updateState] = useImmer(initialState)

    return [state, useProxy(updateState)]
  }

  function usePersistedEffect(state: S) {
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

  function resetSharedState() {
    currentShareState = null
  }

  function useSharedEffect(state: S, updateState: Updater<S>) {
    useEffect(() => {
      updaters.add(updateState)
      currentShareState = state
      return () => {
        updaters.delete(updateState)
        // reset all components been unmount, reset sharedState
        if (updaters.size == 0) resetSharedState()
      }
    }, [state, updateState])
  }

  function useSharedStore(): Return {
    const [state, updateState] = useImmer(currentShareState || initialState)
    useSharedEffect(state, updateState)

    return [state, useProxy()]
  }

  function usePersistedSharedStore(): Return {
    const [state, updateState] = useImmer<S>(
      storage.get(key as string) || currentShareState || initialState
    )
    useSharedEffect(state, updateState)
    usePersistedEffect(state)

    return [state, useProxy()]
  }

  let useState = isPersisted
    ? usePersistedSharedStore
    : isShared
    ? useSharedStore
    : useSimpleStore

  return { useState }
}
