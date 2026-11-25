import { useEffect, useState } from 'react'
import './App.css'
import Afisha from './Afisha'
import ScreeningPicker from './ScreeningPicker'
import SeatMap from './SeatMap'
import AccountPage from './AccountPage'
import AdminPage from './AdminPage'
import AuthDialog, {
  AUTH_TOKEN_KEY,
  AUTH_CHANGED_EVENT,
} from './AuthDialog'

const FEATURED_TITLE = 'Голодные игры: Рассвет жатвы'
const FEATURED_IMAGE = '/images/hunger-games-hero.png'
const FEATURED_RELEASE_DATE = '2026-11-26'

function getToday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function App() {
  const [movies, setMovies] = useState([])
  const [moviesStatus, setMoviesStatus] = useState('loading')
  const [selectedDate, setSelectedDate] = useState(getToday)
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [activeScreening, setActiveScreening] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [user, setUser] = useState(null)
  const [authStatus, setAuthStatus] = useState('loading')
  const [authRetry, setAuthRetry] = useState(0)
  const [page, setPage] = useState('home')
  const [scrollTarget, setScrollTarget] = useState(null)

  useEffect(() => {
    let controller

    async function loadUser() {
      controller?.abort()
      controller = new AbortController()
      const currentController = controller

      const token = sessionStorage.getItem(AUTH_TOKEN_KEY)

      setUser(null)
      setPage('home')

      if (!token) {
        setAuthStatus('guest')
        return
      }

      setAuthStatus('loading')

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: currentController.signal,
        })

        if (currentController.signal.aborted) return

        if (response.status === 401) {
          sessionStorage.removeItem(AUTH_TOKEN_KEY)
          setAuthStatus('guest')
          return
        }

        if (!response.ok) {
          throw new Error('Не удалось проверить вход')
        }

        const data = await response.json()

        if (currentController.signal.aborted) return

        if (!data.id || typeof data.role !== 'string') {
          throw new Error('Некорректные данные пользователя')
        }

        setUser(data)
        setAuthStatus('ready')
      } catch (error) {
        if (
          error.name !== 'AbortError' &&
          !currentController.signal.aborted
        ) {
          setAuthStatus('error')
        }
      }
    }

    loadUser()
    window.addEventListener(AUTH_CHANGED_EVENT, loadUser)

    return () => {
      controller?.abort()
      window.removeEventListener(AUTH_CHANGED_EVENT, loadUser)
    }
  }, [authRetry])

  useEffect(() => {
    if (page !== 'home') return

    const controller = new AbortController()
    setMoviesStatus('loading')

    async function loadMovies() {
      try {
        const response = await fetch('/api/movies', {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Не удалось загрузить афишу')
        }

        const data = await response.json()

        if (!Array.isArray(data)) {
          throw new Error('Ожидался список фильмов')
        }

        if (controller.signal.aborted) return

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
  }, [page])

  useEffect(() => {
    if (page !== 'home' || !scrollTarget) return

    if (scrollTarget.id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      document.getElementById(scrollTarget.id)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }

    setScrollTarget(null)
  }, [page, scrollTarget])

  function goToHome(event, sectionId = 'top') {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return
    }

    event.preventDefault()
    setSelectedMovie(null)
    setActiveScreening(null)
    setShowLogin(false)
    setPage('home')
    setScrollTarget({ id: sectionId })

    const url = new URL(window.location.href)
    url.hash = sectionId === 'top' ? '' : sectionId
    window.history.replaceState(null, '', url)
  }

  function openPersonalPage() {
    if (authStatus === 'error') {
      setAuthRetry((value) => value + 1)
      return
    }

    if (!user) {
      setShowLogin(true)
      return
    }

    setSelectedMovie(null)
    setActiveScreening(null)
    setScrollTarget(null)
    setPage(user.role === 'admin' ? 'admin' : 'account')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function logout() {
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    setUser(null)
    setPage('home')
    setSelectedMovie(null)
    setActiveScreening(null)
    setShowLogin(false)
    setScrollTarget({ id: 'top' })
    setAuthStatus('guest')
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
  }

  const featuredMovie = movies.find(
    (movie) =>
      movie.title.trim().toLowerCase() ===
      FEATURED_TITLE.toLowerCase()
  )

  const preview = new URLSearchParams(
    window.location.search
  ).get('preview')

  const isAccountPage = Boolean(user && page === 'account')
  const isAdminPage = user?.role === 'admin' && page === 'admin'
  const isPersonalPage = isAccountPage || isAdminPage

  const loginLabel =
    authStatus === 'loading'
      ? 'Проверяем вход…'
      : authStatus === 'error'
        ? 'Повторить проверку входа'
        : user
          ? user.role === 'admin'
            ? 'Панель управления'
            : 'Личный кабинет'
          : 'Войти'

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <a
            className="logo"
            href="/"
            aria-label="КАДР — главная"
            onClick={(event) => goToHome(event)}
          >
            <span>/</span>КАДР
          </a>

          <nav
            className="navigation"
            aria-label="Основная навигация"
          >
            <a
              href="/#afisha"
              onClick={(event) => goToHome(event, 'afisha')}
            >
              Афиша
            </a>

            <a
              href="/#about"
              onClick={(event) => goToHome(event, 'about')}
            >
              О кинотеатре
            </a>
          </nav>

          <button
            type="button"
            className="button button-outline header-login"
            disabled={
              !isPersonalPage && authStatus === 'loading'
            }
            onClick={
              isPersonalPage ? logout : openPersonalPage
            }
          >
            {isPersonalPage ? 'Выйти' : loginLabel}
          </button>
        </div>
      </header>

      {showLogin && (
        <AuthDialog onClose={() => setShowLogin(false)} />
      )}

      {isAccountPage ? (
        <AccountPage
          user={user}
          onGoToAfisha={(event) =>
            goToHome(event, 'afisha')
          }
        />
      ) : isAdminPage ? (
        <AdminPage />
      ) : (
        <>
          <main>
            <section
              className="hero"
              style={{
                backgroundImage: `linear-gradient(90deg, rgba(0, 0, 0, 0.45), transparent 75%), url("${FEATURED_IMAGE}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="container hero-inner">
                <p className="eyebrow">
                  Кинотеатр «КАДР»
                </p>

                <h1>
                  Голодные игры
                  <br />
                  Рассвет жатвы
                </h1>

                <p className="hero-description">
                  В кино с 26 ноября 2026
                  <br />
                  {featuredMovie
                    ? [
                        featuredMovie.genre,
                        `${featuredMovie.duration_minutes} мин`,
                        featuredMovie.age_rating,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : 'История Хеймитча Эбернети на 50-х Голодных играх.'}
                </p>

                <button
                  type="button"
                  className="button button-primary"
                  disabled={!featuredMovie}
                  onClick={() => {
                    setSelectedDate((date) =>
                      [
                        date || getToday(),
                        getToday(),
                        FEATURED_RELEASE_DATE,
                      ]
                        .sort()
                        .at(-1)
                    )
                    setSelectedMovie(featuredMovie)
                  }}
                >
                  Выбрать сеанс{' '}
                  <span aria-hidden="true">↗</span>
                </button>

                <div className="hero-bottom">
                  <span>
                    Выбери фильм. Найди своё место.
                  </span>
                  <span>01 / КАДР</span>
                </div>
              </div>
            </section>

            <Afisha
              movies={movies}
              moviesStatus={moviesStatus}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onSelectMovie={setSelectedMovie}
            />

            <section className="about" id="about">
              <div className="container about-inner">
                <p className="eyebrow">О кинотеатре</p>
                <h2>Больше, чем просто просмотр.</h2>
                <p className="muted">
                  Большой экран, любимые истории и время
                  для себя. «КАДР» — место для твоего
                  следующего киновечера.
                </p>
              </div>
            </section>
          </main>

          <footer className="container footer">
            <a
              className="logo"
              href="/"
              onClick={(event) => goToHome(event)}
            >
              <span>/</span>КАДР
            </a>

            <p>
              Учебный проект · Онлайн-бронирование мест
            </p>

            <a
              href="/#afisha"
              onClick={(event) => goToHome(event, 'afisha')}
            >
              К афише ↑
            </a>
          </footer>

          {selectedMovie && (
            <div
              className="modal-backdrop"
              hidden={activeScreening !== null}
            >
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

                <p className="eyebrow">
                  {selectedMovie.genre}
                </p>

                <h2 id="movie-title">
                  {selectedMovie.title}
                </h2>

                <p>{selectedMovie.description}</p>

                <p className="muted">
                  {[
                    selectedMovie.age_rating,
                    `${selectedMovie.duration_minutes} мин`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>

                <ScreeningPicker
                  key={`${selectedMovie.id}:${selectedDate}`}
                  movieId={selectedMovie.id}
                  initialDate={selectedDate || getToday()}
                  onSelectScreening={setActiveScreening}
                />
              </section>
            </div>
          )}

          {activeScreening && selectedMovie && (
            <section
              className="seat-page"
              aria-labelledby="seat-page-title"
            >
              <div className="seat-page-inner container">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setActiveScreening(null)}
                >
                  ← К сеансам
                </button>

                <p className="eyebrow">Выбор мест</p>

                <h1 id="seat-page-title">
                  {selectedMovie.title}
                </h1>

                <p className="muted">
                  {new Date(
                    activeScreening.startsAt
                  ).toLocaleDateString('ru-RU', {
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
                  user={user}
                  authStatus={authStatus}
                  onBookingDone={() => {
                    setActiveScreening(null)
                    setSelectedMovie(null)
                    setPage('home')
                    setScrollTarget({ id: 'top' })
                  }}
                />
              </div>
            </section>
          )}
        </>
      )}
    </>
  )
}

export default App