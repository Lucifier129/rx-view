import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'
import { Subject, combineLatest, noop } from 'rxjs'
import { startWith, switchMap } from 'rxjs/operators'
import { makeSource, fromShape } from '../shared'

const defaults = { period: 0 }
const reactive = options => ReactComponent => {
  let settings = { ...defaults, ...options }
  return class extends React.PureComponent {
    view = null
    timer = null
    mounted = false
    subscriptions = []
    renderer = new ShallowRenderer()
    subject = new Subject()
    props$ = this.subject |> startWith(this.props)
    view$ = this.props$.pipe(
      switchMap(props => {
        let vdom = this.renderer.render(<ReactComponent {...props} />)
        let vdom$ = fromShape(vdom)
        this.subscriptions.push(vdom$.subscribe(noop))
        return vdom$
      })
    )
    subscription = this.view$.subscribe(view => {
      this.view = view
      if (this.mounted) {
        clearInterval(this.timer)
        this.timer = setTimeout(this.refresh, settings.period)
      }
    })
    refresh = () => this.forceUpdate()
    componentDidMount() {
      this.mounted = true
    }
    componentDidUpdate(prevProps) {
      while (this.subscriptions.length > 1) {
        this.subscriptions.shift().unsubscribe()
      }
      if (prevProps !== this.props) {
        this.subject.next(this.props)
      }
    }
    componentWillUnmount() {
      this.subscription.unsubscribe()
      this.subscriptions.forEach(subscription => subscription.unsubscribe())
      this.renderer.unmount(this.view)
    }
    render() {
      return this.view
    }
  }
}

export default reactive
