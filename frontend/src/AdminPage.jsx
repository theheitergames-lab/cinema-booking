import { useState } from 'react'
import './AdminPage.css'
import {
  bookingLabels,
  changeBookingStatus,
  formatStart,
  previewBookings,
  previewHalls,
  previewMovies,
  savePreviewScreening,
  useBookingStatus,
  useScreenings,
} from './bookingPreview'

function ScreeningForm({ screening, onClose, onSaved }) {
  const [title, setTitle] = useState(screening?.title ?? previewMovies[0].title)
  const [hall, setHall] = useState(screening?.hall ?? previewHalls[0])
  const [startsAt, setStartsAt] = useState(screening?.startsAt ?? '')
  const [error, setError] = useState('')

  function submit(event) {
    event.preventDefault()

    const movie = previewMovies.find((item) => item.title === title)
    const updated = screening
      ? { ...screening, startsAt }
      : { id: crypto.randomUUID(), title, hall, startsAt, duration: movie.duration }

    const message = savePreviewScreening(updated)
    if (message) {
      setError(message)
      return
    }

    const action = screening ? 'Сеанс перенесён' : 'Сеанс создан'
    onSaved(`${action}. «${updated.title}» — ${formatStart(startsAt)}.`)
  }

  return (
    <form
      className="admin-form"
      onSubmit={submit}
      onChange={() => setError('')}
    >
      {!screening && (
        <>
          <label>
            Фильм
            <select value={title} onChange={(event) => setTitle(event.target.value)}>
              {previewMovies.map((movie) => (
                <option key={movie.title} value={movie.title}>
                  {movie.title} · {movie.duration} мин
                </option>
              ))}
            </select>
          </label>

          <label>
            Зал
            <select value={hall} onChange={(event) => setHall(event.target.value)}>
              {previewHalls.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </>
      )}

      <label>
        Дата и время начала
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
          required
        />
      </label>

      {error && <p className="admin-error" role="alert">{error}</p>}

      <div className="admin-actions">
        <button type="submit" className="button button-primary">
          {screening ? 'Сохранить' : 'Создать сеанс'}
        </button>
        <button type="button" className="button button-outline" onClick={onClose}>
          Отмена
        </button>
      </div>
    </form>
  )
}

function AdminBookingCard({ booking, screening, onNotice }) {
  const status = useBookingStatus(booking.id)
  const cancellation = status === 'cancel_requested'
  const needsReview = status === 'pending' || cancellation

  function confirm() {
    const nextStatus = cancellation ? 'cancelled' : 'approved'
    if (changeBookingStatus(booking.id, nextStatus)) {
      onNotice(cancellation
        ? `Отмена брони №${booking.id} подтверждена.`
        : `Бронь №${booking.id} одобрена.`
      )
    }
  }

  return (
    <article className="admin-card">
      <div className="admin-card-header">
        <div>
          <p className="admin-booking-id">Бронь №{booking.id}</p>
          <h3>{screening.title}</h3>
        </div>
        <span className="admin-status">{bookingLabels[status]}</span>
      </div>

      <p>{booking.viewer}</p>
      <p className="muted">
        {formatStart(screening.startsAt)} · {screening.hall}
      </p>
      <p>
        {booking.seats.map((seat) =>
          `Ряд ${seat.row}, место ${seat.number}`
        ).join(' · ')}
      </p>

      {needsReview && (
        <button type="button" className="button button-primary" onClick={confirm}>
          {cancellation ? 'Подтвердить отмену' : 'Одобрить бронь'}
        </button>
      )}
    </article>
  )
}

export default function AdminPage() {
  const screenings = useScreenings()
  const [tab, setTab] = useState('screenings')
  const [editingId, setEditingId] = useState(null)
  const [notice, setNotice] = useState('')

  // В текущем предпросмотре одна бронь, общая с кабинетом зрителя.
  const previewStatus = useBookingStatus(previewBookings[0].id)
  const awaitingReview =
    previewStatus === 'pending' || previewStatus === 'cancel_requested'

  const orderedScreenings = [...screenings].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt)
  )

  function changeTab(nextTab) {
    setTab(nextTab)
    setEditingId(null)
    setNotice('')
  }

  function openForm(id) {
    setNotice('')
    setEditingId(id)
  }

  function finishEditing(message) {
    setEditingId(null)
    setNotice(message)
  }

  return (
    <main className="container admin-page">
      <a className="button button-outline" href="/#afisha">← К афише</a>

      <header className="admin-heading">
        <p className="eyebrow">Кинотеатр «КАДР»</p>
        <h1>Панель администратора</h1>
        <p className="muted">Предпросмотр · тестовые данные</p>
      </header>

      <nav className="admin-tabs" aria-label="Разделы администратора">
        <button
          type="button"
          className="button button-outline"
          aria-pressed={tab === 'screenings'}
          onClick={() => changeTab('screenings')}
        >
          Сеансы
        </button>
        <button
          type="button"
          className="button button-outline"
          aria-pressed={tab === 'bookings'}
          onClick={() => changeTab('bookings')}
        >
          Бронирования{awaitingReview && ' · 1 на проверке'}
        </button>
      </nav>

      <p className="admin-notice" role="status">{notice}</p>

      {tab === 'screenings' ? (
        <section className="admin-section">
          <h2>Расписание сеансов</h2>

          {editingId === 'new' ? (
            <div className="admin-card">
              <h3>Новый сеанс</h3>
              <ScreeningForm
                onClose={() => setEditingId(null)}
                onSaved={finishEditing}
              />
            </div>
          ) : (
            <button
              type="button"
              className="button button-primary"
              onClick={() => openForm('new')}
            >
              Создать сеанс
            </button>
          )}

          {orderedScreenings.map((screening) => (
            <article className="admin-card" key={screening.id}>
              <div className="admin-card-header">
                <div>
                  <h3>{screening.title}</h3>
                  <p className="muted">{screening.hall} · {screening.duration} мин</p>
                  <time dateTime={screening.startsAt}>
                    {formatStart(screening.startsAt)}
                  </time>
                </div>

                {editingId !== screening.id && (
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => openForm(screening.id)}
                  >
                    Изменить сеанс
                  </button>
                )}
              </div>

              {editingId === screening.id && (
                <ScreeningForm
                  screening={screening}
                  onClose={() => setEditingId(null)}
                  onSaved={finishEditing}
                />
              )}
            </article>
          ))}
        </section>
      ) : (
        <section className="admin-section">
          <h2>Бронирования зрителей</h2>

          {previewBookings.map((booking) => {
            const screening = screenings.find((item) => item.id === booking.screeningId)
            if (!screening) return null

            return (
              <AdminBookingCard
                key={booking.id}
                booking={booking}
                screening={screening}
                onNotice={setNotice}
              />
            )
          })}
        </section>
      )}
    </main>
  )
}