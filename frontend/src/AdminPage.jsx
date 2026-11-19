import { useEffect, useRef, useState } from 'react'
import './AdminPage.css'

const PAGE_SIZE = 5

const STATUS_LABELS = {
  active: 'Активная',
  cancel_requested: 'Ожидает отмены',
  cancelled: 'Отменена',
}

function localDateTime(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatStart(value) {
  return new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function createDemoData() {
  function tomorrowAt(hour) {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    date.setHours(hour, 0, 0, 0)
    return localDateTime(date)
  }

  return {
    movies: [
      {
        id: 'movie-1',
        title: 'Рататуй',
        description: 'История маленького повара с большой мечтой.',
        genre: 'Мультфильм',
        duration_minutes: 111,
        age_rating: '6+',
        poster_path: '/images/ratatouille.jpg',
      },
      {
        id: 'movie-2',
        title: 'Интерстеллар',
        description: 'Экспедиция ищет новый дом для человечества.',
        genre: 'Фантастика',
        duration_minutes: 169,
        age_rating: '12+',
        poster_path: '',
      },
    ],
    halls: [
      { id: 'hall-1', name: 'Панорамный зал' },
      { id: 'hall-2', name: 'Малый зал' },
    ],
    screenings: [
      {
        id: 'screening-1',
        movieId: 'movie-1',
        hallId: 'hall-1',
        startsAt: tomorrowAt(14),
      },
      {
        id: 'screening-2',
        movieId: 'movie-2',
        hallId: 'hall-1',
        startsAt: tomorrowAt(18),
      },
    ],
    bookings: [
      {
        id: 101,
        screeningId: 'screening-1',
        viewer: 'Иван Петров',
        email: 'ivan@example.test',
        status: 'active',
        seats: [{ row: 3, number: 5 }],
      },
      {
        id: 102,
        screeningId: 'screening-2',
        viewer: 'Мария Иванова',
        email: 'maria@example.test',
        status: 'cancel_requested',
        seats: [
          { row: 4, number: 6 },
          { row: 4, number: 7 },
        ],
      },
      {
        id: 103,
        screeningId: 'screening-1',
        viewer: 'Анна Смирнова',
        email: 'anna@example.test',
        status: 'cancelled',
        seats: [{ row: 2, number: 8 }],
      },
    ],
  }
}

function findConflict(screenings, movies) {
  const intervals = screenings.map((screening) => {
    const movie = movies.find((item) => item.id === screening.movieId)
    const start = new Date(screening.startsAt).getTime()

    return {
      ...screening,
      title: movie.title,
      start,
      end: start + movie.duration_minutes * 60_000,
    }
  })

  for (let first = 0; first < intervals.length; first += 1) {
    for (let second = first + 1; second < intervals.length; second += 1) {
      const a = intervals[first]
      const b = intervals[second]

      if (
        a.hallId === b.hallId &&
        a.start < b.end &&
        b.start < a.end
      ) {
        return (
          'В одном зале пересекаются сеансы: ' +
          `«${a.title}» (${formatStart(a.startsAt)}) и ` +
          `«${b.title}» (${formatStart(b.startsAt)}).`
        )
      }
    }
  }

  return ''
}

function AdminDialog({ title, onClose, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()

    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      aria-labelledby="admin-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="admin-dialog-heading">
        <h2 id="admin-dialog-title">{title}</h2>

        <button
          type="button"
          className="admin-close"
          aria-label="Закрыть окно"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {children}
    </dialog>
  )
}

function MovieForm({ movie, genres = [], onSave, onClose }) {
  const genreOptions = [...new Set(
    [...genres, movie?.genre]
      .filter(Boolean)
      .map((genre) => genre.trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'ru'));

  const [selectedGenre, setSelectedGenre] = useState(movie?.genre?.trim() || '');
  const [customGenre, setCustomGenre] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const formData = new FormData(event.currentTarget);
    const enteredGenre =
      selectedGenre === '__custom__'
        ? customGenre.trim()
        : selectedGenre;

    const existingGenre = genreOptions.find(
      (genre) =>
        genre.toLocaleLowerCase('ru') ===
        enteredGenre.toLocaleLowerCase('ru')
    );

    const data = {
      id: movie?.id ?? crypto.randomUUID(),
      title: String(formData.get('title') || '').trim(),
      description: String(formData.get('description') || '').trim(),
      genre: existingGenre || enteredGenre,
      duration_minutes: Number(formData.get('duration_minutes')),
      age_rating: String(formData.get('age_rating') || ''),
      poster_path: String(formData.get('poster_path') || '').trim(),
    };

    if (!data.title || !data.description || !data.genre) {
      setError('Заполни название, описание и жанр фильма.');
      return;
    }

    if (
      !Number.isInteger(data.duration_minutes) ||
      data.duration_minutes <= 0
    ) {
      setError('Продолжительность должна быть целым числом больше нуля.');
      return;
    }

    if (!['0+', '6+', '12+', '16+', '18+'].includes(data.age_rating)) {
      setError('Выбери возрастное ограничение.');
      return;
    }

    if (
      data.poster_path &&
      !/^(\/(?!\/)|https?:\/\/)/i.test(data.poster_path)
    ) {
      setError(
        'Укажи путь вида /images/poster.jpg или ссылку, начинающуюся с https://.'
      );
      return;
    }

    const saveError = onSave(data);

    if (saveError) {
      setError(saveError);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label>
        Название
        <input
          name="title"
          defaultValue={movie?.title || ''}
          required
          autoFocus
        />
      </label>

      <label>
        Описание
        <textarea
          name="description"
          rows={4}
          defaultValue={movie?.description || ''}
          required
        />
      </label>

      <div className="admin-form-row">
        <label>
          Жанр
          <select
            value={selectedGenre}
            onChange={(event) => {
              setSelectedGenre(event.target.value);
              setError('');
            }}
            required
          >
            <option value="" disabled>
              Выбери жанр
            </option>

            {genreOptions.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}

            <option value="__custom__">Другой жанр…</option>
          </select>
        </label>

        <label>
          Продолжительность, мин
          <input
            name="duration_minutes"
            type="number"
            min="1"
            step="1"
            defaultValue={movie?.duration_minutes ?? ''}
            required
          />
        </label>
      </div>

      {selectedGenre === '__custom__' && (
        <label>
          Новый жанр
          <input
            value={customGenre}
            onChange={(event) => setCustomGenre(event.target.value)}
            placeholder="Например, Детектив"
            required
          />
        </label>
      )}

      <label>
        Возрастное ограничение
        <select
          name="age_rating"
          defaultValue={movie?.age_rating || ''}
          required
        >
          <option value="" disabled>
            Выбери ограничение
          </option>
          <option value="0+">0+</option>
          <option value="6+">6+</option>
          <option value="12+">12+</option>
          <option value="16+">16+</option>
          <option value="18+">18+</option>
        </select>
      </label>

      <label>
        Постер — путь или ссылка
        <input
          name="poster_path"
          defaultValue={movie?.poster_path || ''}
          placeholder="/images/poster.jpg"
        />
      </label>

      <p className="admin-form-hint">
        Если постер не указан, в афише будет показана заглушка.
      </p>

      {error && (
        <p className="admin-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-dialog-actions">
        <button type="submit" className="button button-primary">
          {movie ? 'Сохранить изменения' : 'Добавить фильм'}
        </button>

        <button
          type="button"
          className="button"
          onClick={onClose}
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

function ScreeningForm({
  screening,
  movies,
  halls,
  onSave,
  onClose,
}) {
  const [error, setError] = useState('')

  function submit(event) {
    event.preventDefault()
    setError('')

    const fields = new FormData(event.currentTarget)

    const data = {
      id: screening?.id ?? crypto.randomUUID(),
      movieId: screening?.movieId ?? fields.get('movie'),
      hallId: screening?.hallId ?? fields.get('hall'),
      startsAt: fields.get('startsAt'),
    }

    const start = new Date(data.startsAt).getTime()

    if (!Number.isFinite(start) || start <= Date.now()) {
      setError('Выбери дату и время в будущем.')
      return
    }

    const message = onSave(data)

    if (message) {
      setError(message)
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        Фильм
        <select
          name="movie"
          defaultValue={screening?.movieId ?? movies[0]?.id ?? ''}
          disabled={Boolean(screening)}
          required
        >
          {movies.map((movie) => (
            <option key={movie.id} value={movie.id}>
              {movie.title} · {movie.duration_minutes} мин
            </option>
          ))}
        </select>
      </label>

      <label>
        Зал
        <select
          name="hall"
          defaultValue={screening?.hallId ?? halls[0]?.id ?? ''}
          disabled={Boolean(screening)}
          required
        >
          {halls.map((hall) => (
            <option key={hall.id} value={hall.id}>
              {hall.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Дата и время начала
        <input
          name="startsAt"
          type="datetime-local"
          defaultValue={screening?.startsAt ?? ''}
          required
        />
      </label>

      {screening && (
        <p className="muted admin-hint">
          При переносе сохраняются фильм и зал, чтобы не менять
          выбранные зрителями места.
        </p>
      )}

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-actions">
        <button type="submit" className="button button-primary">
          {screening ? 'Сохранить' : 'Создать сеанс'}
        </button>

        <button
          type="button"
          className="button button-outline"
          onClick={onClose}
        >
          Отмена
        </button>
      </div>
    </form>
  )
}

export default function AdminPage() {
  const [data, setData] = useState(createDemoData)
  const [tab, setTab] = useState('movies')
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [movieId, setMovieId] = useState('')
  const [date, setDate] = useState('')
  const [hallId, setHallId] = useState('')
  const [status, setStatus] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const { movies, halls, screenings, bookings } = data
  const query = search.trim().toLowerCase()

  const genres = [
    ...new Set(
      movies
        .map((movie) => movie.genre.trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, 'ru'))

  const movieOptions = [...movies]
    .filter((movie) =>
      tab !== 'screenings' || movie.title.toLowerCase().includes(query)
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))

  const movieList = [...movies]
    .filter((movie) => movie.title.toLowerCase().includes(query))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))

  const screeningList = screenings
    .map((screening) => ({
      ...screening,
      movie: movies.find((movie) => movie.id === screening.movieId),
      hall: halls.find((hall) => hall.id === screening.hallId),
    }))
    .filter((screening) =>
      (!movieId || screening.movieId === movieId) &&
      (!date || screening.startsAt.slice(0, 10) === date) &&
      (!hallId || screening.hallId === hallId) &&
      screening.movie.title.toLowerCase().includes(query)
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const bookingList = bookings
    .map((booking) => {
      const screening = screenings.find(
        (item) => item.id === booking.screeningId
      )

      return {
        ...booking,
        screening,
        movie: movies.find((item) => item.id === screening.movieId),
        hall: halls.find((item) => item.id === screening.hallId),
      }
    })
    .filter((booking) => {
      const matchesSearch = [
        String(booking.id),
        booking.viewer,
        booking.email,
        booking.movie.title,
      ].some((value) => value.toLowerCase().includes(query))

      return (
        matchesSearch &&
        (!status || booking.status === status) &&
        (!date || booking.screening.startsAt.slice(0, 10) === date)
      )
    })
    .sort((a, b) => {
      const priority =
        Number(b.status === 'cancel_requested') -
        Number(a.status === 'cancel_requested')

      return (
        priority ||
        a.screening.startsAt.localeCompare(b.screening.startsAt)
      )
    })

  const currentList =
    tab === 'movies'
      ? movieList
      : tab === 'screenings'
        ? screeningList
        : bookingList

  const cancellationCount = bookings.filter(
    (booking) => booking.status === 'cancel_requested'
  ).length

  function resetFilters() {
    setSearch('')
    setMovieId('')
    setDate('')
    setHallId('')
    setStatus('')
    setVisibleCount(PAGE_SIZE)
  }

  function changeTab(value) {
    setTab(value)
    setNotice('')
    resetFilters()
  }

  function updateFilter(setter, value) {
    setter(value)
    setVisibleCount(PAGE_SIZE)
  }

  function openModal(value) {
    setNotice('')
    setModal(value)
  }

  function finish(message) {
    setModal(null)
    setNotice(message)
  }

  function saveMovie(movie) {
    const exists = movies.some((item) => item.id === movie.id)

    const updatedMovies = exists
      ? movies.map((item) => item.id === movie.id ? movie : item)
      : [...movies, movie]

    const conflict = findConflict(screenings, updatedMovies)

    if (conflict) {
      return `Изменение продолжительности создаёт конфликт. ${conflict}`
    }

    setData({ ...data, movies: updatedMovies })
    resetFilters()
    finish(exists ? 'Изменения фильма сохранены.' : 'Фильм добавлен.')

    return ''
  }

  function saveScreening(screening) {
    if (
      !movies.some((movie) => movie.id === screening.movieId) ||
      !halls.some((hall) => hall.id === screening.hallId)
    ) {
      return 'Выбери существующий фильм и зал.'
    }

    const previous = screenings.find((item) => item.id === screening.id)

    if (
      previous &&
      new Date(previous.startsAt).getTime() <= Date.now()
    ) {
      return 'Начавшийся или прошедший сеанс переносить нельзя.'
    }

    const updatedScreenings = previous
      ? screenings.map((item) =>
          item.id === screening.id ? screening : item
        )
      : [...screenings, screening]

    const conflict = findConflict(updatedScreenings, movies)

    if (conflict) {
      return conflict
    }

    setData({ ...data, screenings: updatedScreenings })
    resetFilters()
    finish(previous ? 'Сеанс перенесён.' : 'Сеанс создан.')

    return ''
  }

  function confirmCancellation() {
    const id = modal.booking.id

    setData((current) => ({
      ...current,
      bookings: current.bookings.map((booking) =>
        booking.id === id && booking.status === 'cancel_requested'
          ? { ...booking, status: 'cancelled' }
          : booking
      ),
    }))

    finish(`Отмена брони №${id} подтверждена.`)
  }

  return (
    <main className="container admin-page">
      <header className="admin-heading">
        <p className="eyebrow">Кинотеатр «КАДР»</p>
        <h1>Панель администратора</h1>

        <p className="muted">
          Предпросмотр · тестовые данные.
          Изменения не отправляются на сервер и сбросятся
          после обновления страницы.
        </p>
      </header>

      <nav className="admin-tabs" aria-label="Разделы администратора">
        {[
          ['movies', 'Фильмы'],
          ['screenings', 'Сеансы'],
          ['bookings', 'Бронирования'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="button button-outline"
            aria-pressed={tab === id}
            onClick={() => changeTab(id)}
          >
            {label}
            {id === 'bookings' && cancellationCount > 0 &&
              ` · ${cancellationCount} на отмену`}
          </button>
        ))}
      </nav>

      <p className="admin-notice" role="status">
        {notice}
      </p>

      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>
            {tab === 'movies'
              ? 'Фильмы'
              : tab === 'screenings'
                ? 'Расписание сеансов'
                : 'Бронирования зрителей'}
          </h2>

          {tab !== 'bookings' && (
            <button
              type="button"
              className="button button-primary"
              disabled={tab === 'screenings' && movies.length === 0}
              onClick={() => openModal({
                type: tab === 'movies' ? 'movie' : 'screening',
              })}
            >
              {tab === 'movies' ? 'Добавить фильм' : 'Создать сеанс'}
            </button>
          )}
        </div>

        <div className="admin-filters">
          <label className="admin-search">
            {tab === 'bookings' ? 'Поиск бронирования' : 'Поиск фильма'}

            <input
              type="search"
              value={search}
              placeholder={
                tab === 'bookings'
                  ? 'Номер брони, зритель, почта или фильм'
                  : 'Название фильма'
              }
              onChange={(event) => {
                updateFilter(setSearch, event.target.value)

                if (tab === 'screenings') {
                  setMovieId('')
                }
              }}
            />
          </label>

          {tab === 'screenings' && (
            <>
              <label>
                Фильм
                <select
                  value={movieId}
                  onChange={(event) =>
                    updateFilter(setMovieId, event.target.value)
                  }
                >
                  <option value="">Все найденные фильмы</option>

                  {movieOptions.map((movie) => (
                    <option key={movie.id} value={movie.id}>
                      {movie.title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Зал
                <select
                  value={hallId}
                  onChange={(event) =>
                    updateFilter(setHallId, event.target.value)
                  }
                >
                  <option value="">Все залы</option>

                  {halls.map((hall) => (
                    <option key={hall.id} value={hall.id}>
                      {hall.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {tab !== 'movies' && (
            <label>
              Дата сеанса
              <input
                type="date"
                value={date}
                onChange={(event) =>
                  updateFilter(setDate, event.target.value)
                }
              />
            </label>
          )}

          {tab === 'bookings' && (
            <label>
              Статус
              <select
                value={status}
                onChange={(event) =>
                  updateFilter(setStatus, event.target.value)
                }
              >
                <option value="">Все статусы</option>

                {Object.entries(STATUS_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="admin-results">
          <span className="muted">
            Найдено: {currentList.length}
          </span>

          <button
            type="button"
            className="admin-reset"
            onClick={resetFilters}
          >
            Сбросить фильтры
          </button>
        </div>

        {currentList.length === 0 && (
          <div className="admin-card">
            <h3>Ничего не найдено</h3>
            <p className="muted">
              Попробуй изменить условия поиска.
            </p>
          </div>
        )}

        {tab === 'movies' &&
          movieList.slice(0, visibleCount).map((movie) => (
            <article className="admin-card" key={movie.id}>
              <div className="admin-card-header">
                <div>
                  <h3>{movie.title}</h3>
                  <p className="muted">
                    {movie.genre} · {movie.duration_minutes} мин ·{' '}
                    {movie.age_rating}
                  </p>
                </div>

                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => openModal({ type: 'movie', movie })}
                >
                  Редактировать
                </button>
              </div>

              <p className="admin-description">
                {movie.description}
              </p>
            </article>
          ))}

        {tab === 'screenings' &&
          screeningList.slice(0, visibleCount).map((screening) => (
            <article className="admin-card" key={screening.id}>
              <div className="admin-card-header">
                <div>
                  <h3>{screening.movie.title}</h3>
                  <p className="muted">
                    {screening.hall.name} ·{' '}
                    {screening.movie.duration_minutes} мин
                  </p>
                  <time dateTime={screening.startsAt}>
                    {formatStart(screening.startsAt)}
                  </time>
                </div>

                <button
                  type="button"
                  className="button button-outline"
                  disabled={
                    new Date(screening.startsAt).getTime() <= Date.now()
                  }
                  onClick={() => openModal({
                    type: 'screening',
                    screening,
                  })}
                >
                  Перенести сеанс
                </button>
              </div>
            </article>
          ))}

        {tab === 'bookings' &&
          bookingList.slice(0, visibleCount).map((booking) => (
            <article className="admin-card" key={booking.id}>
              <div className="admin-card-header">
                <div>
                  <p className="admin-booking-id">
                    Бронь №{booking.id}
                  </p>
                  <h3>{booking.movie.title}</h3>
                </div>

                <span
                  className={`admin-status admin-status-${booking.status}`}
                >
                  {STATUS_LABELS[booking.status]}
                </span>
              </div>

              <p>{booking.viewer} · {booking.email}</p>

              <p className="muted">
                {formatStart(booking.screening.startsAt)} ·{' '}
                {booking.hall.name}
              </p>

              <p>
                {booking.seats
                  .map((seat) =>
                    `Ряд ${seat.row}, место ${seat.number}`
                  )
                  .join(' · ')}
              </p>

              {booking.status === 'cancel_requested' && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => openModal({
                    type: 'cancellation',
                    booking,
                  })}
                >
                  Подтвердить отмену
                </button>
              )}
            </article>
          ))}

        {visibleCount < currentList.length && (
          <button
            type="button"
            className="button button-outline admin-show-more"
            onClick={() =>
              setVisibleCount((count) => count + PAGE_SIZE)
            }
          >
            Показать ещё
          </button>
        )}
      </section>

      {modal?.type === 'movie' && (
        <AdminDialog
          title={modal.movie ? 'Редактирование фильма' : 'Новый фильм'}
          onClose={() => setModal(null)}
        >
          <MovieForm
            movie={modal.movie}
            genres={genres}
            onSave={saveMovie}
            onClose={() => setModal(null)}
          />
        </AdminDialog>
      )}

      {modal?.type === 'screening' && (
        <AdminDialog
          title={modal.screening ? 'Перенос сеанса' : 'Новый сеанс'}
          onClose={() => setModal(null)}
        >
          <ScreeningForm
            screening={modal.screening}
            movies={movies}
            halls={halls}
            onSave={saveScreening}
            onClose={() => setModal(null)}
          />
        </AdminDialog>
      )}

      {modal?.type === 'cancellation' && (
        <AdminDialog
          title="Отмена бронирования"
          onClose={() => setModal(null)}
        >
          <p>
            Подтвердить отмену брони №{modal.booking.id}?
          </p>

          <p className="muted">
            В предпросмотре изменится только статус тестовой брони.
          </p>

          <div className="admin-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() => setModal(null)}
              autoFocus
            >
              Назад
            </button>

            <button
              type="button"
              className="button button-primary"
              onClick={confirmCancellation}
            >
              Подтвердить отмену
            </button>
          </div>
        </AdminDialog>
      )}
    </main>
  )
}