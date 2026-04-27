// PMax Sentry - Icon Generator
// Creates simple placeholder PNG icons using Canvas API

const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, 'icons');
const SIZES = [16, 48, 128];

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Simple canvas-based icon generator (Node.js compatible)
function generateIcon(size) {
  // For Node.js without canvas, create SVG and convert concept
  // Using a simple approach with placeholder service or base64
  
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background - Google Blue
  ctx.fillStyle = '#1a73e8';
  ctx.fillRect(0, 0, size, size);
  
  // Shield icon (simplified)
  ctx.fillStyle = '#ffffff';
  const centerX = size / 2;
  const centerY = size / 2;
  const shieldWidth = size * 0.6;
  const shieldHeight = size * 0.7;
  
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - shieldHeight / 2);
  ctx.lineTo(centerX + shieldWidth / 2, centerY - shieldHeight / 4);
  ctx.lineTo(centerX + shieldWidth / 2, centerY + shieldHeight / 4);
  ctx.quadraticCurveTo(centerX + shieldWidth / 2, centerY + shieldHeight / 2, centerX, centerY + shieldHeight / 2);
  ctx.quadraticCurveTo(centerX - shieldWidth / 2, centerY + shieldHeight / 2, centerX - shieldWidth / 2, centerY + shieldHeight / 4);
  ctx.lineTo(centerX - shieldWidth / 2, centerY - shieldHeight / 4);
  ctx.closePath();
  ctx.fill();
  
  // Checkmark
  ctx.strokeStyle = '#1a73e8';
  ctx.lineWidth = size * 0.08;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(centerX - shieldWidth / 5, centerY);
  ctx.lineTo(centerX - shieldWidth / 10, centerY + shieldHeight / 5);
  ctx.lineTo(centerX + shieldWidth / 4, centerY - shieldHeight / 6);
  ctx.stroke();
  
  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(ICONS_DIR, `icon${size}.png`);
  fs.writeFileSync(outputPath, buffer);
  
  console.log(`✓ Created icon${size}.png`);
}

// Mock canvas for Node.js (if canvas package not available)
function createCanvas(width, height) {
  // Return a mock canvas object that creates a simple colored PNG
  return {
    getContext: () => ({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      fillRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      closePath: () => {},
      fill: () => {},
      stroke: () => {}
    }),
    toBuffer: () => {
      // Return a minimal valid PNG (1x1 blue pixel as placeholder)
      // This is a base64-encoded 1x1 blue PNG
      return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
    }
  };
}

console.log('PMax Sentry Icon Generator');
console.log('==========================\n');

// Generate icons
SIZES.forEach(size => {
  try {
    // Create simple colored squares as placeholder icons
    // In production, you'd use a proper image library
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="100%" height="100%" fill="#1a73e8"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
            fill="white" font-family="Arial" font-size="${size/2}">🛡️</text>
    </svg>`;
    
    const outputPath = path.join(ICONS_DIR, `icon${size}.png`);
    
    // Save SVG (browsers can handle this, Chrome will convert)
    fs.writeFileSync(outputPath.replace('.png', '.svg'), svgContent);
    
    // Also save a simple placeholder PNG using base64
    // Blue square with white shield emoji
    const bluePixelPNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABr9wU2AAAABlBMVEUAAAD///+l2Z/dAAAAAXRSTlMAQObYZgAAAAFiS0dEAIgFHUgAAAAJcEhZcwAADsQAAA7EAUr/UeQAAAAHdElNRQfmBx8TKyE+KqwjAAAAlElEQVR42u3BAQ0AAAzDoL9ceB4hDVg8oQ4AAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIEPgPH8sBWOo9C14AAAAASUVORK5CYII=', 'base64');
    fs.writeFileSync(outputPath, bluePixelPNG);
    
    console.log(`✓ Created icon${size}.png`);
  } catch (error) {
    console.error(`✗ Failed to create icon${size}.png:`, error.message);
  }
});

console.log('\nIcon generation complete!');
console.log(`Icons saved to: ${ICONS_DIR}`);
console.log('\nNote: These are placeholder icons. Replace with proper PNGs for production.');