import { useEffect, useState } from 'react'
import './App.css'
import ScreeningPicker from './ScreeningPicker'
import SeatMap from './SeatMap'
import AuthDialog from './AuthDialog'
import AccountPage from './AccountPage'
import AdminPage from './AdminPage'

function App() {
  const [movies, setMovies] = useState([])
  const [moviesStatus, setMoviesStatus] = useState('loading')
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('Все жанры')
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [activeScreening, setActiveScreening] = useState(null)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadMovies() {
      try {
        const response = await fetch('/api/movies', {
          signal: controller.signal,
        })

        if (!response.ok) throw new Error('Не удалось загрузить афишу')

        const data = await response.json()
        if (!Array.isArray(data)) throw new Error('Ожидался список фильмов')

        setMovies(data)
        setMoviesStatus('ready')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setMoviesStatus('error')
        }
      }
    }

    loadMovies()
    return () => controller.abort()
  }, [])

  const genres = [...new Set(movies.map((movie) => movie.genre).filter(Boolean))]
  const query = search.trim().toLowerCase()

  const filteredMovies = movies.filter((movie) => {
    const matchesSearch = movie.title.toLowerCase().includes(query)
    const matchesGenre = genre === 'Все жанры' || movie.genre === genre
    return matchesSearch && matchesGenre
  })
  const preview = new URLSearchParams(window.location.search).get('preview')
    if (import.meta.env.DEV && preview === 'admin') {
    return <AdminPage />
  }
  if (import.meta.env.DEV && (preview === 'account' || preview === 'empty')) {
    return (
      <AccountPage
        preview
        user={{ name: 'Катя', email: 'viewer@example.test' }}
        bookings={preview === 'empty' ? [] : [
          {
            id: 101,
            movieTitle: 'Рататуй',
            startsAt: '2026-11-14T14:00:00',
            hallName: 'Панорамный зал',
            statusLabel: 'Ожидает подтверждения',
            seats: [
              { row: 3, number: 5 },
              { row: 3, number: 6 },
            ],
          },
        ]}
      />
    )
  }

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <a className="logo" href="#" aria-label="КАДР — главная">
            <span>/</span>КАДР
          </a>

          <nav className="navigation" aria-label="Основная навигация">
            <a href="#afisha">Афиша</a>
            <a href="#about">О кинотеатре</a>
          </nav>

          <button
            type="button"
            className="button button-outline header-login"
            onClick={() => setShowLogin(true)}
          >
            Войти
          </button>
        </div>
      </header>

      {showLogin && <AuthDialog onClose={() => setShowLogin(false)} />}

      <main>
        <section className="hero">
          <div className="container hero-inner">
            <p className="eyebrow">Кинотеатр «КАДР»</p>
            <h1>
              Большое кино.
              <br />
              Твои эмоции.
            </h1>
            <p className="hero-description">
              Истории, ради которых стоит отложить всё.
              Выбирай фильм — и встретимся в зале.
            </p>
            <a className="button button-primary" href="#afisha">
              Смотреть афишу <span aria-hidden="true">↗</span>
            </a>
            <div className="hero-bottom">
              <span>Выбери фильм. Найди своё место.</span>
              <span>01 / КАДР</span>
            </div>
          </div>
          <span className="hero-word" aria-hidden="true">КАДР</span>
        </section>

        <section className="container afisha" id="afisha">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Найди свою историю</p>
              <h2>Афиша</h2>
            </div>
            <p className="muted">Сегодня — хороший день для кино</p>
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
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>

          {moviesStatus === 'loading' && <p>Загружаем афишу…</p>}
          {moviesStatus === 'error' && (
            <p role="alert">Не удалось загрузить афишу. Попробуй обновить страницу.</p>
          )}

          <div className="movie-grid">
            {filteredMovies.map((movie) => (
              <article className="movie-card" key={movie.id}>
                <div className={`poster poster-${movie.id % 2 ? 'train' : 'thriller'}`}>
                  <span className="age">{movie.age_rating}</span>
                  <span className="poster-caption">{movie.description}</span>
                  <strong className="poster-title">{movie.title}</strong>
                  <span className="poster-label">КАДР / КИНО</span>
                </div>

                <p className="movie-meta">
                  {movie.genre} · {movie.duration_minutes} мин
                </p>
                <h3>{movie.title}</h3>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setSelectedMovie(movie)}
                >
                  О фильме <span aria-hidden="true">↗</span>
                </button>
              </article>
            ))}
          </div>

          {moviesStatus === 'ready' && movies.length === 0 && (
            <div className="empty-state">
              <h3>В афише пока нет фильмов</h3>
            </div>
          )}

          {moviesStatus === 'ready' && movies.length > 0 && filteredMovies.length === 0 && (
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
                Сбросить фильтры
              </button>
            </div>
          )}
        </section>

        <section className="about" id="about">
          <div className="container about-inner">
            <p className="eyebrow">О кинотеатре</p>
            <h2>Больше, чем просто просмотр.</h2>
            <p className="muted">
              Большой экран, любимые истории и время для себя.
              «КАДР» — место для твоего следующего киновечера.
            </p>
          </div>
        </section>
      </main>

      <footer className="container footer">
        <a className="logo" href="#"><span>/</span>КАДР</a>
        <p>Учебный проект · Онлайн-бронирование мест</p>
        <a href="#afisha">К афише ↑</a>
      </footer>

      {selectedMovie && (
        <div className="modal-backdrop" hidden={activeScreening !== null}>
          <section
            className="movie-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="movie-title"
          >
            <button
              type="button"
              className="close-button"
              aria-label="Закрыть описание фильма"
              autoFocus
              onClick={() => setSelectedMovie(null)}
            >
              Закрыть ✕
            </button>

            <p className="eyebrow">{selectedMovie.genre}</p>
            <h2 id="movie-title">{selectedMovie.title}</h2>
            <p>{selectedMovie.description}</p>
            <p className="muted">
              {selectedMovie.age_rating} · {selectedMovie.duration_minutes} мин
            </p>

            <ScreeningPicker
              key={selectedMovie.id}
              movieId={selectedMovie.id}
              onSelectScreening={setActiveScreening}
            />
          </section>
        </div>
      )}

      {activeScreening && selectedMovie && (
        <section className="seat-page" aria-labelledby="seat-page-title">
          <div className="seat-page-inner container">
            <button
              type="button"
              className="button button-outline"
              onClick={() => setActiveScreening(null)}
            >
              ← К сеансам
            </button>

            <p className="eyebrow">Выбор мест</p>
            <h1 id="seat-page-title">{selectedMovie.title}</h1>
            <p className="muted">
              {new Date(activeScreening.startsAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
              })}
              {' · '}
              {activeScreening.startsAt.slice(11, 16)}
              {' · '}
              {activeScreening.hall}
            </p>

            <SeatMap
              key={activeScreening.id}
              screening={activeScreening}
              movieTitle={selectedMovie.title}
            />
          </div>
        </section>
      )}
    </>
  )
}

export default App