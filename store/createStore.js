import EventEmitter from 'events'
import { fromEvent, merge } from 'rxjs'
import { switchMap, scan, filter, map, startWith, publishReplay, refCount } from 'rxjs/operators'
import { isSource, makeSource } from '../src/shared'
import immer from 'immer'

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
				return makeSource(reducers[key](value))
			})
		)
	)
	let state$ = merge(...reducers$).pipe(
		scan(
			([state], reducer) => [
				immer(state, draft => {
					reducer(draft)
				}),
				state
			],
			[preloadState]
		),
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
