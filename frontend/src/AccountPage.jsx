import { useState } from 'react'
import './AccountPage.css'

const PAGE_SIZE = 5

const FILTERS = [
  { id: 'upcoming', label: 'Предстоящие' },
  { id: 'past', label: 'Прошедшие' },
  { id: 'cancelled', label: 'Отменённые' },
]

const STATUS_LABELS = {
  active: 'Бронь оформлена',
  cancel_requested: 'Ожидает отмены',
  cancelled: 'Бронь отменена',
  completed: 'Завершена',
}

function formatStart(value) {
  return new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getBookingGroup(booking, now) {
  if (booking.status === 'cancelled') return 'cancelled'

  return new Date(booking.startsAt).getTime() > now
    ? 'upcoming'
    : 'past'
}

// Только для отдельного предпросмотра интерфейса.
function createPreviewBookings() {
  function dateAt(offset, hour) {
    const date = new Date()
    date.setDate(date.getDate() + offset)
    date.setHours(hour, 0, 0, 0)

    return date.toISOString()
  }

  return [
    {
      id: 101,
      movieTitle: 'Гарри Поттер и философский камень',
      startsAt: dateAt(1, 19),
      hallName: 'Панорамный зал',
      status: 'active',
      seats: [
        { row: 5, number: 7 },
        { row: 5, number: 8 },
      ],
    },
    {
      id: 102,
      movieTitle: 'Рататуй',
      startsAt: dateAt(2, 14),
      hallName: 'Панорамный зал',
      status: 'active',
      seats: [{ row: 3, number: 5 }],
    },
    {
      id: 103,
      movieTitle: 'Интерстеллар',
      startsAt: dateAt(3, 18),
      hallName: 'Панорамный зал',
      status: 'cancel_requested',
      seats: [{ row: 4, number: 6 }],
    },
    {
      id: 104,
      movieTitle: 'Начало',
      startsAt: dateAt(-2, 18),
      hallName: 'Панорамный зал',
      status: 'active',
      seats: [{ row: 2, number: 4 }],
    },
    {
      id: 105,
      movieTitle: 'ВАЛЛ·И',
      startsAt: dateAt(4, 16),
      hallName: 'Панорамный зал',
      status: 'cancelled',
      seats: [{ row: 6, number: 7 }],
    },
    {
      id: 106,
      movieTitle: 'Зверополис',
      startsAt: dateAt(4, 15),
      hallName: 'Панорамный зал',
      status: 'active',
      seats: [{ row: 3, number: 8 }],
    },
    {
      id: 107,
      movieTitle: 'Вверх',
      startsAt: dateAt(5, 17),
      hallName: 'Панорамный зал',
      status: 'active',
      seats: [{ row: 4, number: 9 }],
    },
    {
      id: 108,
      movieTitle: 'Король Лев',
      startsAt: dateAt(6, 13),
      hallName: 'Панорамный зал',
      status: 'active',
      seats: [{ row: 2, number: 6 }],
    },
  ]
}

function BookingCard({ booking, group, onRequestCancellation }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canCancel =
    group === 'upcoming' &&
    booking.status === 'active' &&
    typeof onRequestCancellation === 'function'

  const statusLabel =
    STATUS_LABELS[booking.status] ||
    booking.statusLabel ||
    'Статус неизвестен'

  async function requestCancellation() {
    if (busy) return

    setBusy(true)
    setError('')

    try {
      await onRequestCancellation(booking.id)
      setConfirming(false)
    } catch {
      setError('Не удалось отправить запрос на отмену. Попробуй ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="account-booking">
      <div className="account-booking-top">
        <span className="account-label">Бронь №{booking.id}</span>

        <span
          className={`account-status account-status-${booking.status}`}
        >
          {statusLabel}
        </span>
      </div>

      <h3>{booking.movieTitle}</h3>

      <p>
        <time dateTime={booking.startsAt}>
          {formatStart(booking.startsAt)}
        </time>
        {' · '}
        {booking.hallName}
      </p>

      <p className="muted">
        {booking.seats
          .map((seat) => `Ряд ${seat.row}, место ${seat.number}`)
          .join(' · ')}
      </p>

      {group === 'past' && (
        <p className="muted">Сеанс уже начался или завершился.</p>
      )}

      {booking.status === 'cancel_requested' && (
        <p className="muted">
          Запрос на отмену отправлен администратору.
          До подтверждения отмены места остаются за тобой.
        </p>
      )}

      {canCancel && (
        confirming ? (
          <div className="account-cancel">
            <p>Отправить запрос на отмену брони №{booking.id}?</p>

            <div className="account-actions">
              <button
                type="button"
                className="button button-outline"
                disabled={busy}
                onClick={() => {
                  setConfirming(false)
                  setError('')
                }}
              >
                Оставить бронь
              </button>

              <button
                type="button"
                className="button button-primary"
                disabled={busy}
                onClick={requestCancellation}
              >
                {busy ? 'Отправляем…' : 'Запросить отмену'}
              </button>
            </div>

            {error && <p role="alert">{error}</p>}
          </div>
        ) : (
          <button
            type="button"
            className="button button-outline account-cancel-button"
            onClick={() => setConfirming(true)}
          >
            Отменить бронь
          </button>
        )
      )}
    </article>
  )
}

export default function AccountPage({
  user,
  bookings = null,
  preview = false,
  onRequestCancellation,
  onGoToAfisha,
}) {
  const [filter, setFilter] = useState('upcoming')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const [demoBookings, setDemoBookings] = useState(() => {
    if (!preview || bookings?.length === 0) return []
    return createPreviewBookings()
  })

  const source = preview ? demoBookings : bookings
  const bookingsAvailable = Array.isArray(source)
  const allBookings = bookingsAvailable ? source : []

  const now = Date.now()
  const query = search.trim().toLowerCase()

  const filteredBookings = allBookings
    .filter((booking) => {
      const matchesGroup = getBookingGroup(booking, now) === filter
      const matchesSearch =
        booking.movieTitle.toLowerCase().includes(query)

      return matchesGroup && matchesSearch
    })
    .sort((first, second) => {
      const difference =
        new Date(first.startsAt).getTime() -
        new Date(second.startsAt).getTime()

      return filter === 'upcoming' ? difference : -difference
    })

  const visibleBookings = filteredBookings.slice(0, visibleCount)

  function selectFilter(value) {
    setFilter(value)
    setVisibleCount(PAGE_SIZE)
  }

  function changeSearch(value) {
    setSearch(value)
    setVisibleCount(PAGE_SIZE)
  }

  function requestPreviewCancellation(id) {
    setDemoBookings((current) =>
      current.map((booking) =>
        booking.id === id
          ? { ...booking, status: 'cancel_requested' }
          : booking
      )
    )
  }

  const cancellationHandler = preview
    ? requestPreviewCancellation
    : onRequestCancellation

  return (
    <main className="account-page">
      <div className="container">
        <header className="account-heading">
          <p className="eyebrow">Кинотеатр «КАДР»</p>
          <h1>Личный кабинет</h1>

          {preview && (
            <p className="muted">
              Предпросмотр · тестовые данные.
              Изменения не отправляются на сервер.
            </p>
          )}
        </header>

        <section className="account-profile" aria-label="Данные профиля">
          <div>
            <p className="account-label">Имя</p>
            <strong>{user.name}</strong>
          </div>

          <div>
            <p className="account-label">Электронная почта</p>
            <span>{user.email}</span>
          </div>
        </section>

        <section
          className="account-bookings"
          aria-labelledby="account-bookings-title"
        >
          <h2 id="account-bookings-title">Мои бронирования</h2>

          {!bookingsAvailable ? (
            <div className="account-empty" role="status">
              <h3>Бронирования пока недоступны</h3>
              <p className="muted">
                Сейчас мы не можем показать список твоих бронирований.
              </p>
            </div>
          ) : allBookings.length === 0 ? (
            <div className="account-empty">
              <h3>У тебя пока нет бронирований</h3>
              <p className="muted">Выбери фильм и сеанс в афише.</p>

              <a
                className="button button-primary"
                href="/#afisha"
                onClick={onGoToAfisha}
              >
                Смотреть афишу ↗
              </a>
            </div>
          ) : (
            <>
              <div className="account-toolbar">
                <div
                  className="account-filters"
                  role="group"
                  aria-label="Период и статус бронирований"
                >
                  {FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="account-filter"
                      aria-pressed={filter === item.id}
                      onClick={() => selectFilter(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <label className="account-search">
                  <span>Поиск бронирования</span>
                  <input
                    type="search"
                    placeholder="Название фильма"
                    value={search}
                    onChange={(event) => changeSearch(event.target.value)}
                  />
                </label>
              </div>

              <p className="account-results muted" role="status">
                Найдено: {filteredBookings.length}
              </p>

              {filteredBookings.length === 0 ? (
                <div className="account-empty">
                  <h3>
                    {query
                      ? 'По запросу ничего не найдено'
                      : 'В этом разделе пока нет бронирований'}
                  </h3>

                  <p className="muted">
                    {query
                      ? 'Попробуй другое название.'
                      : 'Выбери другой раздел или найди фильм в афише.'}
                  </p>

                  {query && (
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => changeSearch('')}
                    >
                      Очистить поиск
                    </button>
                  )}
                </div>
              ) : (
                <div className="account-booking-list">
                  {visibleBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      group={getBookingGroup(booking, now)}
                      onRequestCancellation={cancellationHandler}
                    />
                  ))}
                </div>
              )}

              {visibleCount < filteredBookings.length && (
                <button
                  type="button"
                  className="button button-outline account-show-more"
                  onClick={() =>
                    setVisibleCount((count) => count + PAGE_SIZE)
                  }
                >
                  Показать ещё
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}