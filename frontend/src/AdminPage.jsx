import { useEffect, useRef, useState } from 'react'
import {
  AUTH_TOKEN_KEY,
  AUTH_CHANGED_EVENT,
} from './AuthDialog'
import './AdminPage.css'

const PAGE_SIZE = 5

const STATUS_LABELS = {
  active: 'Активная',
  cancel_requested: 'Ожидает отмены',
  cancelled: 'Отменена',
  completed: 'Завершена',
}

function formatStart(value) {
  return new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function adminRequest(path, options = {}) {
  const response = await fetch(`/api/admin/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${
        sessionStorage.getItem(AUTH_TOKEN_KEY) || ''
      }`,
    },
  })

  if (response.status === 401) {
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
    throw new Error('Войди в аккаунт заново.')
  }

  if (response.status === 204) return null

  const result = await response.json().catch(() => null)

  if (!response.ok) {
    const detail = result?.detail

    throw new Error(
      response.status >= 500
        ? 'Не удалось выполнить действие. Попробуй позже.'
        : typeof detail === 'string'
          ? detail
          : response.status === 422
            ? 'Проверь заполненные поля.'
            : 'Не удалось выполнить действие.'
    )
  }

  return result
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

function MovieForm({
  movie,
  genres = [],
  onSave,
  onClose,
  busy,
}) {
  const genreOptions = [
    ...new Set(
      [...genres, movie?.genre]
        .filter(Boolean)
        .map((genre) => genre.trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, 'ru'))

  const [selectedGenre, setSelectedGenre] = useState(
    movie?.genre?.trim() || ''
  )
  const [customGenre, setCustomGenre] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const formData = new FormData(event.currentTarget)

    const enteredGenre =
      selectedGenre === '__custom__'
        ? customGenre.trim()
        : selectedGenre

    const existingGenre = genreOptions.find(
      (genre) =>
        genre.toLocaleLowerCase('ru') ===
        enteredGenre.toLocaleLowerCase('ru')
    )

    const data = {
      id: movie?.id ?? crypto.randomUUID(),
      title: String(formData.get('title') || '').trim(),
      description: String(
        formData.get('description') || ''
      ).trim(),
      genre: existingGenre || enteredGenre,
      duration_minutes: Number(
        formData.get('duration_minutes')
      ),
      age_rating: String(formData.get('age_rating') || ''),
      poster_path: String(
        formData.get('poster_path') || ''
      ).trim(),
    }

    if (!data.title || !data.description || !data.genre) {
      setError('Заполни название, описание и жанр фильма.')
      return
    }

    if (
      !Number.isInteger(data.duration_minutes) ||
      data.duration_minutes <= 0
    ) {
      setError(
        'Продолжительность должна быть целым числом больше нуля.'
      )
      return
    }

    if (
      !['0+', '6+', '12+', '16+', '18+'].includes(
        data.age_rating
      )
    ) {
      setError('Выбери возрастное ограничение.')
      return
    }

    if (
      data.poster_path &&
      !/^(\/(?!\/)|https?:\/\/)/i.test(data.poster_path)
    ) {
      setError(
        'Укажи путь вида /images/poster.jpg или ссылку, начинающуюся с https://.'
      )
      return
    }

    const saveError = await onSave(data)

    if (saveError) setError(saveError)
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
              setSelectedGenre(event.target.value)
              setError('')
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

            <option value="__custom__">
              Другой жанр…
            </option>
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
            onChange={(event) =>
              setCustomGenre(event.target.value)
            }
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
        <button
          type="submit"
          className="button button-primary"
          disabled={busy}
        >
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
  )
}

function ScreeningForm({
  screening,
  movies,
  halls,
  onSave,
  onClose,
  busy,
}) {
  const [error, setError] = useState('')

  async function submit(event) {
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

    const message = await onSave(data)

    if (message) setError(message)
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        Фильм
        <select
          name="movie"
          defaultValue={
            screening?.movieId ?? movies[0]?.id ?? ''
          }
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
          defaultValue={
            screening?.hallId ?? halls[0]?.id ?? ''
          }
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
        <button
          type="submit"
          className="button button-primary"
          disabled={busy}
        >
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
  const [data, setData] = useState({
    movies: [],
    halls: [],
    screenings: [],
    bookings: [],
  })

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)

  const [tab, setTab] = useState('movies')
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [movieId, setMovieId] = useState('')
  const [date, setDate] = useState('')
  const [hallId, setHallId] = useState('')
  const [status, setStatus] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError('')

      try {
        const [movies, halls, screenings, bookings] =
          await Promise.all(
            ['movies', 'halls', 'screenings', 'bookings'].map(
              (path) =>
                adminRequest(path, {
                  signal: controller.signal,
                })
            )
          )

        if (controller.signal.aborted) return

        setData({
          movies: movies.map((movie) => ({
            ...movie,
            id: String(movie.id),
          })),

          halls: halls.map((hall) => ({
            ...hall,
            id: String(hall.id),
          })),

          screenings: screenings.map((item) => ({
            ...item,
            id: String(item.id),
            movieId: String(item.movie_id),
            hallId: String(item.hall_id),
            startsAt: item.starts_at,
          })),

          bookings: bookings.map((item) => ({
            ...item,
            screeningId: String(item.screening_id),
            viewer: item.user_name,
            email: item.user_email,
            seats: item.seats.map((seat) => ({
              row: seat.row_number,
              number: seat.seat_number,
            })),
          })),
        })
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error.message || 'Не удалось загрузить данные.'
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    load()

    return () => controller.abort()
  }, [retry])

  const { movies, halls, screenings, bookings } = data
  const query = search.trim().toLowerCase()

  const genres = [
    ...new Set(
      movies
        .map((movie) => (movie.genre || '').trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, 'ru'))

  const movieOptions = [...movies]
    .filter(
      (movie) =>
        tab !== 'screenings' ||
        movie.title.toLowerCase().includes(query)
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))

  const movieList = [...movies]
    .filter((movie) =>
      movie.title.toLowerCase().includes(query)
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))

  const screeningList = screenings
    .map((screening) => ({
      ...screening,
      movie: movies.find(
        (movie) => movie.id === screening.movieId
      ) || {
        title: screening.movie_title,
      },
      hall: halls.find(
        (hall) => hall.id === screening.hallId
      ) || {
        name: screening.hall_name,
      },
    }))
    .filter(
      (screening) =>
        (!movieId || screening.movieId === movieId) &&
        (!date || screening.startsAt.slice(0, 10) === date) &&
        (!hallId || screening.hallId === hallId) &&
        screening.movie.title.toLowerCase().includes(query)
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const bookingList = bookings
    .map((booking) => ({
      ...booking,
      screening: { startsAt: booking.starts_at },
      movie: { title: booking.movie_title },
      hall: { name: booking.hall_name },
    }))
    .filter((booking) => {
      const matchesSearch = [
        String(booking.id),
        booking.viewer,
        booking.email,
        booking.ticket_code || '',
        booking.movie.title,
      ].some((value) => value.toLowerCase().includes(query))

      return (
        matchesSearch &&
        (!status || booking.status === status) &&
        (!date ||
          booking.screening.startsAt.slice(0, 10) === date)
      )
    })
    .sort((a, b) => {
      const priority =
        Number(b.status === 'cancel_requested') -
        Number(a.status === 'cancel_requested')

      return (
        priority ||
        a.screening.startsAt.localeCompare(
          b.screening.startsAt
        )
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

  function closeModal() {
    if (!saving.current) setModal(null)
  }

  async function save(path, method, body, message) {
    if (saving.current || loading || loadError) {
      return 'Дождись загрузки данных.'
    }

    saving.current = true
    setBusy(true)

    try {
      await adminRequest(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      })

      finish(message)
      setLoading(true)
      setRetry((value) => value + 1)

      return ''
    } catch (error) {
      return error instanceof TypeError
        ? 'Связь прервалась. Обнови список и проверь результат перед повторной попыткой.'
        : error.message
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  function saveMovie(movie) {
    const { id, ...body } = movie
    const exists = movies.some((item) => item.id === id)

    return save(
      exists ? `movies/${id}` : 'movies',
      exists ? 'PUT' : 'POST',
      body,
      exists ? 'Изменения фильма сохранены.' : 'Фильм добавлен.'
    )
  }

  function saveScreening(screening) {
    const movie = movies.find(
      (item) => item.id === screening.movieId
    )

    if (
      movie?.title.toLowerCase().includes('рассвет жатвы') &&
      screening.startsAt.slice(0, 10) < '2026-11-26'
    ) {
      return 'Для этого фильма выбери дату не раньше 26 ноября 2026 года.'
    }

    const exists = screenings.some(
      (item) => item.id === screening.id
    )

    const body = exists
      ? {
          starts_at: screening.startsAt,
        }
      : {
          movie_id: Number(screening.movieId),
          hall_id: Number(screening.hallId),
          starts_at: screening.startsAt,
        }

    return save(
      exists ? `screenings/${screening.id}` : 'screenings',
      exists ? 'PATCH' : 'POST',
      body,
      exists ? 'Сеанс перенесён.' : 'Сеанс создан.'
    )
  }

  async function removeItem(path, question) {
    if (!window.confirm(question)) return

    const error = await save(
      path,
      'DELETE',
      null,
      'Удалено.'
    )

    if (error) window.alert(error)
  }

  async function completeBooking(booking) {
    if (
      !window.confirm(`Завершить бронь №${booking.id}?`)
    ) {
      return
    }

    const error = await save(
      `bookings/${booking.id}/status`,
      'PATCH',
      { status: 'completed' },
      `Бронь №${booking.id} завершена.`
    )

    if (error) window.alert(error)
  }

  return (
    <main className="container admin-page">
      <header className="admin-heading">
        <p className="eyebrow">Кинотеатр «КАДР»</p>
        <h1>Панель администратора</h1>
      </header>

      <nav
        className="admin-tabs"
        aria-label="Разделы администратора"
      >
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
            {id === 'bookings' &&
              cancellationCount > 0 &&
              ` · ${cancellationCount} на отмену`}
          </button>
        ))}
      </nav>

      <p className="admin-notice" role="status">
        {notice}
      </p>

      <button
        type="button"
        className="button button-outline"
        disabled={loading || busy}
        onClick={() => setRetry((value) => value + 1)}
      >
        Обновить данные
      </button>

      {loading && <p role="status">Загрузка…</p>}

      {loadError && (
        <p className="admin-error" role="alert">
          {loadError}
        </p>
      )}

      {!loading && !loadError && (
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
                disabled={
                  busy ||
                  (tab === 'screenings' &&
                    (!movies.length || !halls.length))
                }
                onClick={() =>
                  openModal({
                    type:
                      tab === 'movies'
                        ? 'movie'
                        : 'screening',
                  })
                }
              >
                {tab === 'movies'
                  ? 'Добавить фильм'
                  : 'Создать сеанс'}
              </button>
            )}
          </div>

          <div className="admin-filters">
            <label className="admin-search">
              {tab === 'bookings'
                ? 'Поиск бронирования'
                : 'Поиск фильма'}

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

                  if (tab === 'screenings') setMovieId('')
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
                      updateFilter(
                        setMovieId,
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Все найденные фильмы
                    </option>

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
                      updateFilter(
                        setHallId,
                        event.target.value
                      )
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
                    updateFilter(
                      setStatus,
                      event.target.value
                    )
                  }
                >
                  <option value="">Все статусы</option>

                  {Object.entries(STATUS_LABELS).map(
                    ([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    )
                  )}
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
                  <div className="admin-movie-info">
                    <h3>{movie.title}</h3>

                    <p className="muted">
                      {movie.genre} · {movie.duration_minutes} мин ·{' '}
                      {movie.age_rating}
                    </p>

                    <p className="admin-description">
                      {movie.description}
                    </p>
                  </div>

                  <div className="admin-card-buttons">
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={busy}
                      onClick={() =>
                        openModal({ type: 'movie', movie })
                      }
                    >
                      Редактировать
                    </button>

                    <button
                      type="button"
                      className="button button-outline"
                      disabled={busy}
                      onClick={() =>
                        removeItem(
                          `movies/${movie.id}`,
                          `Удалить фильм «${movie.title}»?`
                        )
                      }
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            ))}

          {tab === 'screenings' &&
            screeningList
              .slice(0, visibleCount)
              .map((screening) => (
                <article
                  className="admin-card"
                  key={screening.id}
                >
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

                    <div className="admin-card-buttons">
                      <button
                        type="button"
                        className="button button-outline"
                        disabled={
                          busy ||
                          new Date(
                            screening.startsAt
                          ).getTime() <= Date.now()
                        }
                        onClick={() =>
                          openModal({
                            type: 'screening',
                            screening,
                          })
                        }
                      >
                        Перенести сеанс
                      </button>

                      <button
                        type="button"
                        className="button button-outline"
                        disabled={
                          busy ||
                          new Date(
                            screening.startsAt
                          ).getTime() <= Date.now()
                        }
                        onClick={() =>
                          removeItem(
                            `screenings/${screening.id}`,
                            'Удалить этот сеанс?'
                          )
                        }
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </article>
              ))}

          {tab === 'bookings' &&
            bookingList
              .slice(0, visibleCount)
              .map((booking) => (
                <article
                  className="admin-card"
                  key={booking.id}
                >
                  <div className="admin-card-header">
                    <div>
                      <p className="admin-booking-id">
                        Бронь №{booking.id}
                      </p>
                      <h3>{booking.movie.title}</h3>
                    </div>

                    <span
                      className={`admin-status admin-status-${
                        booking.status === 'active' &&
                        new Date(booking.end_at).getTime() <=
                          Date.now()
                          ? 'completed'
                          : booking.status
                      }`}
                    >
                      {booking.status === 'active' &&
                      new Date(booking.end_at).getTime() <=
                        Date.now()
                        ? 'Сеанс прошёл'
                        : STATUS_LABELS[booking.status] ||
                          booking.status}
                    </span>
                  </div>

                  <p>
                    {booking.viewer} · {booking.email}
                  </p>

                  <p className="muted">
                    {formatStart(
                      booking.screening.startsAt
                    )}{' '}
                    · {booking.hall.name}
                  </p>

                  <p>
                    {booking.seats
                      .map(
                        (seat) =>
                          `Ряд ${seat.row}, место ${seat.number}`
                      )
                      .join(' · ')}
                  </p>

                  {booking.ticket_code && (
                    <details>
                      <summary>Код билета</summary>
                      <p style={{ overflowWrap: 'anywhere' }}>
                        {booking.ticket_code}
                      </p>
                    </details>
                  )}

                  {booking.status === 'active' &&
                    new Date(booking.end_at).getTime() <=
                      Date.now() && (
                      <button
                        type="button"
                        className="button button-outline"
                        disabled={busy}
                        onClick={() =>
                          completeBooking(booking)
                        }
                      >
                        Завершить бронь
                      </button>
                    )}
                </article>
              ))}

          {visibleCount < currentList.length && (
            <button
              type="button"
              className="button button-outline admin-show-more"
              onClick={() =>
                setVisibleCount(
                  (count) => count + PAGE_SIZE
                )
              }
            >
              Показать ещё
            </button>
          )}
        </section>
      )}

      {modal?.type === 'movie' && (
        <AdminDialog
          title={
            modal.movie
              ? 'Редактирование фильма'
              : 'Новый фильм'
          }
          onClose={closeModal}
        >
          <MovieForm
            movie={modal.movie}
            genres={genres}
            busy={busy}
            onSave={saveMovie}
            onClose={closeModal}
          />
        </AdminDialog>
      )}

      {modal?.type === 'screening' && (
        <AdminDialog
          title={
            modal.screening
              ? 'Перенос сеанса'
              : 'Новый сеанс'
          }
          onClose={closeModal}
        >
          <ScreeningForm
            screening={modal.screening}
            movies={movies}
            halls={halls}
            busy={busy}
            onSave={saveScreening}
            onClose={closeModal}
          />
        </AdminDialog>
      )}
    </main>
  )
}