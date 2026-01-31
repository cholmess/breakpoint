# Setup Guide for Team Members

This guide will help you set up the project on your local machine so you can run the front-end application.

## Prerequisites

- **Node.js**: Version 18.20.6 or higher (the project is compatible with Node 18.20.6)
- **npm**: Comes with Node.js
- **Git**: To clone/pull the repository

## Step-by-Step Setup

### 1. Clone or Pull the Repository

If you haven't cloned the repository yet:
```bash
git clone https://github.com/cholmess/breakpoint.git
cd breakpoint
```

If you already have the repository, make sure you're on the latest version:
```bash
git pull origin main
# Or if working on a feature branch:
git checkout feature/frontend-dashboard
git pull origin feature/frontend-dashboard
```

### 2. Install Dependencies

Install all required Node.js packages:
```bash
npm install
```

This will:
- Install all dependencies listed in `package.json`
- Create the `node_modules/` directory
- Install Next.js, React, and all UI components

**Note:** This may take a few minutes depending on your internet connection.

### 3. Verify Installation

Check that everything is installed correctly:
```bash
npm list --depth=0
```

You should see packages like `next`, `react`, `react-dom`, etc.

### 4. Run the Development Server

Start the Next.js development server:
```bash
npm run dev
```

You should see output like:
```
  ▲ Next.js 16.1.6
  - Local:        http://localhost:3000
  - Ready in X seconds
```

### 5. Open the Application

Open your browser and navigate to:
```
http://localhost:3000
```

The dashboard should load with:
- The probabilistic failure simulator UI
- Components loading data from API routes
- Interactive configuration forms
- Charts and visualizations

### 6. Using Real API (optional)

To run probes against **real** LLM APIs (OpenAI, Gemini, Manus) instead of simulated data:

1. **Copy the example env file** (in the project root):
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env`** and add API keys for the providers your configs use:
   - **OpenAI** (gpt-4, gpt-3.5-turbo, etc.): `OPENAI_API_KEY=sk-...` — [Get key](https://platform.openai.com/api-keys)
   - **Google Gemini**: `GEMINI_API_KEY=...` or `GEMINI_API_KEY_CH=...` — [Free tier](https://aistudio.google.com/app/apikey)
   - **Manus AI**: `MANUS_API_KEY=...` or `MANUS_API_KEY_CH=...` — [Get key](https://open.manus.ai/docs)

3. **Restart the dev server** so it picks up the new env vars: stop with Ctrl+C, then `npm run dev` again.

4. In the dashboard, select **Run mode → Real API** and click **Run Simulation**.

If a key is missing, the UI will show a warning and disable the Run button; the error message in the console will tell you exactly which key to add and where to get it.

## Troubleshooting

### Issue: "Module not found" errors

**Solution:** Make sure you ran `npm install` and that `node_modules/` directory exists:
```bash
ls -la node_modules/  # Should show many directories
```

If it's missing, run `npm install` again.

### Issue: Port 3000 is already in use

**Solution:** Either:
1. Stop the other process using port 3000, or
2. Run on a different port:
   ```bash
   PORT=3001 npm run dev
   ```
   Then open http://localhost:3001

### Issue: "Command not found: npm"

**Solution:** Install Node.js from https://nodejs.org/ (LTS version recommended)

### Issue: Node.js version mismatch

**Solution:** The project works with Node.js 18.20.6. If you have a different version:
- Use Node Version Manager (nvm) to switch versions:
  ```bash
  nvm install 18.20.6
  nvm use 18.20.6
  ```

### Issue: "OPENAI_API_KEY not found" (or GEMINI_API_KEY / MANUS_API_KEY)

**Solution:** You selected **Real API** but the provider key isn’t set. Do this:
1. Copy `.env.example` to `.env` in the project root: `cp .env.example .env`
2. Open `.env` and add the key (e.g. `OPENAI_API_KEY=sk-your-key-here`)
3. Restart the dev server (`npm run dev`)

See step 6 in the setup section above for links to get API keys.

### Issue: Missing output JSON files

**Solution:** The app will work with empty data, but to see real data:
1. Run the analysis pipeline:
   ```bash
   npm run analyze
   ```
2. This generates `output/analysis.json`, `output/comparisons.json`, and `output/distributions.json`

## Available Scripts

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run probes` - Run probe pipeline
- `npm run analyze` - Generate analysis JSON files
- `npm test` - Run tests

## Project Structure

```
breakpoint/
├── app/                    # Next.js app directory
│   ├── api/               # API routes (serves JSON data)
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main dashboard page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── ...               # Custom components
├── types/                # TypeScript type definitions
├── output/               # Generated JSON files (analysis results)
├── configs/              # Configuration files
├── data/                 # Prompt suites and data
└── package.json          # Dependencies and scripts
```

## Need Help?

If you encounter any issues:
1. Check that Node.js is installed: `node --version`
2. Check that npm is installed: `npm --version`
3. Make sure you're in the project root directory
4. Try deleting `node_modules/` and `package-lock.json`, then run `npm install` again

## Quick Start (TL;DR)

```bash
# 1. Get the code
git clone https://github.com/cholmess/breakpoint.git
cd breakpoint

# 2. Install dependencies
npm install

# 3. Run the app
npm run dev

# 4. Open browser
# Go to http://localhost:3000
```

That's it! 🎉


