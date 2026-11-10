import { useEffect, useState } from 'react'

function getToday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ScreeningPicker({ movieId, onSelectScreening }) {
  const [selectedDay, setSelectedDay] = useState(getToday)
  const [result, setResult] = useState(null)

  const query = new URLSearchParams({
    movie_id: movieId,
    date: selectedDay,
  }).toString()

  useEffect(() => {
    if (!selectedDay) return
    const controller = new AbortController()

    async function loadScreenings() {
      try {
        const response = await fetch(`/api/screenings?${query}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Не удалось загрузить сеансы (${response.status}).`)
        }

        const data = await response.json()
        if (!Array.isArray(data) || !data.every(item =>
          item.id != null &&
          typeof item.starts_at === 'string' &&
          typeof item.hall_name === 'string'
        )) {
          throw new Error('Формат сеансов отличается от ожидаемого.')
        }

        if (!controller.signal.aborted) setResult({ query, data })
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({ query, error: error.message })
        }
      }
    }

    loadScreenings()
    return () => controller.abort()
  }, [query, selectedDay])

  // При смене даты не показываем сеансы от предыдущей даты.
  const current = result?.query === query ? result : null

  return (
    <section className="demo-note movie-schedule">
      <label htmlFor="screening-date">Дата сеанса</label>
      <input
        id="screening-date"
        type="date"
        value={selectedDay}
        onChange={event => setSelectedDay(event.target.value)}
      />

      <h3>Сеансы</h3>

      {!selectedDay ? (
        <p>Выбери дату.</p>
      ) : !current ? (
        <p>Загружаем расписание…</p>
      ) : current.error ? (
        <p role="alert">{current.error}</p>
      ) : current.data.length === 0 ? (
        <p>На этот день сеансов нет.</p>
      ) : (
        <div className="screening-list">
          {current.data.map(item => (
            <button
              key={item.id}
              type="button"
              className="screening-button"
              onClick={() => onSelectScreening({
                ...item,
                startsAt: item.starts_at,
                hall: item.hall_name,
              })}
            >
              <strong>{item.starts_at.slice(11, 16)}</strong>
              <span>{item.hall_name}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}