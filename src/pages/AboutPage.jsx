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
    <div className="min-h-screen bg-gradient-to-b from-cream via-white to-blush/20">
      <div className="section-shell pb-12 pt-12">
        {/* Page Header */}
        <div className="mb-12 text-center">
          <h1 className="font-display text-6xl font-bold text-ink mb-3">About Athar</h1>
          <p className="text-2xl text-rose font-semibold">Palestinian Heritage & Modern Design</p>
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
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Content Cards in Parallel */}
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Card 1 - Our Heritage */}
            <div className="group overflow-hidden rounded-3xl border-3 border-line bg-gradient-to-br from-rose/10 to-pink-50 shadow-lg transition hover:shadow-2xl hover:-translate-y-2">
              <div className="bg-gradient-to-r from-rose to-pink-400 px-8 py-6">
                <h2 className="text-3xl font-bold text-white">🎨 Our Heritage</h2>
              </div>
              <div className="p-8">
                <p className="text-lg leading-8 text-ink font-medium">
                  Athar is a brand inspired by the spirit of Palestine, blending copper, known for its positive symbolism, with Palestinian embroidery that tells the story of each region through its unique patterns.
                </p>
              </div>
            </div>

            {/* Card 2 - Our Mission */}
            <div className="group overflow-hidden rounded-3xl border-3 border-line bg-gradient-to-br from-blue-50 to-cyan-50 shadow-lg transition hover:shadow-2xl hover:-translate-y-2">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-6">
                <h2 className="text-3xl font-bold text-white">✨ Our Mission</h2>
              </div>
              <div className="p-8">
                <p className="text-lg leading-8 text-ink font-medium">
                  At Athar, we strive to highlight the beauty of Palestinian identity through heritage-inspired accessories that blend the symbolism of copper with the authenticity of Palestinian embroidery in modern designs.
                </p>
              </div>
            </div>

            {/* Card 3 - Why Choose Athar */}
            <div className="group overflow-hidden rounded-3xl border-3 border-line bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg transition hover:shadow-2xl hover:-translate-y-2">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6">
                <h2 className="text-3xl font-bold text-white">💎 Why Choose Us</h2>
              </div>
              <div className="p-8">
                <p className="text-lg leading-8 text-ink font-medium">
                  Customers choose Athar&apos;s products because they offer more than just an accessory; they express identity, carry cultural value, and are presented in modern designs that combine elegance with authenticity.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <Link 
            to="/products" 
            className="inline-flex min-w-[18rem] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose to-pink-500 px-10 py-5 font-display text-2xl font-bold text-white transition hover:shadow-2xl hover:-translate-y-1 transform"
          >
            🛍️ Start Shopping Now
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
