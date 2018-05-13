import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'
import { Subject, combineLatest } from 'rxjs'
import { startWith, switchMap, concatMap } from 'rxjs/operators'
import { makeSource, fromShape } from '../shared'

export default function toRxComponent(ReactComponent) {
  return class extends React.PureComponent {
    view = null
    renderer = new ShallowRenderer()
    subject = new Subject()
    props$ = this.subject |> startWith(this.props)
    view$ = this.props$.pipe(
      switchMap(props => {
        let vdom = this.renderer.render(<ReactComponent {...props} />)
        let vdom$ = fromShape(vdom)
        return vdom$
      })
    )
    subscription = this.view$.subscribe(view => {
      this.view = view
      if (this.mounted) this.forceUpdate()
    })
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
      this.subscription.unsubscribe()
      this.renderer.unmount(this.view)
    }
    render() {
      return this.view
    }
  }
}
