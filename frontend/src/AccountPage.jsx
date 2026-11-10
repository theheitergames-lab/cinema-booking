import './AccountPage.css'

export default function AccountPage({ user, bookings, preview = false }) {
  return (
    <main className="account-page">
      <div className="container">
        <a className="button button-outline" href="/#afisha">
          ← К афише
        </a>

        <header className="account-heading">
          <p className="eyebrow">Кинотеатр «КАДР» / Зритель</p>
          <h1>Личный кабинет</h1>
          {preview && <p className="muted">Предпросмотр · тестовые данные</p>}
        </header>

        <section className="account-profile" aria-label="Данные зрителя">
          <div>
            <p className="account-label">Имя</p>
            <strong>{user.name}</strong>
          </div>
          <div>
            <p className="account-label">Электронная почта</p>
            <span>{user.email}</span>
          </div>
        </section>

        <section className="account-bookings">
          <h2>Мои бронирования</h2>

          {bookings.length === 0 ? (
            <div className="account-empty">
              <h3>У вас пока нет бронирований</h3>
              <p className="muted">Выбери фильм и сеанс в афише.</p>
              <a className="button button-primary" href="/#afisha">
                Смотреть афишу ↗
              </a>
            </div>
          ) : (
            bookings.map(booking => (
              <article className="account-booking" key={booking.id}>
                <div className="account-booking-top">
                  <span className="account-label">Бронь №{booking.id}</span>
                  <span className="account-status">{booking.statusLabel}</span>
                </div>

                <h3>{booking.movieTitle}</h3>
                <p>
                  <time dateTime={booking.startsAt}>
                    {new Date(booking.startsAt).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                  {' · '}{booking.hallName}
                </p>

                <p className="muted">
                  {booking.seats.map(seat =>
                    `Ряд ${seat.row}, место ${seat.number}`
                  ).join(' · ')}
                </p>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  )
}