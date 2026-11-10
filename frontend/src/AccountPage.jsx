import { useState } from 'react'
import './AccountPage.css'
import {
  bookingLabels,
  changeBookingStatus,
  formatStart,
  previewBookings,
  useBookingStatus,
  useScreenings,
} from './bookingPreview'

function BookingCard({ booking, statusLabel, children }) {
  return (
    <article className="account-booking">
      <div className="account-booking-top">
        <span className="account-label">Бронь №{booking.id}</span>
        <span className="account-status" role="status">{statusLabel}</span>
      </div>

      <h3>{booking.movieTitle}</h3>
      <p>
        <time dateTime={booking.startsAt}>{formatStart(booking.startsAt)}</time>
        {' · '}{booking.hallName}
      </p>
      <p className="muted">
        {booking.seats.map((seat) =>
          `Ряд ${seat.row}, место ${seat.number}`
        ).join(' · ')}
      </p>

      {children}
    </article>
  )
}

function PreviewBookingCard({ booking }) {
  const status = useBookingStatus(booking.id)
  const screenings = useScreenings()
  const [confirming, setConfirming] = useState(false)

  const entry = previewBookings.find((item) => item.id === booking.id)
  const screening = screenings.find((item) => item.id === entry?.screeningId)
  const details = screening ? {
    ...booking,
    movieTitle: screening.title,
    hallName: screening.hall,
    startsAt: screening.startsAt,
  } : booking

  const canCancel = status === 'pending' || status === 'approved'

  function requestCancellation() {
    changeBookingStatus(booking.id, 'cancel_requested')
    setConfirming(false)
  }

  return (
    <BookingCard booking={details} statusLabel={bookingLabels[status]}>
      {status === 'cancel_requested' && (
        <p className="muted">
          Запрос отправлен администратору. До подтверждения места остаются за тобой.
        </p>
      )}

      {canCancel && (
        confirming ? (
          <div>
            <p>Отправить запрос на отмену брони №{booking.id}?</p>
            <button
              type="button"
              className="button button-outline"
              onClick={() => setConfirming(false)}
            >
              Оставить бронь
            </button>
            {' '}
            <button
              type="button"
              className="button button-primary"
              onClick={requestCancellation}
            >
              Запросить отмену
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="button button-outline"
            onClick={() => setConfirming(true)}
          >
            Отменить бронь
          </button>
        )
      )}
    </BookingCard>
  )
}

export default function AccountPage({ user, bookings, preview = false }) {
  return (
    <main className="account-page">
      <div className="container">
        <a className="button button-outline" href="/#afisha">← К афише</a>

        <header className="account-heading">
          <p className="eyebrow">Кинотеатр «КАДР» / Зритель</p>
          <h1>Личный кабинет</h1>
          {preview && <p className="muted">Предпросмотр · тестовые данные</p>}
        </header>

        <section className="account-profile" aria-label="Данные зрителя">
          <div>
            <p className="account-label">Имя</p>
            <strong>{user.name}</strong>
          </div>
          <div>
            <p className="account-label">Электронная почта</p>
            <span>{user.email}</span>
          </div>
        </section>

        <section className="account-bookings">
          <h2>Мои бронирования</h2>

          {bookings.length === 0 && (
            <div className="account-empty">
              <h3>У тебя пока нет бронирований</h3>
              <p className="muted">Выбери фильм и сеанс в афише.</p>
              <a className="button button-primary" href="/#afisha">
                Смотреть афишу ↗
              </a>
            </div>
          )}

          {bookings.map((booking) => preview ? (
            <PreviewBookingCard key={booking.id} booking={booking} />
          ) : (
            <BookingCard
              key={booking.id}
              booking={booking}
              statusLabel={booking.statusLabel}
            />
          ))}
        </section>
      </div>
    </main>
  )
}