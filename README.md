# 🎨 Visual Tools

A vanilla JavaScript/CSS web application for visual content processing, powered by FFmpeg.wasm. All processing happens directly in your browser - no server uploads required!

## Features

### 🖼️ Side-by-Side Comparison
Combine two images horizontally for easy comparison. Great for:
- Before/after comparisons
- Design iterations
- Photo editing comparisons

### 🎬 Slideshow Generator
Create MP4 videos with smooth crossfade transitions from multiple images. Features:
- Upload up to 20 images
- Drag to reorder images
- crossfade transitions
- Preview before download

### 🔒 Privacy Redactor
Client-side image editing tool to hide sensitive information. Features:
- Canvas-based editing interface
- Draw rectangles to select areas to redact
- Blur or pixelate effects
- Multiple region selection support
- All processing happens locally in your browser

## Live Demo

Visit [https://riedelnicolas.github.io/VisualTools/](https://riedelnicolas.github.io/VisualTools/)

## Technology Stack

- **TypeScript** (ES6 modules with strict type checking)
- **CSS** with CSS Variables for theming
- **FFmpeg.wasm** for image/video processing
- **Vite** for development and building
- **GitHub Actions** for automated deployment

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/RiedelNicolas/VisualTools.git
cd VisualTools

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development

```bash
# Run development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Project Structure

```
visualTools/
├── index.html                 # Main entry point
├── src/
│   ├── main.js               # App initialization
│   ├── config.js             # Configuration constants
│   ├── core/
│   │   ├── ffmpeg-manager.js # FFmpeg.wasm lifecycle
│   │   ├── state-manager.js  # State management
│   │   └── event-bus.js      # Event system
│   ├── modules/
│   │   ├── comparison/       # Side-by-side comparison tool
│   │   └── slideshow/        # Slideshow generator tool
│   ├── components/           # Reusable UI components
│   ├── utils/                # Utility functions
│   └── assets/
│       ├── css/              # Styles
│       └── icons/            # Icons
├── .github/workflows/
│   └── deploy.yml            # GitHub Pages deployment
├── package.json
└── vite.config.js
```

## Browser Support

This application requires modern browser features:
- SharedArrayBuffer (requires CORS isolation headers)
- File API
- Blob API
- ES6 Modules

Supported browsers:
- Chrome 92+
- Firefox 89+
- Edge 92+
- Safari 15.4+

## Privacy

All image and video processing happens locally in your browser. Your files are never uploaded to any server.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License
