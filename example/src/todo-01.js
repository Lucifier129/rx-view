/** @jsx h */
import { h, RxComponent, renderTo, createStore } from 'rx-view'
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
  sample,
  distinctUntilChanged,
  toArray
} from 'rxjs/operators'

class Count extends RxComponent {
  // model/state
  incre$ = new Subject()
  decre$ = new Subject()
  count$ = merge(this.incre$ |> mapTo(1), this.decre$ |> mapTo(-1))
  |> startWith(this.props.count)
  |> scan((sum, n) => sum + n, 0)

  // controller/command
  handleIncre = () => {
    this.incre$.next()
  }
  handleDecre = () => {
    this.decre$.next()
  }

  // view
  view = (
    <div>
      <div>{this.count$}</div>
      <button onClick={this.handleIncre}>+1</button>
      <button onClick={this.handleDecre}>-1</button>
    </div>
  )
}

let Footer = ({ active$, completed$ }) => {
  return (
    <div>
      <span>left count: {active$}</span>
      <span>completed count: {completed$}</span>
    </div>
  )
}

class TodoList extends RxComponent {
  view = (
    <div>
      {this.props.list.map(todo => <TodoItem {...todo} key={todo.text} />)}
      <button onClick={handleAdd}>++++</button>
    </div>
  )
}

class TodoItem extends RxComponent {
  view = (
    <div>
      {this.props.text} timer {interval(10)}
    </div>
  )
}

let todoList$ = new Subject()

let count = 0
let list = []
let handleAdd = () => {
  list = list.concat({ text: count++ })
  if (list.length % 3 === 0) {
    list.sort(i => Math.random() - 0.5)
  }
  todoList$.next(list)
}

let loading = <div>loading...</div>

let app = (
  <div>
    <Count count={10} />
    <TodoList list={todoList$ |> startWith([])} />
    <Footer active$={interval(1000)} completed$={interval(2000)} />
  </div>
)

class TodoApp extends RxComponent {
  subjects = {
    text: new Subject(),
    add: new Subject(),
    remove: new Subject(),
    toggle: new Subject(),
    toggleAll: new Subject()
  }
  reducers = {
    add: 2
  }
  text$ = this.command.text
  todos$ = merge(
    this.command.text |> sample(this.command.add) |> map(text => state => state)
  )
  view = (
    <div>
      <TodoInput text$={this.text$} />
    </div>
  )
}

class TodoInput extends RxComponent {
  text$ = new Subject()
  handleChange = ({ currentTarget }) => {
    this.text$.next(currentTarget.value)
  }
  view = (
    <div>
      <input type="text" value={this.text$} onChange={this.handleChange} />
    </div>
  )
}

let appWithLoading = merge(loading, app)

appWithLoading |> renderTo('#root')
