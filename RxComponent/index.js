import React from 'react'
import { Subject, combineLatest } from 'rxjs'
import { distinctUntilChanged, startWith, switchMap } from 'rxjs/operators'
import { makeSource } from '../shared'

export class RxComponent {
  constructor(props) {
    this.props = props
  }
  render() {
    return null
  }
}

RxComponent.prototype.isRxComponent = true

let cache = [[], []]
const rx2react = type => {
  let index = cache[0].indexOf(type)
  if (index !== -1) {
    return cache[1][index]
  }
  let ReactComponent = createReactComponent(type)
  cache[0].push(type)
  cache[1].push(ReactComponent)
  return ReactComponent
}

const createReactComponent = Type =>
  class extends React.PureComponent {
    state = { view: null }
    subject = new Subject()
    instance = new Type(this.props)
    view$ = makeSource(this.instance.render())
    unsubscribe = this.view$.subscribe(view => {
      if (this.mounted) {
        this.setState({ view })
      } else {
        this.state = { view }
      }
    }).unsubscribe
    mounted = false
    componentDidMount() {
      this.mounted = true
    }
    componentDidUpdate(prevProps) {
      if (prevProps !== this.props) {
        this.subject.next(this.props)
      }
    }
    componentWillUnmount() {
      this.unsubscribe()
    }
    render() {
      return this.state.view
    }
  }

const toReactComponent = (f = identity) => source => {
  return class extends React.PureComponent {
    state = { view: null }
    subject = new Subject()
    props$ = this.subject |> startWith(this.props)
    data$ = source |> distinctUntilChanged(shallowEqual)
    view$ = combineLatest(this.data$, this.props$).pipe(
      switchMap(([data, props]) => makeSource(f(data, props)))
    )
    unsubscribe = this.view$.subscribe(view => {
      if (this.mounted) {
        this.setState({ view })
      } else {
        this.state = { view }
      }
    }).unsubscribe
    mounted = false
    componentDidMount() {
      this.mounted = true
    }
    componentDidUpdate(prevProps) {
      if (prevProps !== this.props) {
        this.subject.next(this.props)
      }
    }
    componentWillUnmount() {
      this.unsubscribe()
    }

    render() {
      return this.state.view
    }
  }
}
