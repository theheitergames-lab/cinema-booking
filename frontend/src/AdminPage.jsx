import { useState } from 'react'
import './AdminPage.css'

const initialScreenings = [
  {
    id: 1,
    title: 'Рататуй',
    hall: 'Панорамный зал',
    startsAt: '2026-11-14T14:00',
    duration: 111,
  },
  {
    id: 2,
    title: 'Интерстеллар',
    hall: 'Панорамный зал',
    startsAt: '2026-11-14T17:00',
    duration: 169,
  },
]

const initialBookings = [
  {
    id: 101,
    viewer: 'Анна Соколова',
    screeningId: 1,
    seats: 'Ряд 3 · места 5 и 6',
    approved: false,
  },
]

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

function formatStart(value) {
  return dateFormatter.format(new Date(value))
}

function overlaps(first, second) {
  const firstStart = new Date(first.startsAt).getTime()
  const secondStart = new Date(second.startsAt).getTime()
  const cleaningMinutes = 15
  const firstEnd = firstStart + (first.duration + cleaningMinutes) * 60_000
  const secondEnd = secondStart + (second.duration + cleaningMinutes) * 60_000

  return firstStart < secondEnd && secondStart < firstEnd
}

export default function AdminPage() {
  const [tab, setTab] = useState('screenings')
  const [screenings, setScreenings] = useState(initialScreenings)
  const [bookings, setBookings] = useState(initialBookings)
  const [editingId, setEditingId] = useState(null)
  const [draftStart, setDraftStart] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function changeTab(nextTab) {
    setTab(nextTab)
    setEditingId(null)
    setError('')
    setNotice('')
  }

  function startEditing(screening) {
    setEditingId(screening.id)
    setDraftStart(screening.startsAt)
    setError('')
    setNotice('')
  }

  function saveScreening(event, screening) {
    event.preventDefault()

    const updated = { ...screening, startsAt: draftStart }
    const conflict = screenings.find((other) =>
      other.id !== screening.id &&
      other.hall === screening.hall &&
      overlaps(updated, other)
    )

    if (conflict) {
      setError(
        `В это время зал занят. Проверь сеанс «${conflict.title}» ` +
        `(${formatStart(conflict.startsAt)}) и оставь 15 минут на уборку.`
      )
      return
    }

    setScreenings((current) =>
      current.map((item) => item.id === screening.id ? updated : item)
    )
    setEditingId(null)
    setError('')
    setNotice(`Изменения сохранены. «${screening.title}» — ${formatStart(draftStart)}.`)
  }

  function approveBooking(id) {
    setBookings((current) =>
      current.map((booking) =>
        booking.id === id ? { ...booking, approved: true } : booking
      )
    )
    setNotice(`Бронь №${id} одобрена.`)
  }

  const orderedScreenings = [...screenings].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt)
  )
  const pendingCount = bookings.filter((booking) => !booking.approved).length

  return (
    <main className="container admin-page">
      <a className="button button-outline" href="/#afisha">
        ← К афише
      </a>

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
          Бронирования{pendingCount > 0 && ` · ${pendingCount} на проверке`}
        </button>
      </nav>

      <p className="admin-notice" role="status">{notice}</p>

      {tab === 'screenings' ? (
        <section className="admin-section">
          <h2>Расписание сеансов</h2>

          {orderedScreenings.map((screening) => (
            <article className="admin-card" key={screening.id}>
              <div className="admin-card-header">
                <div>
                  <h3>{screening.title}</h3>
                  <p className="muted">
                    {screening.hall} · {screening.duration} мин
                  </p>
                  <time dateTime={screening.startsAt}>
                    {formatStart(screening.startsAt)}
                  </time>
                </div>

                {editingId !== screening.id && (
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => startEditing(screening)}
                  >
                    Изменить сеанс
                  </button>
                )}
              </div>

              {editingId === screening.id && (
                <form
                  className="admin-form"
                  onSubmit={(event) => saveScreening(event, screening)}
                >
                  <label>
                    Дата и время начала
                    <input
                      type="datetime-local"
                      value={draftStart}
                      required
                      autoFocus
                      onChange={(event) => {
                        setDraftStart(event.target.value)
                        setError('')
                      }}
                    />
                  </label>

                  {error && <p className="admin-error" role="alert">{error}</p>}

                  <div className="admin-actions">
                    <button type="submit" className="button button-primary">
                      Сохранить
                    </button>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => {
                        setEditingId(null)
                        setError('')
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))}
        </section>
      ) : (
        <section className="admin-section">
          <h2>Бронирования зрителей</h2>

          {bookings.map((booking) => {
            const screening = screenings.find((item) => item.id === booking.screeningId)

            return (
              <article className="admin-card" key={booking.id}>
                <div className="admin-card-header">
                  <div>
                    <p className="admin-booking-id">Бронь №{booking.id}</p>
                    <h3>{screening.title}</h3>
                  </div>
                  <span className="admin-status">
                    {booking.approved ? 'Одобрена' : 'Ожидает одобрения'}
                  </span>
                </div>

                <p>{booking.viewer}</p>
                <p className="muted">
                  {formatStart(screening.startsAt)} · {screening.hall}
                </p>
                <p>{booking.seats}</p>

                {!booking.approved && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => approveBooking(booking.id)}
                  >
                    Одобрить бронь
                  </button>
                )}
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}