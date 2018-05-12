import {
  Observable,
  merge,
  concat,
  combineLatest,
  Subject,
  interval,
  fromEvent,
  of,
  pipe,
  from,
  isObservable,
  identity,
  noop,
  animationFrameScheduler
} from 'rxjs'
import {
  scan,
  map,
  mapTo,
  startWith,
  concatMap,
  share,
  take,
  switchMap,
  publishReplay,
  tap,
  refCount,
  observeOn,
  debounceTime,
  filter,
  distinctUntilChanged,
  toArray
} from 'rxjs/operators'
import React from 'react'
import ReactDOM from 'react-dom'
import EventEmitter from 'events'
import { Spring } from 'wobble'

const fromArrayShape = array => {
  if (!array.length) return of(array)
  return combineLatest(...array.map(fromShape))
}
const fromObjectShape = obj => {
  let keys = Object.keys(obj)
  if (!keys.length) return of(obj)
  let sourceList = keys.map(key => fromShape(obj[key]))
  let construct = (result, value, index) => {
    result[keys[index]] = value
    return result
  }
  let toShape = valueList => {
    return valueList.reduce(construct, {})
  }
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

const isReactComponent = obj =>
  !!obj && !!obj.prototype && !!obj.prototype.isReactComponent

export const h = (...args) => {
  if (isRxComponent(args[0])) {
    return h(rx2react(args[0]), ...args.slice(1))
  }
  if (!isReactComponent(args[0]) && typeof args[0] === 'function') {
    let [type, props, ...children] = args
    return type({ ...props, children })
  }
  return fromShape(args) |> map(args => React.createElement(...args))
}

export const renderTo = container => source => {
  container =
    typeof container === 'string'
      ? document.querySelector(container)
      : container
  return source.pipe(debounceTime(0)).subscribe(view => {
    ReactDOM.render(view, container)
  })
}

let cache = [[], []]
const rx2react = type => {
  let index = cache[0].indexOf(type)
  if (index !== -1) {
    console.log('hit')
    return cache[1][index]
  }
  let Component = toReactComponent((_, props) => {
    let instance = new type(props)
    return instance.view
  })(of(null))
  cache[0].push(type)
  cache[1].push(Component)
  return Component
}

export class RxComponent {
  constructor(props) {
    this.props = props
  }
}

const isRxComponent = obj => RxComponent.isPrototypeOf(obj)

const isSource = obj => !!obj && isObservable(obj)
const makeSource = obj => (isSource(obj) ? obj : of(obj))

const toReactComponent = (f = identity) => source => {
  return class extends React.PureComponent {
    state = { view: null }
    subject = new Subject()
    props$ = this.subject |> startWith(this.props)
    data$ = source |> distinctUntilChanged(shallowEqual)
    view$ = combineLatest(this.data$, this.props$).pipe(
      switchMap(([data, props]) => makeSource(f(data, props)))
    )
    unsubscribe = this.view$.subscribe(view => {
      if (this.mounted) {
        this.setState({ view })
      } else {
        this.state = { view }
      }
    }).unsubscribe
    mounted = false
    componentDidMount() {
      this.mounted = true
    }
    componentDidUpdate(prevProps) {
      if (prevProps !== this.props) {
        this.subject.next(this.props)
      }
    }
    componentWillUnmount() {
      this.unsubscribe()
    }

    render() {
      return this.state.view
    }
  }
}

function shallowEqual(objA, objB) {
  if (objA === objB) {
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

  var keysA = Object.keys(objA)
  var keysB = Object.keys(objB)

  if (keysA.length !== keysB.length) {
    return false
  }

  // Test for A's keys different from B.
  for (var i = 0; i < keysA.length; i++) {
    if (keysA[i] === 'children') continue
    if (!objB.hasOwnProperty(keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
      return false
    }
  }

  return true
}

const createAction = (actionTypeList, emitter) => {
  return actionTypeList.reduce((result, key) => {
    result[key] = payload => emitter.emit(key, payload)
    return result
  }, {})
}

export const createStore = (reducers, preloadState) => {
  let emitter = new EventEmitter()
  let actionTypeList = Object.keys(reducers)
  let reducers$ = actionTypeList.map(key =>
    fromEvent(emitter, key).pipe(
      switchMap(value => {
        let result = reducers[key](value)
        return result && isObservable(result) ? result : of(result)
      })
    )
  )
  let state$ = merge(...reducers$).pipe(
    scan(([state], reducer) => [reducer(state), state], [preloadState]),
    filter(([current, previous]) => current !== previous),
    map(([current]) => current),
    startWith(preloadState),
    publishReplay(1),
    refCount()
  )
  return {
    state$: state$,
    action: createAction(actionTypeList, emitter)
  }
}
