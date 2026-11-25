import { useEffect, useState } from 'react'
import BookingReview from './BookingReview'
import './SeatMap.css'
import {
  AUTH_TOKEN_KEY,
  AUTH_CHANGED_EVENT,
} from './AuthDialog'

export default function SeatMap({
  screening,
  movieTitle,
  user,
  authStatus,
  onBookingDone,
}) {
  const [seats, setSeats] = useState(null)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [showReview, setShowReview] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadSeats() {
      try {
        const response = await fetch(
          `/api/screenings/${screening.id}/seats`,
          { signal: controller.signal }
        )

        if (!response.ok) {
          throw new Error(`Не удалось загрузить места (${response.status}).`)
        }

        const data = await response.json()
        if (!Array.isArray(data) || !data.every(seat =>
          seat.id != null &&
          Number.isInteger(seat.row_number) &&
          Number.isInteger(seat.seat_number) &&
          typeof seat.is_occupied === 'boolean'
        )) {
          throw new Error('Формат мест отличается от ожидаемого.')
        }

        data.sort((a, b) =>
          a.row_number - b.row_number || a.seat_number - b.seat_number
        )

        if (!controller.signal.aborted) {
          const availableIds = new Set(
            data
              .filter((seat) => !seat.is_occupied)
              .map((seat) => seat.id)
          )

          setSeats(data)

          setSelectedIds((previous) =>
            previous.filter((id) => availableIds.has(id))
          )
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message)
      }
    }

    loadSeats()
    return () => controller.abort()
  }, [screening.id, reload])

  async function handleBooking({ screeningId, seatIds }) {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY)

  if (!token) {
    throw new Error('Войдите в аккаунт для бронирования.')
  }

  let response

  try {
    response = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        screening_id: screeningId,
        seat_ids: seatIds,
      }),
    })
  } catch {
    throw new Error(
      'Соединение прервалось. Проверьте личный кабинет перед повторным бронированием.'
    )
  }

  if (response.status === 401) {
    if (sessionStorage.getItem(AUTH_TOKEN_KEY) === token) {
      sessionStorage.removeItem(AUTH_TOKEN_KEY)
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
    }

    throw new Error('Время входа истекло. Войдите ещё раз.')
  }

  if (response.status === 409) {
    throw new Error(
      'Одно из мест уже занято. Нажмите «Изменить места» и выберите другие.'
    )
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === 'string'
        ? data.detail
        : 'Не удалось оформить бронирование. Попробуйте ещё раз.'
    )
  }

  if (!data?.id) {
    throw new Error(
      'Не удалось прочитать подтверждение. Проверьте личный кабинет перед повторным бронированием.'
    )
  }

  return data
}

  function toggleSeat(id) {
    setSelectedIds(previous =>
      previous.includes(id)
        ? previous.filter(selectedId => selectedId !== id)
        : [...previous, id]
    )
  }

  if (error) return <p role="alert">{error}</p>
  if (seats === null) return <p>Загружаем места…</p>
  if (seats.length === 0) return <p>Для этого зала пока нет мест.</p>

  const rows = [...new Set(seats.map(seat => seat.row_number))]
  const selectedSeats = seats.filter(seat => selectedIds.includes(seat.id))
  const occupiedCount = seats.filter(seat => seat.is_occupied).length

  if (showReview) {
    return (
      <BookingReview
        user={user}
        authStatus={authStatus}
        movieTitle={movieTitle}
        screening={screening}
        seats={selectedSeats.map(
          (seat) => `${seat.row_number}-${seat.seat_number}`
        )}
        seatIds={selectedSeats.map((seat) => seat.id)}
        onBook={handleBooking}
        onBack={() => {
          setShowReview(false)
          setSeats(null)
          setError('')
          setReload((value) => value + 1)
        }}
        onBookingDone={onBookingDone}
      />
    )
  }

  return (
    <section className="seat-map">
      <h3>Выбор мест · {screening.hall}</h3>
      <p className="muted">
        Свободно: {seats.length - occupiedCount} из {seats.length}
      </p>

      <div className="cinema-screen">Экран</div>

      {rows.map(row => (
        <div className="seat-row" key={row}>
          <span className="row-label">Ряд {row}</span>

          {seats.filter(seat => seat.row_number === row).map(seat => (
            <button
              key={seat.id}
              type="button"
              className="seat"
              disabled={seat.is_occupied}
              aria-pressed={selectedIds.includes(seat.id)}
              aria-label={`Ряд ${row}, место ${seat.seat_number}${
                seat.is_occupied ? ', занято' : ''
              }`}
              onClick={() => toggleSeat(seat.id)}
            >
              {seat.seat_number}
            </button>
          ))}
        </div>
      ))}

      <p className="seat-legend">Серые — заняты · Красные — выбраны</p>

      <p className="seat-summary" aria-live="polite">
        {selectedSeats.length === 0
          ? 'Выбери свободные места.'
          : 'Выбрано: ' + selectedSeats
              .map(seat => `ряд ${seat.row_number}, место ${seat.seat_number}`)
              .join('; ')}
      </p>

      <button
        type="button"
        className="button button-primary booking-next"
        disabled={selectedIds.length === 0}
        onClick={() => setShowReview(true)}
      >
        Перейти к бронированию →
      </button>
    </section>
  )
}