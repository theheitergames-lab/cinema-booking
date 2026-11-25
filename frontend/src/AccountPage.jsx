import { useEffect, useState } from 'react'
import { AUTH_TOKEN_KEY } from './AuthDialog'
import './AccountPage.css'
import { QRCodeSVG } from 'qrcode.react'

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

function BookingCard({ booking, group, onRequestCancellation }) {
  const [showTicket, setShowTicket] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canCancel =
    group === 'upcoming' &&
    booking.status === 'active' &&
    typeof onRequestCancellation === 'function'

  const isPastActive =
    group === 'past' && booking.status === 'active'

  const displayStatus = isPastActive ? 'past' : booking.status

  const statusLabel = isPastActive
    ? 'Сеанс прошёл'
    : STATUS_LABELS[booking.status] ||
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
          className={`account-status account-status-${displayStatus}`}
        >
          {statusLabel}
        </span>
      </div>

      <h3>{booking.movieTitle}</h3>

      {Number.isFinite(booking.totalPrice) && (
        <p>
          Стоимость билетов:{' '}
          <strong>
            {booking.totalPrice.toLocaleString('ru-RU')} ₽
          </strong>
        </p>
      )}

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

      {booking.ticketCode && (
        <div className="account-ticket">
          <button
            type="button"
            className="button button-outline"
            aria-expanded={showTicket}
            aria-controls={`ticket-${booking.id}`}
            onClick={() => setShowTicket((value) => !value)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="6" height="6" />
              <rect x="15" y="3" width="6" height="6" />
              <rect x="3" y="15" width="6" height="6" />
              <path d="M15 15h3v3h3v3h-6v-3M21 12v3M12 3v9H3" />
            </svg>

            {showTicket ? 'Скрыть QR-код' : 'Показать QR-код'}
          </button>

          {showTicket && (
            <div
              id={`ticket-${booking.id}`}
              className="account-ticket-details"
            >
              <p>
                <strong>Код бронирования №{booking.id}</strong>
              </p>

              {booking.status === 'cancelled' ? (
                <p className="muted">
                  Бронь отменена. Код сохранён для истории.
                </p>
              ) : group === 'past' || booking.status === 'completed' ? (
                <p className="muted">
                  Архивное бронирование.
                </p>
              ) : (
                <p className="muted">
                  Покажите код сотруднику кинотеатра.
                </p>
              )}

              <div className="account-ticket-qr">
                <QRCodeSVG
                  value={booking.ticketCode}
                  size={208}
                  level="M"
                  marginSize={4}
                  title={`Код бронирования №${booking.id}`}
                />
              </div>

              <code className="account-ticket-code">
                {booking.ticketCode}
              </code>
            </div>
          )}
        </div>
      )}

      {group === 'upcoming' &&
        booking.status === 'active' &&
        typeof onRequestCancellation !== 'function' && (
          <div className="account-cancel">
            <button
              type="button"
              className="button button-outline"
              disabled
              aria-describedby={`cancel-unavailable-${booking.id}`}
            >
              Запросить отмену
            </button>

            <p
              id={`cancel-unavailable-${booking.id}`}
              className="muted"
            >
              Запрос отмены временно недоступен.
            </p>
          </div>
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
  onRequestCancellation,
  onGoToAfisha,
}) {
  const [filter, setFilter] = useState('upcoming')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [serverBookings, setServerBookings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setLoadError('')
    setServerBookings(null)

    async function loadBookings() {
      try {
        const token = sessionStorage.getItem(AUTH_TOKEN_KEY)

        if (!token) {
          throw new Error('Войдите в аккаунт для просмотра бронирований.')
        }

        const response = await fetch('/api/bookings', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        })

        if (response.status === 401) {
          throw new Error('Время входа истекло. Выйдите и войдите снова.')
        }

        if (!response.ok) {
          throw new Error('Не удалось загрузить бронирования.')
        }

        const data = await response.json()

        if (
          !Array.isArray(data) ||
          !data.every((booking) =>
            booking.id != null &&
            typeof booking.movie_title === 'string' &&
            Array.isArray(booking.seats)
          )
        ) {
          throw new Error('Не удалось прочитать список бронирований.')
        }

        const preparedBookings = data.map((booking) => ({
          id: booking.id,
          totalPrice: booking.total_price,
          movieTitle: booking.movie_title,
          startsAt: booking.starts_at,
          hallName: booking.hall_name,
          status: booking.status,
          ticketCode: booking.ticket_code,
          seats: booking.seats.map((seat) => ({
            row: seat.row_number,
            number: seat.seat_number,
          })),
        }))

        if (!controller.signal.aborted) {
          setServerBookings(preparedBookings)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof TypeError
              ? 'Не удалось связаться с сервером. Попробуйте ещё раз.'
              : error.message
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadBookings()

    return () => controller.abort()
  }, [user.id, retry])

  const bookingsAvailable = Array.isArray(serverBookings)
  const allBookings = bookingsAvailable ? serverBookings : []

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

  return (
    <main className="account-page">
      <div className="container">
        <header className="account-heading">
          <p className="eyebrow">Кинотеатр «КАДР»</p>
          <h1>Личный кабинет</h1>
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
            <div className="account-empty">
              {loading ? (
                <p role="status">Загружаем бронирования…</p>
              ) : (
                <>
                  <p role="alert">
                    {loadError || 'Не удалось загрузить бронирования.'}
                  </p>

                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    Повторить
                  </button>
                </>
              )}
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
                      onRequestCancellation={onRequestCancellation}
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