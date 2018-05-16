import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'

class Timer extends React.Component {
	state = {
		count: 0
	}
	componentDidMount() {
		console.log('didMount')
		this.timer = setInterval(() => {
			this.setState({ count: this.state.count + 1 })
		}, this.props.period || 1000)
	}
	componentWillUnmount() {
		console.log('unmount')
		clearInterval(this.timer)
	}
	render() {
		return this.state.count
	}
}

class App extends React.Component {
	constructor(props) {
		super(props)
		console.log('constructor')
	}
	state = {
		count: 0
	}
	handleIncre = () => {
		this.setState({
			count: this.state.count + 1
		})
	}
	handleDecre = () => {
		this.setState({
			count: this.state.count - 1
		})
	}
	componentDidMount() {
		console.log('didMount')
	}
	componentWillUnmount() {
		console.log('will unmount')
	}
	componentDidUpdate() {
		console.log('did update')
	}
	render() {
		return (
			<div className="test">
				<h1>
					header: <Timer />
				</h1>
				<button onClick={this.handleIncre}>+1</button>
				<div>Count: {this.state.count}</div>
				<button onClick={this.handleDecre}>-1</button>
			</div>
		)
	}
}

const renderer = new ShallowRenderer()
let app = renderer.render(<App />)

const Test = () => <div>test</div>

setTimeout(() => {
	console.log(renderer.render(<Test />))
}, 2000)
