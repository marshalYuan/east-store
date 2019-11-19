import React, { useEffect } from 'react'
import classNames from 'classnames'
import { ITodo, appStore } from './store'
import { ENTER_KEY, ESCAPE_KEY } from './constants'

export const TodoItem = (props: {
  todo: ITodo
  editing: boolean
  onCancel: (e: any) => void
  onEdit: () => void
}) => {
  const [editText, setEditText] = React.useState(props.todo.title)
  const inputRef = React.useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (props.editing) {
      inputRef.current && inputRef.current.focus()
    }
  }, [props.editing])

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.keyCode === ESCAPE_KEY) {
      setEditText(props.todo.title)
      props.onCancel(event)
    } else if (event.keyCode === ENTER_KEY) {
      handleSubmit(event)
    }
  }
  function handleSubmit(event: React.FormEvent) {
    if (!props.editing) {
      return
    }
    var val = editText.trim()
    if (val) {
      appStore.getActions().save(props.todo.id, val)
      // setEditText(val);
    } else {
      appStore.getActions().destroy(props.todo)
    }
  }
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setEditText(event.target.value)
  }

  function handleEdit() {
    props.onEdit()
    setEditText(props.todo.title)
  }

  return (
    <li
      className={classNames({
        completed: props.todo.completed,
        editing: props.editing
      })}
    >
      <div className="view">
        <input
          className="toggle"
          type="checkbox"
          checked={props.todo.completed}
          onChange={() => appStore.getActions().toggle(props.todo)}
        />
        <label onDoubleClick={handleEdit}>{props.todo.title}</label>
        <button
          className="destroy"
          onClick={() => appStore.getActions().destroy(props.todo)}
        />
      </div>
      <input
        ref={inputRef}
        className="edit"
        value={editText}
        onBlur={handleSubmit}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </li>
  )
}
