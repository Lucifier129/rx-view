/** @jsx h */
import {
  merge,
  concat,
  combineLatest,
  Subject,
  interval,
  fromEvent,
  of,
  pipe,
  from,
  isObservable
} from 'rxjs'
import {
  scan,
  map,
  startWith,
  share,
  take,
  switchMap,
  publishReplay
} from 'rxjs/operators'
import React from 'react'
import ReactDOM from 'react-dom'
import EventEmitter from 'events'

const fromArrayShape = array => combineLatest(...array.map(fromShape))
const fromObjectShape = obj => {
  let keys = Object.keys(obj)
  let sourceList = keys.map(key => fromShape(obj[key]))
  let construct = (result, value, index) => {
    result[keys[index]] = value
    return result
  }
  let toShape = valueList => valueList.reduce(construct, {})
  return combineLatest(...sourceList).pipe(map(toShape))
}

const fromShape = shape => {
  if (shape && isObservable(shape)) {
    return shape
  } else if (Array.isArray(shape)) {
    return fromArrayShape(shape)
  } else if (shape !== null && typeof shape === 'object') {
    return fromObjectShape(shape)
  }
  return of(shape)
}

function h(...args) {
  return fromShape(args).pipe(map(args => React.createElement(...args)))
}

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
  let reducers$ = actionTypeList.map(key =>
    fromEvent(emitter, key).pipe(map(reducers[key]))
  )
  let state$ = merge(...reducers$).pipe(
    startWith(identity),
    scan((state, reducer) => reducer(state), preloadState),
    share()
  )
  return {
    state$: state$,
    action: createAction(actionTypeList, emitter)
  }
}

let toComponent = render => source =>
  source.pipe(switchMap(render), map(value => () => value))

function createCountStore() {
  let reducers = {
    incre: (n = 1) => count => count + n,
    decre: (n = 1) => count => count - n
  }
  let preloadState = 0
  return createStore(reducers, preloadState)
}

let store = createCountStore()

let Header$ = store.state$.pipe(
  map(Math.abs),
  map(count => count % 5),
  map(n => `h${n + 1}`)
)

// loading
let Loading$ = of(null).pipe(toComponent(() => <div>loading...</div>))

// suspend
let Incre$ = interval(1000).pipe(
  take(1),
  toComponent(() => (
    <button onClick={of(() => store.action.incre(1))}>+1</button>
  ))
)

let SuspendIncre$ = merge(Loading$, Incre$)

let app = (
  <div>
    <Header$>Count: {store.state$}</Header$>
    <SuspendIncre$ />
    <button onClick={() => store.action.decre(1)}>-1</button>
  </div>
)

app.subscribe(vdom => {
  ReactDOM.render(vdom, document.getElementById('root'))
})
store.state$.subscribe(count => console.log('count', count))
store.action.incre(1)
