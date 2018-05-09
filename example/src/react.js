/** @jsx View.create */
import View, { renderTo, toComponent, component, createStore } from 'rx-view'
import { interval, of, merge } from 'rxjs'
import { take, map } from 'rxjs/operators'

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

let app = (
	<div>
		<Header$>Count: {store.state$}</Header$>
		<SuspendIncre$ />
		<button onClick={() => store.action.decre(1)}>-1</button>
	</div>
)
console.log('app', app)
app.pipe(renderTo('#root'))
store.state$.subscribe(count => console.log('count', count))
