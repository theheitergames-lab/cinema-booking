import { useEffect, useRef } from 'react'
import './BookingSuccess.css'

export default function BookingSuccess({
  onClose,
  totalPrice,
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()

    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="booking-success"
      aria-labelledby="booking-success-title"
      aria-describedby="booking-success-description"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <p className="eyebrow">Бронирование</p>

      <h2 id="booking-success-title">
        Бронирование оформлено
      </h2>

      <p
        id="booking-success-description"
        className="muted"
      >
        Информация о бронировании доступна в личном кабинете,
        в разделе «Мои бронирования».
      </p>

      {Number.isFinite(totalPrice) && totalPrice >= 0 && (
        <p>
          К оплате в кинотеатре:{' '}
          <strong>
            {totalPrice.toLocaleString('ru-RU')} ₽
          </strong>
        </p>
      )}

      <button
        type="button"
        className="button button-primary"
        onClick={onClose}
        autoFocus
      >
        Понятно
      </button>
    </dialog>
  )
}