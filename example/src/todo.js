import React from 'react'
import ReactDOM from 'react-dom'
import { reactive } from 'rx-view'
import {
  Observable,
  interval,
  Subject,
  ReplaySubject,
  merge,
  of,
  fromEvent
} from 'rxjs'
import {
  startWith,
  switchMap,
  mapTo,
  map,
  scan,
  publishReplay,
  refCount,
  debounceTime,
  tap,
  catchError,
  sample
} from 'rxjs/operators'
import { Spring } from 'wobble'
import EventEmitter from 'events'

const createToggler = status => {
  let options = {
    show: { fromValue: 0, toValue: 1 },
    hide: { fromValue: 1, toValue: 0 }
  }
  let emitter = new EventEmitter()
  let show$ = fromEvent(emitter, 'show')
  let hide$ = fromEvent(emitter, 'hide')
  let state$ =
    merge(show$, hide$)
    |> startWith({ options: status ? options.show : options.hide })
    |> switchMap(
      data => spring(data.options) |> tap({ complete: data.handler })
    )
    |> publishReplay(1)
    |> refCount()
  let show = callback => {
    emitter.emit('show', {
      options: options.show,
      handler: callback
    })
  }
  let hide = callback => {
    emitter.emit('hide', {
      options: options.hide,
      handler: callback
    })
  }
  return {
    state$,
    show,
    hide
  }
}

const springOptions = {
  fromValue: 1,
  toValue: 0,
  damping: 20,
  mass: 3
}

const spring = options => {
  return Observable.create(observer => {
    let instance = new Spring({ ...springOptions, ...options })
    instance.start()
    instance.onUpdate(data => {
      observer.next(data.currentValue)
    })
    instance.onStop(() => {
      observer.complete()
    })
    return () => instance.stop()
  })
}

class TodoApp extends React.PureComponent {
  state = {
    text: '',
    todos: []
  }
  uid = 0
  handleChange = event => {
    this.setState({
      text: event.target.value
    })
  }
  handleAdd = () => {
    if (!this.state.text) return
    let todo = {
      id: this.uid++,
      completed: false,
      text: this.state.text
    }
    let todos = this.state.todos.concat(todo)
    this.setState({ todos, text: '' })
  }
  handleRemove = id => {
    let todos = this.state.todos.filter(todo => todo.id !== id)
    this.setState({ todos })
  }
  handleToggle = id => {
    let todos = this.state.todos.map(
      todo => (todo.id !== id ? todo : { ...todo, completed: !todo.completed })
    )
    this.setState({ todos })
  }
  handleToggleAll = () => {
    let todos = this.state.todos.map(todo => ({
      ...todo,
      completed: !todo.completed
    }))
    this.setState({ todos })
  }
  render() {
    return (
      <div>
        <h1>Todo App</h1>
        <header>
          input:{' '}
          <input
            type="text"
            value={this.state.text}
            onChange={this.handleChange}
          />
          <button onClick={this.handleAdd}>add</button>
          <button onClick={this.handleToggleAll}>toggleAll</button>
        </header>
        {this.state.todos.map(todo => (
          <TodoItem$
            key={todo.id}
            {...todo}
            onToggle={this.handleToggle}
            onRemove={this.handleRemove}
          />
        ))}
      </div>
    )
  }
}

const toPercent = x => x * 100 + '%'

@reactive
class TodoItem$ extends React.PureComponent {
  timer$ = interval(10) |> publishReplay(1) |> refCount()
  toggler = createToggler(true)
  handleRemove = () => {
    let remove = value => this.props.onRemove(this.props.id)
    this.toggler.hide(remove)
  }
  handleToggle = () => {
    this.props.onToggle(this.props.id)
  }
  render() {
    let { props, state } = this
    let style = {
      position: 'relative',
      height: this.toggler.state$ |> map(value => value * 40),
      opacity: this.toggler.state$,
      backgroundColor: '#eaeaea',
      marginTop: 1,
      lineHeight: '40px'
    }
    return (
      <div data-id={props.id} style={style}>
        <div style={{ position: 'relative' }}>
          {props.text}{' '}
          <button onClick={this.handleToggle} data-id={this.props.id}>
            {props.completed ? 'completed' : 'active'}
          </button>{' '}
          <button onClick={this.handleRemove} data-id={this.props.id}>
            delete
          </button>
          {this.timer$}
        </div>
      </div>
    )
  }
}

ReactDOM.render(<TodoApp />, document.getElementById('root'))
