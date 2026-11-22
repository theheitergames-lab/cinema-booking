import { useRef, useState } from 'react'
import AuthDialog from './AuthDialog'
import BookingSuccess from './BookingSuccess'

export default function BookingReview({
  user,
  authStatus,
  movieTitle,
  screening,
  seats,
  seatIds = [],
  onBook,
  onBack,
  onBookingDone,
}) {
  const [showLogin, setShowLogin] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [bookingCreated, setBookingCreated] = useState(false)
  const [savedBooking, setSavedBooking] = useState(null)

  const submittingRef = useRef(false)

  const checkingAuth = authStatus === 'loading'
  const authFailed = authStatus === 'error'
  const isLoggedIn = Boolean(user)
  const bookingAvailable = typeof onBook === 'function'

  const price =
    savedBooking?.price_per_seat ?? screening.price

  const hasPrice = Number.isFinite(price) && price >= 0

  const estimatedTotal = hasPrice
    ? price * seatIds.length
    : null

  const totalPrice = Number.isFinite(savedBooking?.total_price)
    ? savedBooking.total_price
    : estimatedTotal

  const date = new Date(screening.startsAt).toLocaleDateString(
    'ru-RU',
    {
      day: 'numeric',
      month: 'long',
    }
  )

  async function handleBooking() {
    if (
      submittingRef.current ||
      checkingAuth ||
      authFailed ||
      bookingCreated
    ) {
      return
    }

    setError('')

    if (!isLoggedIn) {
      setShowLogin(true)
      return
    }

    if (!bookingAvailable) return

    if (!hasPrice) {
      setError(
        'Не удалось получить стоимость. Откройте сеанс заново.'
      )
      return
    }

    if (seatIds.length === 0) {
      setError('Выберите хотя бы одно место.')
      return
    }

    submittingRef.current = true
    setBusy(true)

    try {
      const booking = await onBook({
        screeningId: screening.id,
        seatIds,
      })

      setSavedBooking(booking)
      setBookingCreated(true)
      setShowSuccess(true)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Не удалось оформить бронирование. Попробуйте ещё раз.'
      )
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  const buttonLabel = checkingAuth
    ? 'Проверяем вход…'
    : busy
      ? 'Оформляем…'
      : bookingCreated
        ? 'Бронь оформлена'
        : isLoggedIn
          ? 'Забронировать'
          : 'Войти для бронирования'

  return (
    <section
      className="booking-review"
      aria-labelledby="booking-title"
    >
      <p className="eyebrow">Оформление бронирования</p>

      <h2 id="booking-title">
        Проверьте выбранные места
      </h2>

      <p>
        <strong>{movieTitle}</strong>
      </p>

      <p>
        {date} · {screening.startsAt.slice(11, 16)} ·{' '}
        {screening.hall}
      </p>

      <ul>
        {seats.map((id) => {
          const [row, number] = id.split('-')

          return (
            <li key={id}>
              Ряд {row}, место {number}
            </li>
          )
        })}
      </ul>

      {hasPrice ? (
        <div className="booking-price">
          <p>
            Цена одного места:{' '}
            {price.toLocaleString('ru-RU')} ₽
          </p>

          <p>Мест: {seatIds.length}</p>

          <p>
            <strong>
              К оплате в кинотеатре:{' '}
              {totalPrice.toLocaleString('ru-RU')} ₽
            </strong>
          </p>

          <p className="muted">
            Оплата билетов в кинотеатре.
            Онлайн-оплата не требуется.
          </p>
        </div>
      ) : (
        <p role="alert">
          Не удалось получить стоимость.
          Откройте сеанс заново.
        </p>
      )}

      {!bookingCreated && (
        <p className="muted">
          Места ещё не забронированы.
        </p>
      )}

      {authFailed && (
        <p role="alert">
          Не удалось проверить вход. Обновите страницу.
        </p>
      )}

      {isLoggedIn && !bookingAvailable && !checkingAuth && (
        <p className="muted">
          Бронирование временно недоступно.
          Попробуйте позже.
        </p>
      )}

      <button
        type="button"
        className="button button-primary"
        disabled={
          checkingAuth ||
          authFailed ||
          busy ||
          bookingCreated ||
          !hasPrice ||
          (isLoggedIn && !bookingAvailable)
        }
        onClick={handleBooking}
      >
        {buttonLabel}
      </button>

      {error && <p role="alert">{error}</p>}

      {!bookingCreated && (
        <button
          type="button"
          className="button button-outline"
          disabled={busy}
          onClick={onBack}
        >
          ← Изменить места
        </button>
      )}

      {showLogin && !isLoggedIn && (
        <AuthDialog
          forBooking
          onClose={() => setShowLogin(false)}
        />
      )}

      {showSuccess && (
        <BookingSuccess
          totalPrice={savedBooking?.total_price}
          onClose={() => {
            onBookingDone()
          }}
        />
      )}
    </section>
  )
}