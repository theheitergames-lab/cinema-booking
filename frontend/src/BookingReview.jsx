export default function BookingReview({ movieTitle, screening, seats, onBack }) {
  const date = new Date(screening.startsAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  })

  return (
    <section className="booking-review" aria-labelledby="booking-title">
      <p className="eyebrow">Оформление бронирования</p>
      <h2 id="booking-title">Проверьте выбранные места</h2>

      <p><strong>{movieTitle}</strong></p>
      <p>{date} · {screening.startsAt.slice(11, 16)} · {screening.hall}</p>

      <ul>
        {seats.map((id) => {
          const [row, number] = id.split('-')
          return <li key={id}>Ряд {row}, место {number}</li>
        })}
      </ul>

      <p className="muted">Места ещё не забронированы.</p>

      <button type="button" className="button button-outline" onClick={onBack}>
        ← Изменить места
      </button>
    </section>
  )
}