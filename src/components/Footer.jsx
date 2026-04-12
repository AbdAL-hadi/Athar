const Footer = () => {
  return (
    <footer className="border-t border-line bg-white">
      <div className="section-shell grid gap-8 py-10 md:grid-cols-3">
        <div>
          <h2 className="font-display text-4xl text-ink">Athar</h2>
          <p className="mt-3 text-sm leading-7 text-ink-soft">
            Heritage-inspired accessories presented through a soft, refined storefront experience.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-ink">Quick links</h3>
          <div className="mt-3 space-y-2 text-sm text-ink-soft">
            <p>Products</p>
            <p>Favorite</p>
            <p>Cart</p>
            <p>Track Order</p>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-ink">Contact</h3>
          <div className="mt-3 space-y-2 text-sm text-ink-soft">
            <p>Nablus, Palestine</p>
            <p>hello@athar.ps</p>
            <p>+970 59 123 4567</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
