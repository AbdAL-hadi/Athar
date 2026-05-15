import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resolveApiAssetUrl } from '../utils/api';

const slides = [
  { image: 'products/about1.png', alt: 'Athar campaign one' },
  { image: 'products/About Athar2.png', alt: 'Athar campaign two' },
  { image: 'products/About Athar3.png', alt: 'Athar campaign three' },
];

const AboutPage = () => {
  const { t } = useTranslation();
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((currentSlide) => (currentSlide + 1) % slides.length);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-white to-blush/20">
      <div className="section-shell pb-12 pt-12">
        {/* Page Header */}
        <div className="mb-12 text-center">
          <h1 className="font-display text-6xl font-bold text-ink mb-3">{t('about.title', 'About Athar')}</h1>
          <p className="text-2xl text-rose font-semibold">{t('about.subtitle', 'Palestinian Heritage & Modern Design')}</p>
        </div>

        {/* Main Carousel Section */}
        <div className="mx-auto mb-16 max-w-5xl overflow-hidden rounded-3xl border-4 border-line bg-white shadow-2xl">
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
            
            {/* Slide Indicators */}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveSlide(index)}
                  className={`h-3 rounded-full transition ${
                    activeSlide === index ? 'bg-rose w-8' : 'bg-white/60 w-3 hover:bg-white'
                  }`}
                  aria-label={t('about.goToSlide', 'Go to slide {{number}}', { number: index + 1 })}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Story Paragraphs */}
        <div className="mx-auto max-w-4xl space-y-10">
          <section>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-rose">{t('about.heritageEyebrow', 'Our Heritage')}</p>
            <h2 className="mt-3 font-display text-4xl font-bold text-ink">{t('about.heritageTitle', 'Rooted in Palestinian craft')}</h2>
            <p className="mt-5 text-lg font-medium leading-9 text-ink-soft">
              {t('about.heritageDescription', 'Athar is a brand inspired by the spirit of Palestine, blending copper, known for its positive symbolism, with Palestinian embroidery that tells the story of each region through its unique patterns.')}
            </p>
          </section>

          <section>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-rose">{t('about.missionEyebrow', 'Our Mission')}</p>
            <h2 className="mt-3 font-display text-4xl font-bold text-ink">{t('about.missionTitle', 'Heritage shaped for today')}</h2>
            <p className="mt-5 text-lg font-medium leading-9 text-ink-soft">
              {t('about.missionDescription', 'At Athar, we strive to highlight the beauty of Palestinian identity through heritage-inspired accessories that blend the symbolism of copper with the authenticity of Palestinian embroidery in modern designs.')}
            </p>
          </section>

          <section>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-rose">{t('about.whyEyebrow', 'Why Choose Us')}</p>
            <h2 className="mt-3 font-display text-4xl font-bold text-ink">{t('about.whyTitle', 'Accessories with meaning')}</h2>
            <p className="mt-5 text-lg font-medium leading-9 text-ink-soft">
              {t('about.whyDescription', "Customers choose Athar's products because they offer more than just an accessory; they express identity, carry cultural value, and are presented in modern designs that combine elegance with authenticity.")}
            </p>
          </section>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <Link 
            to="/products" 
            className="inline-flex min-w-[18rem] items-center justify-center rounded-full bg-rose px-10 py-4 text-base font-bold text-white transition hover:bg-rose/90 hover:shadow-lg"
          >
            {t('about.startShopping', 'Start Shopping Now')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
