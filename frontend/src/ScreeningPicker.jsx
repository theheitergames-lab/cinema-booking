import { useState } from 'react'
import { demoScreenings } from './demoScreenings'

function getToday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ScreeningPicker({ movieId, onSelectScreening }) {
  const [selectedDay, setSelectedDay] = useState(getToday)
  const [selectedId, setSelectedId] = useState(null)

  const screenings = demoScreenings
    .filter((item) =>
      item.movieId === movieId && item.startsAt.slice(0, 10) === selectedDay
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  function changeDay(event) {
    setSelectedDay(event.target.value)
    setSelectedId(null)
  }

  return (
    <section className="demo-note movie-schedule">
      <label htmlFor="screening-date">Дата сеанса</label>
      <input
        id="screening-date"
        type="date"
        value={selectedDay}
        onChange={changeDay}
      />

      <h3>Сеансы</h3>

      {!selectedDay ? (
        <p>Выбери дату, чтобы посмотреть расписание.</p>
      ) : screenings.length === 0 ? (
        <p>На этот день сеансов нет.</p>
      ) : (
        <div className="screening-list">
          {screenings.map((item) => (
            <button
              key={item.id}
              type="button"
              className="screening-button"
              aria-pressed={selectedId === item.id}
              onClick={() => {
                setSelectedId(item.id)
                onSelectScreening(item)
              }}
            >
              <strong>{item.startsAt.slice(11, 16)}</strong>
              <span>{item.hall}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}