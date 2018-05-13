import React from 'react'
import ReactDOM from 'react-dom'
import reactive from 'rx-view/react/reactive'
import { interval, Subject, merge, of } from 'rxjs'
import {
  startWith,
  mapTo,
  map,
  scan,
  publishReplay,
  refCount,
  debounceTime
} from 'rxjs/operators'

const timer$ = interval(10) |> startWith(0) |> publishReplay(1) |> refCount()

@reactive()
class App$ extends React.Component {
  static defaultProps = {
    step: 1
  }

  command = {
    incre: new Subject(),
    decre: new Subject()
  }

  count$ = merge(
    this.command.incre |> map(() => this.props.step),
    this.command.decre |> map(() => -this.props.step)
  )
  |> startWith(0)
  |> scan((sum, n) => sum - n, 0)
  |> publishReplay(1)
  |> refCount()

  handleIncre = () => {
    this.command.incre.next()
  }
  handleDecre = () => {
    this.command.decre.next()
  }

  render() {
    return (
      <div className="test">
        <h1>header: {timer$}</h1>
        <button onClick={this.handleIncre}>+1</button>
        <span>{this.count$}</span>
        <button onClick={this.handleDecre}>-1</button>
      </div>
    )
  }
}

ReactDOM.render(<App$ step={2} />, document.getElementById('root'))
