import ReactDOM from 'react-dom'

const render = (source, container) => {
  source.pipe(debounceTime(0)).subscribe(view => {
    ReactDOM.render(view, container)
  })
}

export default {
  ...ReactDOM,
  render
}
