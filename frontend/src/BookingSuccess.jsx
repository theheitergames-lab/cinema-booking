export default function BookingSuccess({ movieTitle, screening, seats }) {
  const date = new Date(screening.startsAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  })

  return (
    <section className="booking-review" aria-labelledby="booking-success-title">
      <p className="eyebrow">Бронирование</p>
      <h2 id="booking-success-title">Заявка на бронь отправлена</h2>

      <p>
        <strong>Ожидает подтверждения администратора.</strong>
      </p>
      <p className="muted">
        Статус заявки можно посмотреть в личном кабинете.
      </p>

      <h3>{movieTitle}</h3>
      <p>
        {date} · {screening.startsAt.slice(11, 16)} · {screening.hall}
      </p>

      <ul>
        {seats.map((seat) => {
          const [row, number] = seat.split('-')

          return (
            <li key={seat}>Ряд {row}, место {number}</li>
          )
        })}
      </ul>
    </section>
  )
}