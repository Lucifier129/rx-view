import React from 'react'
import { of } from 'rxjs'
import { map } from 'rxjs/operators'
import { fromShape, isRxComponent, isReactComponent, rx2react } from '../shared'

export const createElement = (...args) => {
  if (isRxComponent(args[0])) {
    let ReactComponent = rx2react(args[0])
    return of(React.createElement(ReactComponent, ...args.slice(1)))
  }
  if (!isReactComponent(args[0]) && typeof args[0] === 'function') {
    let [type, props, ...children] = args
    return type({ ...props, children })
  }
  return fromShape(args) |> map(toReactElement)
}

const toReactElement = args => React.createElement(...args)
