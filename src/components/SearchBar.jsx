const SearchBar = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search',
  buttonLabel = 'Search',
  buttonVariant = 'primary',
  showButton = true,
  className = '',
  inputClassName = '',
  buttonClassName = '',
  name = 'search',
}) => {
  const buttonClasses = buttonVariant === 'secondary' ? 'button-secondary' : 'button-primary';

  return (
    <form onSubmit={onSubmit} className={`flex flex-col gap-3 sm:flex-row ${className}`}>
      <input
        type="search"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`field flex-1 ${inputClassName}`}
      />
      {showButton ? (
        <button type="submit" className={`${buttonClasses} whitespace-nowrap ${buttonClassName}`}>
          {buttonLabel}
        </button>
      ) : null}
    </form>
  );
};

export default SearchBar;
