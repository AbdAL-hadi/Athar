const FavoriteButton = ({ active = false, onClick, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      className={`inline-flex items-center justify-center rounded-full border border-white/60 bg-white/70 text-lg shadow-card transition hover:scale-105 ${className} ${
        active ? 'text-[#c65b68]' : 'text-ink-soft'
      }`}
    >
      <span aria-hidden="true">{active ? '♥' : '♡'}</span>
    </button>
  );
};

export default FavoriteButton;
