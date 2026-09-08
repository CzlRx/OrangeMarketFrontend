import { Star } from 'lucide-react'

export function ReviewStars({
  value,
  onChange,
}: {
  value: number
  onChange?: (value: number) => void
}) {
  return (
    <div className="rating-stars" aria-label={`${value} 星`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          className={star <= value ? 'filled' : ''}
          onClick={onChange ? () => onChange(star) : undefined}
          disabled={!onChange}
          aria-label={`${star} 星`}
        >
          <Star size={18} fill={star <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}
