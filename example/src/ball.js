import { Observable, fromEvent, merge, concat } from 'rxjs'
import { map, mapTo, take, takeLast, takeUntil, switchMap, startWith, share, last } from 'rxjs/operators'
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
	let start$ = fromEvent(emitter, symbol.start) |> share()
	let move$ = fromEvent(emitter, symbol.move) |> share()
	let end$ = fromEvent(emitter, symbol.end) |> share()

	let makeSpring = ({ left, top }) => {
		let toPosition = ratio => ({
			left: left * ratio,
			top: top * ratio
		})
		return spring() |> takeUntil(start$) |> map(toPosition)
	}
	let makeMoving = downEvent => {
		let moving$ = move$ |> map(getCoords(downEvent)) |> takeUntil(end$)
		let spring$ = moving$ |> last() |> switchMap(makeSpring)
		return merge(moving$, spring$)
	}

	let coords$ = start$ |> switchMap(makeMoving) |> startWith({ left: 0, top: 0 })

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

	fromEvent(elem, 'mousedown', options).subscribe(handler.start)
	fromEvent(document, 'mousemove', options).subscribe(handler.move)
	fromEvent(document, 'mouseup', options).subscribe(handler.end)

	fromEvent(elem, 'touchstart', options).subscribe(handler.start)
	fromEvent(document, 'touchmove', options).subscribe(handler.move)
	fromEvent(document, 'touchend', options).subscribe(handler.end)

	data$.subscribe(({ left, top }) => {
		let styleValue = `translate(${left}px, ${top}px)`
		elem.style.transform = styleValue
		elem.style.webkitTransform = styleValue
	})
}

dragBall(document.querySelector('.ball'))
