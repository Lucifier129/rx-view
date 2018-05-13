import { combineLatest, of, isObservable, identity, noop } from 'rxjs'
import { map, tap } from 'rxjs/operators'

const fromArrayShape = array => {
  if (!array.length) return of(array)
  return combineLatest(...array.map(fromShape))
}
const fromObjectShape = obj => {
  let keys = Object.keys(obj)
  if (!keys.length) return of(obj)
  let sourceList = keys.map(key => fromShape(obj[key]))
  let construct = (result, value, index) => {
    result[keys[index]] = value
    return result
  }
  let toShape = valueList => {
    return valueList.reduce(construct, {})
  }
  return combineLatest(...sourceList).pipe(map(toShape))
}

export const fromShape = shape => {
  if (shape && isObservable(shape)) {
    return shape
  } else if (Array.isArray(shape)) {
    return fromArrayShape(shape)
  } else if (shape !== null && typeof shape === 'object') {
    return fromObjectShape(shape)
  }
  return of(shape)
}

export const isReactComponent = obj =>
  !!obj && !!obj.prototype && !!obj.prototype.isReactComponent

export const isRxComponent = obj =>
  !!obj && !!obj.prototype && !!obj.prototype.isRxComponent

export const isSource = obj => !!obj && isObservable(obj)
export const makeSource = obj => (isSource(obj) ? obj : of(obj))

export function shallowEqual(objA, objB) {
  if (objA === objB) {
    return true
  }

  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false
  }

  var keysA = Object.keys(objA)
  var keysB = Object.keys(objB)

  if (keysA.length !== keysB.length) {
    return false
  }

  // Test for A's keys different from B.
  for (var i = 0; i < keysA.length; i++) {
    if (keysA[i] === 'children') continue
    if (!objB.hasOwnProperty(keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
      return false
    }
  }

  return true
}
