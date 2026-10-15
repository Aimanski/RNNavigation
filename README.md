# WeighApp

A calorie and weight tracking app for Android (and iOS), built with Expo and Supabase. It helps users log meals, follow a daily calorie goal, and stay on top of water, sleep, activity and blood pressure.

## Features

- Sign up and sign in with email or Google, with email verification
- Personal profile with BMI, BMR, TDEE and a daily calorie goal that updates when weight, height or activity changes
- Taste and daily food budget questions during setup, and a weekly "Suggested For You" meal plan that covers the daily calorie goal, avoids allergens, follows your tastes and stays within your budget
- Meal details and a food catalog with allergy warnings and green highlights for suggested foods
- Barcode and photo food scanning (Open Food Facts and AI food analysis)
- Calorie history, weight, water, sleep, activity and blood pressure tracking
- Reminders, light and dark themes
- Weep, the in-app AI chatbot
- Admin panel for managing users, foods, feedback and AI usage

## Tech stack

- Expo SDK 54, React Native, Expo Router (file-based routing), TypeScript
- Supabase: Postgres with row-level security, Auth, Storage and Edge Functions
- Google Gemini through Supabase Edge Functions (the API key never ships in the app)

## Project structure

```
app/            Screens, one file per route (Expo Router)
components/     Reusable UI: layout/, brand/, ui/
lib/            Helpers: auth/, health/, plus Supabase client, cache, theme helpers
providers/      Auth and theme context providers
assets/         Images, icons, splash screens and fonts
supabase/       Edge Functions and SQL migrations
docs/           Privacy policy and terms pages (GitHub Pages)
```

## Getting started

```bash
npm install
npx expo start --dev-client
```

Useful scripts:

```bash
npm run typecheck             # TypeScript check
npm run lint                  # ESLint
npm run eas:build:android:preview   # Android APK build with EAS
```

## Backend

The Supabase URL and anon key in `lib/supabase.js` are public by design. All data access is protected by row-level security (see `supabase/migrations`). Secrets such as the Gemini key live only in Supabase Edge Function secrets and are never committed.

## Related

- WeighApp website: download page for the Android APK
- WeighApp thesis: capstone diagrams and documents
