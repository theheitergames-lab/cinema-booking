import { useState } from 'react'
import { demoHalls, occupiedByScreening } from './demoHalls'
import './SeatMap.css'

export default function SeatMap({ screening }) {
  const [selectedSeats, setSelectedSeats] = useState([])
  const hall = demoHalls[screening.hall]
  const occupied = occupiedByScreening[screening.id] ?? []

  if (!hall) {
    return <p>Для этого зала пока нет схемы.</p>
  }

  function toggleSeat(id) {
    setSelectedSeats((previous) =>
      previous.includes(id)
        ? previous.filter((seat) => seat !== id)
        : [...previous, id]
    )
  }

  return (
    <section className="seat-map">
      <h3>Выбор мест · {screening.hall}</h3>
      <div className="cinema-screen">Экран</div>

      {Array.from({ length: hall.rows }, (_, rowIndex) => {
        const row = rowIndex + 1

        return (
          <div className="seat-row" key={row}>
            <span className="row-label">Ряд {row}</span>

            {Array.from({ length: hall.seatsPerRow }, (_, seatIndex) => {
              const number = seatIndex + 1
              const id = `${row}-${number}`
              const isOccupied = occupied.includes(id)

              return (
                <button
                  key={id}
                  type="button"
                  className="seat"
                  disabled={isOccupied}
                  aria-pressed={selectedSeats.includes(id)}
                  aria-label={`Ряд ${row}, место ${number}${isOccupied ? ', занято' : ''}`}
                  onClick={() => toggleSeat(id)}
                >
                  {number}
                </button>
              )
            })}
          </div>
        )
      })}

      <p className="seat-legend">
        Серые — заняты · Красные — выбраны
      </p>

      <p className="seat-summary" aria-live="polite">
        {selectedSeats.length === 0
          ? 'Выбери свободные места.'
          : 'Выбрано: ' + selectedSeats.map((id) => {
              const [row, number] = id.split('-')
              return `ряд ${row}, место ${number}`
            }).join('; ')}
      </p>
    </section>
  )
}