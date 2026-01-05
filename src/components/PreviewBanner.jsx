import React, { useEffect, useState } from 'react';
import './PreviewBanner.css';
import splashLogo from '../assets/app_logo_splash.png';
import panmetroBrand from '../assets/panmetro_brand.png';

export default function PreviewBanner() {
  const images = [splashLogo, panmetroBrand];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="preview-banner-stage" aria-hidden>
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt="brand"
          className={`preview-banner-image ${i === index ? 'active' : 'inactive'}`}
        />
      ))}
    </div>
  );
}


