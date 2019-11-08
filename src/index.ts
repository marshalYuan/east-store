import produce, { Draft } from 'immer'
import { useState, useEffect, useCallback, useRef } from 'react'

function generateKey(name: string) {
  return name + ':' + (+new Date() + Math.random()).toString(36)
}

function isAsyncFunction(f: Function) {
  return f && {}.toString.call(f) === '[object AsyncFunction]'
}

function useImmer<S = any>(
  initialValue: S | (() => S)
): [S, (f: (draft: Draft<S>) => void | S | Promise<void>) => void] {
  const [val, updateValue] = useState(initialValue)
  return [
    val,
    useCallback(
      updater => {
        if (isAsyncFunction(updater)) {
          ;(async () => {
            updateValue(
              await produce(val, <(d: Draft<S>) => Promise<void>>updater)
            )
          })()
        } else {
          updateValue(produce(updater) as (s: S) => S)
        }
      },
      [val]
    )
  ]
}
type SetState<S> = (draft: Draft<S>) => void | S | Promise<void>

interface Reducers<S> {
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

interface IStoreOptions<S = {}> {
  name?: string
  persist?: IPersistedStorage<S>
}

const DEFAULT_STORE_NAME = 'east-store'

/**
 * @description createStore with initialState and reducers
 * @param initialState
 * @param reducers
 * @param options
 */
export function createStore<S, R extends Reducers<S>>(
  initialState: S,
  reducers: R,
  options?: IStoreOptions<S>
) {
  type Updater<S> = (f: SetState<S>) => void
  type Return = [Readonly<S>, R]

  let name = (options && options.name) || DEFAULT_STORE_NAME
  let storage = (options && options.persist) || {
    set: setPersistedStore,
    get: getPersistedStore,
    generateKey
  }

  storage.generateKey = storage.generateKey || generateKey

  // generate key for storage
  const key = storage.generateKey(name)
  // use a set to cache all updaters that share this state
  let updaters = new Set<Updater<S>>()
  // shared state's current value
  let currentShareState: S

  function createProxy(updater: Updater<S> | Set<Updater<S>>): R {
    return new Proxy(
      {},
      {
        get(target, name: string, desc) {
          return (...args: any[]) => {
            if (typeof reducers[name] !== 'function') {
              throw new Error(`cannot find reducer named  '${name}'`)
            }
            let setState = reducers[name](...args) as any
            updater instanceof Set
              ? updater.forEach((updateState: any) => updateState(setState))
              : updater((updateState: any) => updateState(setState))
          }
        }
      }
    ) as R
  }

  function useSimplesStore(): Return {
    const [state, updateState] = useImmer(initialState)

    return [state, createProxy(updateState)]
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

  function usePersistedStore(): [S, R] {
    const [state, updateState] = useImmer(
      storage.get(key as string) || initialState
    )

    usePersistedEffect(state)

    return [state, createProxy(updateState)]
  }

  function useSharedEffect(state: S, updateState: Updater<S>) {
    useEffect(() => {
      updaters.add(updateState)
      currentShareState = state
      return () => {
        updaters.delete(updateState)
      }
    }, [state, updateState])
  }

  function useSharedStore(): Return {
    const [state, updateState] = useImmer(currentShareState || initialState)
    useSharedEffect(state, updateState)

    return [state, createProxy(updaters)]
  }

  function usePersistedSharedStore(): Return {
    const [state, updateState] = useImmer<S>(
      getPersistedStore<S>(key as string) || currentShareState || initialState
    )
    useSharedEffect(state, updateState)
    usePersistedEffect(state)

    return [state, createProxy(updaters)]
  }

  /**
   * @description useStore like hooks
   * @param type usecase of current store, persisted or shared or persisted_and_shared
   */
  function useStore(type?: StoreType): Return {
    type = type || StoreType.SIMPLE
    switch (type) {
      case StoreType.SIMPLE:
        return useSimplesStore()
      case StoreType.SHARED:
        return useSharedStore()
      case StoreType.PERSISTED:
        return usePersistedStore()
      case StoreType.PERSISTED_SHARED:
        return usePersistedSharedStore()
      default:
        throw new Error('Unexpect storeType')
    }
  }

  return { useStore }
}

export enum StoreType {
  SIMPLE,
  PERSISTED,
  SHARED,
  PERSISTED_SHARED
}
