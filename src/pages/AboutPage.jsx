import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveApiAssetUrl } from '../utils/api';

const slides = [
  { image: 'products/about1.png', alt: 'Athar campaign one' },
  { image: 'products/About Athar2.png', alt: 'Athar campaign two' },
  { image: 'products/About Athar3.png', alt: 'Athar campaign three' },
];

const AboutPage = () => {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((currentSlide) => (currentSlide + 1) % slides.length);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="section-shell pb-6 pt-8">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-line bg-white shadow-soft">
        <div className="border-b border-line px-6 py-5 text-center">
          <h1 className="font-display text-4xl text-ink sm:text-5xl">About Athar</h1>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden bg-cream sm:aspect-[16/9]">
          {slides.map((slide, index) => (
            <img
              key={slide.alt}
              src={resolveApiAssetUrl(slide.image)}
              alt={slide.alt}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                activeSlide === index ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>

        <div className="space-y-0">
          <div className="px-6 py-8 sm:px-8">
            <p className="text-xl leading-9 text-ink sm:text-2xl sm:leading-10">
              Athar is a brand inspired by the spirit of Palestine, blending copper, known for its positive symbolism, with Palestinian embroidery that tells the story of each region through its unique patterns.
            </p>
          </div>
          <div className="border-t border-line px-6 py-8 sm:px-8">
            <p className="text-xl leading-9 text-ink sm:text-2xl sm:leading-10">
              At Athar, we strive to highlight the beauty of Palestinian identity through heritage-inspired accessories that blend the symbolism of copper with the authenticity of Palestinian embroidery in modern designs.
            </p>
          </div>
          <div className="border-t border-line px-6 py-8 sm:px-8">
            <p className="text-xl leading-9 text-ink sm:text-2xl sm:leading-10">
              Customers choose Athar&apos;s products because they offer more than just an accessory; they express identity, carry cultural value, and are presented in modern designs that combine elegance with authenticity.
            </p>
          </div>
        </div>

        <div className="border-t border-line px-6 py-8 text-center">
          <Link to="/products" className="inline-flex min-w-[14rem] items-center justify-center rounded-full bg-blush px-8 py-3 font-display text-2xl text-ink transition hover:bg-rose">
            Start shopping
          </Link>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
