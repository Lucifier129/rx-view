/** @jsx h */
import { create, of, fromEvent, interval } from 'sukkula/src/source'
import {
  merge,
  scan,
  map,
  startWith,
  fromShape,
  consume,
  share,
  concat,
  then,
  take,
  keep
} from 'sukkula/src/operator'
import { run, onNext } from 'sukkula/src/sink'
import React from 'react'
import ReactDOM from 'react-dom'
import EventEmitter from 'events'
import { Spring } from 'wobble'
import { switchMap } from '../../src/operator'

const springOptions = {
  fromValue: 1,
  toValue: 0,
  stiffness: 100,
  damping: 20,
  mass: 3
}

const spring = options =>
  create(callback => {
    let instance = new Spring({ ...springOptions, ...options })
    let start = () => {
      instance.start()
      instance.onUpdate(({ currentValue }) => callback.next(currentValue))
      instance.onStop(() => callback.finish())
    }
    let finish = () => instance.stop()
    return { start, finish }
  })

export function h(...args) {
  return fromShape(args) |> map(args => React.createElement(...args))
}

export const renderTo = container => source =>
  source |> run(vdom => ReactDOM.render(vdom, container))

const identity = x => x

const createAction = (actionTypeList, emitter) => {
  return actionTypeList.reduce((result, key) => {
    result[key] = payload => emitter.emit(key, payload)
    return result
  }, {})
}

function createStore(reducers, preloadState) {
  let emitter = new EventEmitter()
  let actionTypeList = Object.keys(reducers)
  let reducers$ = actionTypeList.map(
    key => fromEvent(emitter, key) |> map(reducers[key])
  )
  let state$ =
    merge(...reducers$)
    |> startWith(identity)
    |> scan((state, reducer) => reducer(state), preloadState)
    |> share(true)
  return {
    state$: state$,
    action: createAction(actionTypeList, emitter)
  }
}

let toComponent = render => source =>
  source |> switchMap(render) |> map(value => () => value)

function createCountStore() {
  let reducers = {
    incre: (n = 1) => count => count + n,
    decre: (n = 1) => count => count - n
  }
  let preloadState = 0
  return createStore(reducers, preloadState)
}

let store = createCountStore()

let Header$ =
  store.state$
  |> map(Math.abs)
  |> map(count => count % 5)
  |> map(n => `h${n + 1}`)

let Loading$ = of(null) |> toComponent(() => <span>loading...</span>)

let Incre$ =
  interval(1000)
  |> take(1)
  |> toComponent(() => (
    <button onClick={of(() => store.action.incre(1))}>+1</button>
  ))

let SuspendIncre$ = merge(Loading$, Incre$)

let springCount$ =
  store.state$
  |> keep(2)
  |> switchMap(([current, previous]) => {
    if (previous != null)
      return spring() |> map(ratio => previous + (current - previous) * ratio)
    return of(current)
  })

let app = (
  <div>
    <Header$>Count: {springCount$}</Header$>
    <SuspendIncre$ />
    <button onClick={() => store.action.decre(1)}>-1</button>
  </div>
)

app |> run(vdom => ReactDOM.render(vdom, document.getElementById('root')))

store.state$ |> run(count => console.log('count', count))
