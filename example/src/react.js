/** @jsx View.create */
import View, { renderTo, toComponent, component, createStore } from 'rx-view'
import { interval, of, merge, Observable, fromEvent, identity } from 'rxjs'
import { take, map, scan, switchMap, share, takeUntil, last, startWith, tap, catchError } from 'rxjs/operators'
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
	Observable.create(observer => {
		let instance = new Spring({ ...springOptions, ...options })
		instance.start()
		instance.onUpdate(data => observer.next(data.currentValue))
		instance.onStop(() => observer.complete())
		return () => instance.stop()
	})

const getEvent = event => (event.touches ? event.touches[0] : event)

const getPosition = event => {
	event = getEvent(event)
	return { left: event.clientX, top: event.clientY }
}

const getCoords = downEvent => {
	let start = getPosition(downEvent)
	return moveEvent => {
		let move = getPosition(moveEvent)
		return {
			left: move.left - start.left,
			top: move.top - start.top
		}
	}
}

const setTranslate = (elem, { left, top }) => {
	let translate = `translate(${left}px, ${top}px)`
	elem.style.transform = translate
	elem.style.webkitTransform = translate
}

function createDrag() {
	let defaultPosition = { left: 0, top: 0 }
	let emitter = new EventEmitter()
	let symbol = {
		start: Symbol('start'),
		move: Symbol('move'),
		end: Symbol('end')
	}
	let start$ = fromEvent(emitter, symbol.start) |> share()
	let move$ =
		merge(fromEvent(document, 'mousemove'), fromEvent(document, 'touchmove'), fromEvent(emitter, symbol.move))
		|> share()
	let end$ =
		merge(fromEvent(document, 'mouseup'), fromEvent(document, 'touchend'), fromEvent(emitter, symbol.end)) |> share()

	let makeSpring = ({ left, top }) => {
		let toPosition = ratio => ({
			left: left * ratio,
			top: top * ratio
		})
		return spring() |> takeUntil(start$) |> map(toPosition)
	}
	let makeMoving = downEvent => {
		let moving$ = move$ |> map(getCoords(downEvent)) |> takeUntil(end$)
		let spring$ = moving$ |> last() |> catchError(() => of(defaultPosition)) |> switchMap(makeSpring)
		return merge(moving$, spring$)
	}

	let coords$ = start$ |> switchMap(makeMoving) |> startWith(defaultPosition)

	let action = {
		start: value => emitter.emit(symbol.start, value),
		move: value => emitter.emit(symbol.move, value),
		end: value => emitter.emit(symbol.end, value)
	}

	return {
		state$: coords$,
		action
	}
}

let reducers = {
	incre: (n = 1) => count => count + n,
	decre: (n = 1) => count => count - n
}
let store = createStore(reducers, 0)

let Header$ = store.state$.pipe(map(Math.abs), map(count => count % 5), map(n => `h${n + 1}`))

// loading
let Loading$ = component(() => {
	return <div>loading...</div>
})

// suspend
let Incre$ = interval(1000).pipe(
	take(1),
	toComponent(() => {
		return <button onClick={() => store.action.incre(1)}>+1</button>
	})
)

let SuspendIncre$ = merge(Loading$, Incre$)
let spring$ = spring()
let springCount$ =
	store.state$
	|> scan((list, value) => [value, list[0]], [])
	|> switchMap(([current, previous]) => {
		if (previous != null) return spring$ |> map(ratio => previous + (current - previous) * ratio)
		return of(current)
	})

let drag = createDrag()
let Ball$ =
	drag.state$
	|> toComponent(({ left, top }) => {
		let translate = `translate(${left}px, ${top}px)`
		let style = { transform: translate, WebkitTransform: translate }
		return <div className="ball" style={style} onMouseDown={drag.action.start} onTouchStart={drag.action.start} />
	})
let app = (
	<div>
		<Header$>Count: {springCount$}</Header$>
		<SuspendIncre$ />
		<button onClick={() => store.action.decre(1)}>-1</button>
		<Ball$ />
	</div>
)
console.log('app', app)
app.pipe(renderTo('#root'))
store.state$.subscribe(count => console.log('count', count))
