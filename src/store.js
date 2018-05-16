import { Subject, combineLatest } from 'rxjs'
import {} from 'rxjs/operators'
import { createStore, combineReducers } from 'redux'
import immer from 'immer'
import { isPlainObject, fromShape, fromArrayShape, fromObjectShape, isSource } from './shared'

const isSubject = obj => obj instanceof Subject

export const createReduxSubject = (SuperSubject = Subject) => {
	class ReduxSubject extends SuperSubject {
		constructor(reducer, preloadState) {
			super()
			this.store = createStore(createReducer(reducer), preloadState)
		}
		next(action) {
			this.store.dispatch(action)
			super.next(this.store.getState())
		}
	}
	return ReduxSubject
}

const createReducer = reducer => {
	if (isPlainObject(reducer)) reducer = combineReducers(reducer)
	return (state, action) => immer(draft => reducer(draft, action))
}

const combineArraySubjects = array => {
	let subjectList = array.filter(isSubject)
	let subject = new Subject()
	fromArrayShape(array).subscribe(subject)
	return subject
}

const combineSubjects = subjects => {}
