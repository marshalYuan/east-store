# east-store

> east-store is a state manager with easiest api that based hooks and immer.

[![npm](https://img.shields.io/npm/v/east-store.svg?style=flat-square)](http://npm.im/easy-peasy)
[![MIT License](https://img.shields.io/npm/l/easy-peasy.svg?style=flat-square)](http://opensource.org/licenses/MIT)

# install

```
npm install east-store
```

# features

- easy usage, just one api `createStore`
- immutale data based immer
- friendly typescript support, no need more type declarations
- use react-hooks, why not?

# usage

```typescript
import { createStore } from 'east-store'

const AtomicStore = createStore(0, {
    increase: () => count => count + 1,
    decrease: n => count => count - n
})

const Counter: React.FC = () => {
    const [count, action] = AtomicStore.useState()
    const handleDecrease = () => {
        action.decrease(3)
    }
    return (
        <div>
            <span>{count}</span>
            <button id="increase-btn" onClick={action.increase}>
                increase
            </button>
            <button id="decrease-btn" onClick={handleDecrease}>
                decrease
            </button>
        </div>
    )
}
```

Of course, you can use object as initial state

```typescript
const amy = {
    name: 'Amy',
    total: 130,
    score: { math: 60, english: 70 }
}
const buildStudentStore = (student: typeof amy) =>
    createStore(student, {
        modify: (subject: 'math' | 'english', score: number) => student => {
            student.score[subject] = score
            student.total = student.score.math + student.score.english
        }
    })

const amyScore = buildStudentStore(amy)

const [state, actions] = amyScore.useState()
```

So, async operation is also supported

```typescript
async function fetchCount(): number {
    return await fetch('/path')
}

const AtomicStore = createStore(0, {
    increase: () => count => count + 1,
    getRemote: () => async (_) => {
        return await fetchCount()
    }
})
```

# Api

```
createStore(initial, actions, options)
```
|         | des               | type                                                                                               |
|---------|-------------------|----------------------------------------------------------------------------------------------------|
| initial | initial state     | primitive type <br> object<br> Map, Set                                                            |
| actions | actions for state | `(payload) => (state) => void | state`                                                             |   
| options | other options     | `shared: boolean` , default false<br> set true if you want share state between more than one component<br><br>  `persist: boolean or Storage`, default false<br> set true if you want this state been persisted <br> and set custom storage implementation with `set, get` is also valid <br> * persistence means shared |


