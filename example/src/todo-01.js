import React from 'react'
import ReactDOM from 'react-dom'
import reactive from 'rx-view/reactive'
import { each } from 'rx-view/operators'
import { Observable, interval, Subject, ReplaySubject, merge, of } from 'rxjs'
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
		let todos = this.state.todos.map(todo => (todo.id !== id ? todo : { ...todo, completed: !todo.completed }))
		this.setState({ todos })
	}
	handleToggleAll = () => {
		let todos = this.state.todos.map(todo => ({ ...todo, completed: !todo.completed }))
		this.setState({ todos })
	}
	render() {
		return (
			<div>
				<h1>Todo App</h1>
				<header>
					input: <input type="text" value={this.state.text} onChange={this.handleChange} />
					<button onClick={this.handleAdd}>add</button>
					<button onClick={this.handleToggleAll}>toggleAll</button>
				</header>
				{this.state.todos.map(todo => (
					<TodoItem$ key={todo.id} {...todo} onToggle={this.handleToggle} onRemove={this.handleRemove} />
				))}
			</div>
		)
	}
}

const toPercent = x => x * 100 + '%'

@reactive
class TodoItem$ extends React.PureComponent {
	timer$ = interval(100) |> publishReplay(1) |> refCount()
	show$ = spring({ fromValue: 0, toValue: 1 }) |> publishReplay(1) |> refCount()
	hide$ = spring({ fromValue: 1, toValue: 0 }) |> publishReplay(1) |> refCount()
	showSlider$ = spring({ fromValue: 0, toValue: 1 })
	|> map(toPercent)
	|> publishReplay(1)
	|> refCount()
	|> tap(value => console.log('show', value))
	hideSlider$ = spring({ fromValue: 1, toValue: 0 })
	|> map(toPercent)
	|> publishReplay(1)
	|> refCount()
	|> tap(value => console.log('hide', value))
	state = {
		height$: this.show$,
		opacity$: this.show$,
		slideWidth$: this.props.completed ? this.showSlider$ : of(0)
	}
	componentDidUpdate(prevProps) {
		if (prevProps.completed !== this.props.completed) {
			let slideWidth$ = this.props.completed ? this.showSlider$ : this.hideSlider$
			this.setState({ slideWidth$ })
		}
	}
	handleRemove = () => {
		let { id, onRemove } = this.props
		let remove = () => onRemove(id)
		let height$ = this.hide$ |> tap({ complete: remove })
		let opacity$ = this.hide$
		this.setState({ height$, opacity$ })
	}
	handleToggle = () => {
		this.props.onToggle(this.props.id)
	}
	render() {
		let { props, state } = this
		let style = {
			position: 'relative',
			height: state.height$ |> map(value => value * 40),
			opacity: state.opacity$,
			backgroundColor: '#eaeaea',
			marginTop: 1,
			lineHeight: '40px'
		}
		let sliderStyle = {
			position: 'absolute',
			top: 0,
			left: 0,
			width: state.slideWidth$,
			height: '100%',
			backgroundColor: '#82d736'
		}
		return (
			<div data-id={props.id} style={style}>
				<div style={sliderStyle} />
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
