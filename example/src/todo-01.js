import React from 'react'
import ReactDOM from 'react-dom'
import toRxComponent from 'rx-view/react/toRxComponent'
import { interval, Subject, merge } from 'rxjs'
import { startWith, mapTo, scan, publishReplay, refCount, share } from 'rxjs/operators'

const timer$ = interval(10) |> startWith(0) |> publishReplay(1) |> refCount()

class App extends React.Component {
  static defaultProps = {
    step: 1
  }

  constructor(props) {
    super(props)
    console.log('constructor')
  }

  command = {
    incre: new Subject(),
    decre: new Subject()
  }

  count$ = merge(
    this.command.incre |> mapTo(this.props.step),
    this.command.decre |> mapTo(-this.props.step)
  )
  |> startWith(0)
  |> scan((sum, n) => sum - n, 0)

  handleIncre = () => {
    this.command.incre.next()
  }
  handleDecre = () => {
    this.command.decre.next()
  }

  componentWillUnmount() {
    console.log('unmount')
  }

  render() {
    console.log('render')
    return (
      <div className="test">
        <h1>header: {timer$}</h1>
        <button onClick={this.handleIncre}>+1</button>
        <div>Count: {this.count$}</div>
        <button onClick={this.handleDecre}>-1</button>
      </div>
    )
  }
}

let App$ = toRxComponent(App)

ReactDOM.render(<App$ step={2} />, document.getElementById('root'))

setTimeout(() => {
  ReactDOM.render(<App$ step={5} />, document.getElementById('root'))
}, 3000)
