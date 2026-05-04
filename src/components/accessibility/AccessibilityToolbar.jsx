import { useEffect, useMemo, useState } from 'react';
import './AccessibilityToolbar.css';

const STORAGE_KEY = 'athar-accessibility-toolbar';
const DEFAULT_SETTINGS = {
  textScale: 1,
  highlightLinks: false,
  underlineHeadings: false,
  highContrast: false,
};
const TEXT_SCALE_STEP = 0.08;
const MIN_TEXT_SCALE = 1;
const MAX_TEXT_SCALE = 1.24;

const clampTextScale = (value) => Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, value));

const getSavedSettings = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const savedSettings = JSON.parse(window.localStorage.getItem(STORAGE_KEY));

    if (!savedSettings || typeof savedSettings !== 'object') {
      return DEFAULT_SETTINGS;
    }

    return {
      textScale: clampTextScale(Number(savedSettings.textScale) || DEFAULT_SETTINGS.textScale),
      highlightLinks: Boolean(savedSettings.highlightLinks),
      underlineHeadings: Boolean(savedSettings.underlineHeadings),
      highContrast: Boolean(savedSettings.highContrast),
    };
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
};

const settingsAreDefault = (settings) =>
  settings.textScale === DEFAULT_SETTINGS.textScale &&
  !settings.highlightLinks &&
  !settings.underlineHeadings &&
  !settings.highContrast;

const AccessibilityToolbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState(getSavedSettings);

  const textScalePercent = useMemo(() => Math.round(settings.textScale * 100), [settings.textScale]);

  useEffect(() => {
    const root = document.documentElement;
    const { body } = document;

    root.style.setProperty('--accessibility-text-scale', settings.textScale.toFixed(2));
    body.classList.toggle('accessibility-highlight-links', settings.highlightLinks);
    body.classList.toggle('accessibility-underline-headings', settings.underlineHeadings);
    body.classList.toggle('accessibility-high-contrast', settings.highContrast);

    try {
      if (settingsAreDefault(settings)) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      }
    } catch (error) {
      // Accessibility controls still work for the session if storage is unavailable.
    }

    return () => {
      root.style.removeProperty('--accessibility-text-scale');
      body.classList.remove(
        'accessibility-highlight-links',
        'accessibility-underline-headings',
        'accessibility-high-contrast',
      );
    };
  }, [settings]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const increaseText = () => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      textScale: clampTextScale(Number((currentSettings.textScale + TEXT_SCALE_STEP).toFixed(2))),
    }));
  };

  const decreaseText = () => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      textScale: clampTextScale(Number((currentSettings.textScale - TEXT_SCALE_STEP).toFixed(2))),
    }));
  };

  const toggleSetting = (settingName) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [settingName]: !currentSettings[settingName],
    }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    setIsOpen(false);
  };

  return (
    <div className="accessibility-toolbar" aria-label="Accessibility tools">
      {isOpen && (
        <div className="accessibility-toolbar__panel" role="dialog" aria-label="Accessibility visual tools">
          <div className="accessibility-toolbar__header">
            <span>Accessibility</span>
            <span className="accessibility-toolbar__scale" aria-live="polite">
              {textScalePercent}%
            </span>
          </div>

          <div className="accessibility-toolbar__grid">
            <button
              type="button"
              className="accessibility-toolbar__option"
              onClick={increaseText}
              disabled={settings.textScale >= MAX_TEXT_SCALE}
            >
              Increase Text
            </button>
            <button
              type="button"
              className="accessibility-toolbar__option"
              onClick={decreaseText}
              disabled={settings.textScale <= MIN_TEXT_SCALE}
            >
              Decrease Text
            </button>
            <button
              type="button"
              className={`accessibility-toolbar__option${settings.highlightLinks ? ' is-active' : ''}`}
              aria-pressed={settings.highlightLinks}
              onClick={() => toggleSetting('highlightLinks')}
            >
              Highlight Links
            </button>
            <button
              type="button"
              className={`accessibility-toolbar__option${settings.underlineHeadings ? ' is-active' : ''}`}
              aria-pressed={settings.underlineHeadings}
              onClick={() => toggleSetting('underlineHeadings')}
            >
              Underline Headings
            </button>
            <button
              type="button"
              className={`accessibility-toolbar__option${settings.highContrast ? ' is-active' : ''}`}
              aria-pressed={settings.highContrast}
              onClick={() => toggleSetting('highContrast')}
            >
              High Contrast
            </button>
            <button type="button" className="accessibility-toolbar__option" onClick={resetSettings}>
              Reset
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="accessibility-toolbar__trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((currentIsOpen) => !currentIsOpen)}
      >
        <span aria-hidden="true">A11y</span>
        <span>Accessibility</span>
      </button>
    </div>
  );
};

export default AccessibilityToolbar;
