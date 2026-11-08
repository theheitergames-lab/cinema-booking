import { useEffect, useRef, useState } from 'react'
import './AuthDialog.css'

export default function AuthDialog({ forBooking = false, onClose }) {
  const dialogRef = useRef(null)
  const [mode, setMode] = useState('login')
  const [message, setMessage] = useState('')

  const isLogin = mode === 'login'

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  function switchMode() {
    setMode(isLogin ? 'register' : 'login')
    setMessage('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    setMessage(
      isLogin
        ? 'Вход пока не подключён к серверу.'
        : 'Регистрация пока не подключена к серверу.'
    )
  }

  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      aria-labelledby="auth-title"
      onCancel={onClose}
    >
      <button type="button" className="auth-close" onClick={onClose}>
        Закрыть ✕
      </button>

      <p className="eyebrow">Кинотеатр «КАДР»</p>
      <h2 id="auth-title">{isLogin ? 'Вход' : 'Регистрация'}</h2>

      {forBooking && (
        <p className="auth-hint">
          Войдите, чтобы продолжить бронирование выбранных мест.
        </p>
      )}

      <form key={mode} className="auth-form" onSubmit={handleSubmit}>
        {!isLogin && (
          <label>
            Имя
            <input name="name" autoComplete="given-name" required />
          </label>
        )}

        <label>
          Электронная почта
          <input name="email" type="email" autoComplete="email" required />
        </label>

        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            required
          />
        </label>

        <button type="submit" className="button button-primary">
          {isLogin ? 'Войти' : 'Создать аккаунт'}
        </button>

        {message && <p role="status">{message}</p>}
      </form>

      <button type="button" className="auth-switch" onClick={switchMode}>
        {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
      </button>
    </dialog>
  )
}