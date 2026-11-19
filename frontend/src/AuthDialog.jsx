import { useEffect, useRef, useState } from 'react'
import './AuthDialog.css'

export const AUTH_TOKEN_KEY = 'cinema.accessToken'
export const AUTH_CHANGED_EVENT = 'cinema-auth-changed'

export default function AuthDialog({ forBooking = false, onClose }) {
  const dialogRef = useRef(null)
  const requestRef = useRef(null)
  const submittingRef = useRef(false)

  const [mode, setMode] = useState('login')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const isLogin = mode === 'login'

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()

    return () => {
      requestRef.current?.abort()
      dialog.close()
    }
  }, [])

  function switchMode() {
    if (submittingRef.current) return
    setMode(isLogin ? 'register' : 'login')
    setMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submittingRef.current) return

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')
    const name = String(form.get('name') || '').trim()

    if (!isLogin && !name) {
      setMessage('Введите имя.')
      return
    }

    if (!isLogin && new TextEncoder().encode(password).length > 72) {
      setMessage('Пароль слишком длинный. Используйте более короткий пароль.')
      return
    }

    const controller = new AbortController()
    requestRef.current = controller
    submittingRef.current = true
    setBusy(true)
    setMessage('')

    try {
      const response = await fetch(
        isLogin ? '/api/auth/login' : '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isLogin ? { email, password } : { name, email, password }
          ),
          signal: controller.signal,
        }
      )

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Неверная почта или пароль.')
        }

        if (response.status === 409) {
          throw new Error('Аккаунт с такой почтой уже существует.')
        }

        if (response.status === 422) {
          throw new Error('Проверьте поля формы. Пароль при регистрации — от 6 символов.')
        }

        throw new Error('Сервер не смог выполнить запрос. Попробуйте ещё раз.')
      }

      if (!isLogin) {
        setMode('login')
        setMessage('Аккаунт создан. Теперь войдите с вашей почтой и паролем.')
        return
      }

      const data = await response.json()

      if (typeof data.access_token !== 'string' || !data.access_token) {
        throw new Error('Сервер не вернул токен входа.')
      }

      const userResponse = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
        },
        signal: controller.signal,
      })

      if (!userResponse.ok) {
        throw new Error('Не удалось получить данные пользователя. Попробуйте войти ещё раз.')
      }

      const user = await userResponse.json()

      if (!user.id || typeof user.role !== 'string') {
        throw new Error('Сервер вернул некорректные данные пользователя.')
      }

      sessionStorage.setItem(AUTH_TOKEN_KEY, data.access_token)
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
      onClose()
    } catch (error) {
      if (error.name === 'AbortError') return

      setMessage(
        error instanceof TypeError
          ? 'Нет связи с сервером. Проверьте, запущен ли бэкенд.'
          : error.message
      )
    } finally {
      submittingRef.current = false

      if (!controller.signal.aborted) {
        setBusy(false)
      }
    }
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
            <input
              name="name"
              autoComplete="given-name"
              maxLength={100}
              disabled={busy}
              required
            />
          </label>
        )}

        <label>
          Электронная почта
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={255}
            disabled={busy}
            required
          />
        </label>

        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={isLogin ? undefined : 6}
            maxLength={isLogin ? undefined : 72}
            disabled={busy}
            required
          />
        </label>

        <button
          type="submit"
          className="button button-primary"
          disabled={busy}
        >
          {busy
            ? 'Подождите…'
            : isLogin
              ? 'Войти'
              : 'Создать аккаунт'}
        </button>

        {message && <p role="status">{message}</p>}
      </form>

      <button
        type="button"
        className="auth-switch"
        onClick={switchMode}
        disabled={busy}
      >
        {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
      </button>
    </dialog>
  )
}