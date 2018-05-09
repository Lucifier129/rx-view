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
	isObservable,
	identity,
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
	debounceTime
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

export const create = (...args) => {
	return fromShape(args).pipe(map(args => React.createElement(...args)))
}

export default { create }

export const renderTo = container => source => {
	container = typeof container === 'string' ? document.querySelector(container) : container
	let view$ = source.pipe(debounceTime(1000 / 60), observeOn(animationFrameScheduler))
	return view$.subscribe(view => {
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
	let reducers$ = actionTypeList.map(key => fromEvent(emitter, key).pipe(map(reducers[key])))
	let state$ = merge(...reducers$).pipe(
		startWith(identity),
		scan((state, reducer) => reducer(state), preloadState),
		publishReplay(1),
		refCount()
	)
	return {
		state$: state$,
		action: createAction(actionTypeList, emitter)
	}
}

export const toComponent = render => source => source.pipe(switchMap(render), map(value => () => value))

export const component = render => toComponent(render)(of({}))
