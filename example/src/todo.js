/** @jsx View.create */
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
	startWith,
	share,
	take,
	switchMap,
	publishReplay,
	tap,
	refCount,
	observeOn,
	debounceTime,
	filter
} from 'rxjs/operators'
import React from 'react'
import ReactDOM from 'react-dom'
import EventEmitter from 'events'
import { Spring } from 'wobble'

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

const spring$ = spring()

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

export const create = (type, props, ...children) => {
	if (type && type.isComponent) {
		return of({ ...props, children }) |> switchMap(type)
	} else {
		return fromShape([type, props].concat(children)).pipe(map(args => React.createElement(...args)))
	}
	return null
}

const View = { create }

export const renderTo = container => source => {
	container = typeof container === 'string' ? document.querySelector(container) : container
	return source.pipe(debounceTime(0)).subscribe(view => {
		ReactDOM.render(view, container)
	})
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

export const toComponent = render => source => source.pipe(switchMap(render), map(value => () => value))

class Component {
	constructor(render) {
		this.render = render
	}
}

export const component = render => {
	render.isComponent = true
	return render
}

export const render = factory => source =>
	source.pipe(
		switchMap(data => {
			return fromShape(factory(data))
		})
	)

export const runOnce = (f = noop) => source => source.pipe(take(1)).subscribe(f)
export const toHandler = (f = noop) => source => {
	let data$ = source.pipe(take(1))
	return (...args) => data$.subscribe(value => f(value, ...args))
}

const createListStore = (preloadState = []) => {
	let uid = 0
	let reducers = {
		add: data => state => state.concat({ $id: uid++, ...data }),
		remove: id => state => state.filter(item => item.$id !== id),
		update: ({ id, ...data }) => state => state.map(item => (item.$id !== id ? item : { ...item, ...data })),
		map: fn => state => state.map(fn),
		filter: fn => state => state.filter(fn)
	}
	return createStore(reducers, preloadState)
}

const createSingleStore = (selector = identity, preloadState) => {
	let reducers = {
		update: value => state => selector(value),
		replace: value => state => value
	}
	return createStore(reducers, preloadState)
}

const withPrevious = preloadValue => source =>
	source.pipe(scan(([previous], current) => [current, previous], [preloadValue]))

const isEqual = (a, b) => a === b
const immutable = (test = isEqual) => source =>
	source.pipe(
		withPrevious(),
		filter(([current, previous]) => !test(current, previous)),
		map(([current]) => current),
		publishReplay(1),
		refCount()
	)

const vsize$ = Observable.create(observer => {
	let next = () => observer.next({ vw: window.innerWidth, vh: window.innerHeight })
	let timer = null
	let listener = () => {
		clearTimeout(timer)
		timer = setTimeout(next, 200)
	}
	next()
	window.addEventListener('resize', listener, false)
	return () => window.removeEventListener('resize', listener, false)
}).pipe(immutable())

let todoStore = createListStore([])
let textStore = createSingleStore(event => event.target.value, '')
let todoList$ = todoStore.state$
let actived$ = todoList$ |> map(list => list.filter(item => !item.completed).length)
let completed$ = todoList$ |> map(list => list.filter(item => item.completed).length)
let text$ = textStore.state$

let handleTextChange = textStore.action.update
let handleUpdateTodo = todo => () => todoStore.action.update({ id: todo.$id, completed: !todo.completed })
let handleRemoveTodo = todo => () => todoStore.action.remove(todo.$id)
let handleAddTodo =
	text$
	|> toHandler(text => {
		if (text.length === 0) return 
		todoStore.action.add({ text, completed: false })
		textStore.action.replace('')
	})

let TodoList = component(({ todoList$, onUpdate, onRemove }) => (
	<div>
		{todoList$
			|> render(list => {
				return list.map((todo, index) => (
					<TodoItem key={todo.$id} index={index} todo={todo} onUpdate={onUpdate} onRemove={onRemove} />
				))
			})}
	</div>
))

let TodoItem = component(({ todo, index, onUpdate, onRemove }) => {
	let subject = new Subject()
	let style = {
		width: vw$ |> multiply(0.5),
		height: merge(of(40), subject),
		opacity: merge(of(1), subject |> map(value => value / 40)),
		margin: '0 auto',
		background: '#eaeaea',
		marginTop: 1
	}
	subject.subscribe({ complete: onRemove(todo) })
	return (
		<div data-id={todo.$id} style={style}>
			{todo.text} <span onClick={onUpdate(todo)}>{todo.completed ? 'ON' : 'OFF'}</span>{' '}
			<span
				onClick={() =>
					spring({
						fromValue: 40,
						toValue: 0,
						stiffness: 1000,
						damping: 500,
						mass: 3
					}).subscribe(subject)
				}
			>
				X
			</span>
		</div>
	)
})

let vw$ = vsize$ |> map(size => size.vw)
let vh$ = vsize$ |> map(size => size.vh)
let multiply = n => source => source |> map(value => value * n)

let springWithPrevious = () => source =>
	source.pipe(
		withPrevious(),
		switchMap(([current, previous]) => {
			if (previous == null) return of(current)
			return spring() |> map(ratio => previous + (current - previous) * ratio)
		})
	)

let Div = component(props => {
	let { width, height, ...rest } = props
	let width$ = width < 1 ? vw$ |> multiply(width) |> springWithPrevious() : width
	let height$ = height < 1 ? vh$ |> multiply(height) : height
	let style = { ...props.style, width: width$, height: height$ }
	return <div {...rest} style={style} />
})

let TodoInput = component(({ text$, onChange, onAdd }) => {
	let style = {
		margin: '0 auto',
		background: '#eaeaea'
	}
	return (
		<Div width={0.5} height={40} style={style}>
			text input: <input type="input" value={text$} onChange={onChange} />
			<button onClick={onAdd}>添加</button>
		</Div>
	)
})

let Footer = component(({ actived$, completed$ }) => {
	return (
		<div>
			<span>left count: {actived$}</span> <span>completed count: {completed$}</span>
		</div>
	)
})

let App = component(({ state, handlers }) => (
	<div>
		<TodoInput text$={state.text$} onChange={handlers.handleTextChange} onAdd={handlers.handleAddTodo} />
		<TodoList todoList$={state.todoList$} onUpdate={handlers.handleUpdateTodo} onRemove={handlers.handleRemoveTodo} />
		<Footer actived$={state.actived$} completed$={state.completed$} />
	</div>
))

console.dir(App)

let app = (
	<App
		state={{ text$, todoList$, actived$, completed$ }}
		handlers={{ handleTextChange, handleAddTodo, handleUpdateTodo, handleRemoveTodo }}
	/>
)

app |> renderTo('#root')
