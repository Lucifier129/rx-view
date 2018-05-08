import { log, logValue, logAll, guard, noop } from 'sukkula/src/utility'
import {
  create,
  interval,
  fromArray,
  fromRange,
  fromEvent
} from 'sukkula/src/source'
import { onStart, onNext, onFinish, run, pullable } from 'sukkula/src/sink'
import {
  map,
  mapTo,
  filter,
  take,
  takeUntil,
  merge,
  mergeWith,
  concat,
  combine,
  combineObject,
  switchMap,
  startWith,
  takeLast,
  then
} from 'sukkula/src/operator'
import { Spring } from 'wobble'
import EventEmitter from 'events'

const springOptions = {
  fromValue: 1,
  toValue: 0,
  stiffness: 1000,
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

const getEvent = event => (event.touches ? event.touches[0] : event)

const getCoords = downEvent => {
  downEvent = getEvent(downEvent)
  let startX = downEvent.clientX
  let startY = downEvent.clientY
  return moveEvent => {
    moveEvent.preventDefault()
    moveEvent = getEvent(moveEvent)
    return {
      left: moveEvent.clientX - startX,
      top: moveEvent.clientY - startY
    }
  }
}

const setTranslate = (elem, { left, top }) => {
  let translate = `translate(${left}px, ${top}px)`
  elem.style.transform = translate
  elem.style.webkitTransform = translate
}

function drag() {
  let emitter = new EventEmitter()
  let symbol = {
    start: Symbol('start'),
    move: Symbol('move'),
    end: Symbol('end')
  }
  let start$ = fromEvent(emitter, symbol.start)
  let move$ = fromEvent(emitter, symbol.move)
  let end$ = fromEvent(emitter, symbol.end)

  let makeSpring = ({ left, top }) => {
    let toPosition = ratio => ({
      left: left * ratio,
      top: top * ratio
    })
    return spring() |> takeUntil(start$) |> map(toPosition)
  }
  let makeMoving = downEvent =>
    move$ |> map(getCoords(downEvent)) |> takeUntil(end$) |> then(makeSpring)

  let coords$ =
    start$ |> switchMap(makeMoving) |> startWith({ left: 0, top: 0 })

  let handler = {
    start: value => emitter.emit(symbol.start, value),
    move: value => emitter.emit(symbol.move, value),
    end: value => emitter.emit(symbol.end, value)
  }

  return {
    data$: coords$,
    handler,
    emitter,
    symbol
  }
}

function dragBall(elem) {
  let { data$, handler } = drag()
  let options = { passive: false }

  fromEvent(elem, 'mousedown', options) |> run(handler.start)
  fromEvent(document, 'mousemove', options) |> run(handler.move)
  fromEvent(document, 'mouseup', options) |> run(handler.end)

  fromEvent(elem, 'touchstart', options) |> run(handler.start)
  fromEvent(document, 'touchmove', options) |> run(handler.move)
  fromEvent(document, 'touchend', options) |> run(handler.end)

  data$
    |> run(({ left, top }) => {
      let styleValue = `translate(${left}px, ${top}px)`
      elem.style.transform = styleValue
      elem.style.webkitTransform = styleValue
    })
}

dragBall(document.querySelector('.ball'))
