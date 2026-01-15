# Procore Power-Up 2.0

High-performance Chrome Extension for Procore with instant access to Drawings, RFIs, and Commitments.

## Tech Stack

- **Preact** - Lightweight React alternative
- **TypeScript** - Type-safe code
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **idb-keyval** - IndexedDB storage
- **react-window** - Virtualized lists for 10k+ items

## Features

- **Side Panel UI** - Native Chrome side panel integration
- **Tabbed Interface** - Drawings, RFIs, Cost tabs
- **Offline Storage** - IndexedDB for instant, offline-capable access
- **Wiretap** - Automatic capture of Procore API responses
- **Headless Scanning** - Direct API fetching using existing cookies
- **Virtualized Lists** - Handle 10,000+ drawings without lag
- **Pop-Out Window** - Open in standalone window
- **Global Project Selector** - Access cached data when not on Procore

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Watch mode for development
npm run build:watch
```

## Loading the Extension

1. Run `npm run build`
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

## Project Structure

```
v2/
├── public/
│   ├── manifest.json      # Chrome extension manifest
│   └── icons/             # Extension icons
├── src/
│   ├── background/        # Service worker
│   ├── content/           # Content scripts & wiretap
│   ├── sidepanel/         # Side panel Preact app
│   │   ├── components/    # UI components
│   │   ├── App.tsx        # Main app component
│   │   └── main.tsx       # Entry point
│   ├── services/          # Storage & API services
│   └── types/             # TypeScript types
├── sidepanel.html         # Side panel HTML entry
└── vite.config.ts         # Vite configuration
```

## Icons

Place your extension icons in `public/icons/`:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

## Notes

- The wiretap runs in the MAIN world to intercept fetch/XHR
- Content script bridges MAIN world to extension ISOLATED world
- IndexedDB provides unlimited storage for large drawing sets
- API calls use `credentials: 'include'` to leverage existing Procore session
