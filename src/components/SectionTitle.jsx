const SectionTitle = ({
  eyebrow = '',
  title,
  description = '',
  align = 'left',
  action = null,
  className = '',
}) => {
  const alignmentClass = align === 'center' ? 'text-center items-center' : 'text-left items-start';

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className={`flex max-w-3xl flex-col ${alignmentClass}`}>
        {eyebrow ? <p className="text-sm uppercase tracking-[0.22em] text-muted">{eyebrow}</p> : null}
        <h2 className="font-display text-4xl text-ink sm:text-5xl">{title}</h2>
        {description ? <p className="mt-2 text-base leading-8 text-ink-soft sm:text-lg">{description}</p> : null}
      </div>
      {action}
    </div>
  );
};

export default SectionTitle;
