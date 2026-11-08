import { useState } from 'react'
import './App.css'
import ScreeningPicker from './ScreeningPicker'

const movies = [
  {
    id: 1,
    title: 'Последний поезд',
    genre: 'Триллер',
    age: '16+',
    duration: '112 мин',
    poster: 'train',
    caption: 'У каждого свой путь.',
  },
  {
    id: 2,
    title: 'Не по плану',
    genre: 'Комедия',
    age: '12+',
    duration: '98 мин',
    poster: 'comedy',
    caption: 'Лучшее случается случайно.',
  },
  {
    id: 3,
    title: 'Письма домой',
    genre: 'Драма',
    age: '12+',
    duration: '106 мин',
    poster: 'drama',
    caption: 'Есть вещи, которые нужно сказать.',
  },
  {
    id: 4,
    title: 'Тихий этаж',
    genre: 'Триллер',
    age: '18+',
    duration: '104 мин',
    poster: 'thriller',
    caption: 'Здесь тебя услышат.',
  },
]

function App() {
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('Все жанры')
  const [selectedMovie, setSelectedMovie] = useState(null)

  const filteredMovies = movies.filter((movie) => {
    const matchesSearch = movie.title
      .toLowerCase()
      .includes(search.trim().toLowerCase())

    const matchesGenre = genre === 'Все жанры' || movie.genre === genre

    return matchesSearch && matchesGenre
  })

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

          <span className="header-caption">Время для кино</span>
        </div>
      </header>

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
                <option>Все жанры</option>
                <option>Триллер</option>
                <option>Комедия</option>
                <option>Драма</option>
              </select>
            </label>
          </div>

          <div className="movie-grid">
            {filteredMovies.map((movie) => (
              <article className="movie-card" key={movie.id}>
                <div className={`poster poster-${movie.poster}`}>
                  <span className="age">{movie.age}</span>
                  <span className="poster-caption">{movie.caption}</span>
                  <strong className="poster-title">{movie.title}</strong>
                  <span className="poster-label">КАДР / КИНО</span>
                </div>

                <p className="movie-meta">
                  {movie.genre} · {movie.duration}
                </p>
                <h3>{movie.title}</h3>
                <button
                  className="button button-outline"
                  onClick={() => setSelectedMovie(movie)}
                >
                  О фильме <span aria-hidden="true">↗</span>
                </button>
              </article>
            ))}
          </div>

          {filteredMovies.length === 0 && (
            <div className="empty-state">
              <h3>Фильмы не найдены</h3>
              <p>Попробуй другое название или выбери другой жанр.</p>
              <button
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
        <div className="modal-backdrop">
          <section
            className="movie-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="movie-title"
          >
            <button
              className="close-button"
              aria-label="Закрыть описание фильма"
              autoFocus
              onClick={() => setSelectedMovie(null)}
            >
              Закрыть ✕
            </button>
            <p className="eyebrow">{selectedMovie.genre}</p>
            <h2 id="movie-title">{selectedMovie.title}</h2>
            <p>{selectedMovie.caption}</p>
            <p className="muted">
              {selectedMovie.age} · {selectedMovie.duration}
            </p>
            <ScreeningPicker key={selectedMovie.id} movieId={selectedMovie.id} />
          </section>
        </div>
      )}
    </>
  )
}

export default App