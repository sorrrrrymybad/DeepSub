import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './i18n/locales/en'
import zh from './i18n/locales/zh'

const resources = {
  en: {
    translation: en,
  },
  zh: {
    translation: zh,
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, 
    }
  })

export default i18n
