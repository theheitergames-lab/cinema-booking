import { useEffect, useState } from 'react'

function MoviePoster({ movie }) {
  const [failed, setFailed] = useState(false)
  const path = movie.poster_path?.trim()

  return (
    <div className={`poster poster-${movie.id % 2 ? 'train' : 'thriller'}`}>
      {path && !failed ? (
        <img
          className="poster-image"
          src={path}
          alt={`Постер фильма «${movie.title}»`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <span className="poster-caption">{movie.description}</span>
          <strong className="poster-title">{movie.title}</strong>
          <span className="poster-label">КАДР / КИНО</span>
        </>
      )}

      {movie.age_rating && (
        <span className="age">{movie.age_rating}</span>
      )}
    </div>
  )
}

// Загрузка через текущий API.
// После обновления сервера заменим эту функцию одним запросом.
async function loadMoviesOnDate(movies, date, signal) {
  const availableMovies = []

  // Запрашиваем расписание небольшими группами.
  for (let index = 0; index < movies.length; index += 4) {
    if (signal.aborted) return []

    const group = movies.slice(index, index + 4)

    const results = await Promise.all(
      group.map(async (movie) => {
        const params = new URLSearchParams({
          movie_id: String(movie.id),
          date,
        })

        const response = await fetch(`/api/screenings?${params}`, {
          signal,
        })

        if (!response.ok) {
          throw new Error('Не удалось загрузить расписание.')
        }

        const screenings = await response.json()

        if (!Array.isArray(screenings)) {
          throw new Error('Сервер вернул некорректное расписание.')
        }

        return screenings.length > 0 ? movie : null
      })
    )

    availableMovies.push(...results.filter(Boolean))
  }

  return availableMovies
}

export default function Afisha({
  movies,
  moviesStatus,
  selectedDate,
  onDateChange,
  onSelectMovie,
}) {
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('Все жанры')
  const [result, setResult] = useState(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (moviesStatus !== 'ready' || !selectedDate) return

    const controller = new AbortController()

    async function loadSchedule() {
      try {
        const data = await loadMoviesOnDate(
          movies,
          selectedDate,
          controller.signal
        )

        if (!controller.signal.aborted) {
          setResult({
            date: selectedDate,
            source: movies,
            retry,
            data,
          })
        }
      } catch (error) {
        if (controller.signal.aborted) return

        setResult({
          date: selectedDate,
          source: movies,
          retry,
          error: error.message,
        })

        controller.abort()
      }
    }

    loadSchedule()
    return () => controller.abort()
  }, [movies, moviesStatus, selectedDate, retry])

  const current =
    result?.date === selectedDate &&
    result?.source === movies &&
    result?.retry === retry
      ? result
      : null

  const ready =
    moviesStatus === 'ready' &&
    Boolean(selectedDate) &&
    Boolean(current) &&
    !current.error

  const moviesOnDate = ready ? current.data : []

  const genres = [
    ...new Set(movies.map((movie) => movie.genre).filter(Boolean)),
  ]

  const query = search.trim().toLowerCase()

  const filteredMovies = moviesOnDate.filter((movie) => {
    const matchesSearch = movie.title.toLowerCase().includes(query)
    const matchesGenre = genre === 'Все жанры' || movie.genre === genre

    return matchesSearch && matchesGenre
  })

  return (
    <section className="container afisha" id="afisha">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Найди свою историю</p>
          <h2>Афиша</h2>
        </div>
        <p className="muted">Выбери дату своего киновечера</p>
      </div>

      <div className="filters">
        <label className="search-field">
          <span>Поиск фильма</span>
          <input
            type="search"
            placeholder="Название фильма"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label className="genre-field">
          <span>Жанр</span>
          <select
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
          >
            <option value="Все жанры">Все жанры</option>
            {genres.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="date-field">
          <span>Дата сеанса</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </label>
      </div>

      <div aria-live="polite">
        {moviesStatus === 'loading' && <p>Загружаем афишу…</p>}

        {moviesStatus === 'error' && (
          <p role="alert">
            Не удалось загрузить фильмы. Попробуй обновить страницу.
          </p>
        )}

        {moviesStatus === 'ready' && !selectedDate && (
          <p>Выбери дату, чтобы посмотреть фильмы и сеансы.</p>
        )}

        {moviesStatus === 'ready' && selectedDate && !current && (
          <p>Загружаем расписание…</p>
        )}

        {moviesStatus === 'ready' && selectedDate && current?.error && (
          <div className="empty-state">
            <p role="alert">{current.error}</p>
            <button
              type="button"
              className="button button-outline"
              onClick={() => setRetry((value) => value + 1)}
            >
              Попробовать снова
            </button>
          </div>
        )}

        {ready && moviesOnDate.length === 0 && (
          <div className="empty-state">
            <h3>На эту дату доступных сеансов нет</h3>
            <p>Выбери другой день.</p>
          </div>
        )}

        {ready &&
          moviesOnDate.length > 0 &&
          filteredMovies.length === 0 && (
            <div className="empty-state">
              <h3>Фильмы не найдены</h3>
              <p>Попробуй другое название или выбери другой жанр.</p>
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setSearch('')
                  setGenre('Все жанры')
                }}
              >
                Сбросить поиск и жанр
              </button>
            </div>
          )}
      </div>

      {ready && filteredMovies.length > 0 && (
        <div className="movie-grid">
          {filteredMovies.map((movie) => (
            <article className="movie-card" key={movie.id}>
              <MoviePoster key={movie.poster_path} movie={movie} />

              <p className="movie-meta">
                {movie.genre} · {movie.duration_minutes} мин
              </p>

              <h3>{movie.title}</h3>

              <button
                type="button"
                className="button button-outline"
                onClick={() => onSelectMovie(movie)}
              >
                О фильме <span aria-hidden="true">↗</span>
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}