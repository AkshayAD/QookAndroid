// Script to resize Android app icons (ES Module version)
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputImage = path.join(__dirname, 'public', 'Site header logo.png');
const androidResDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

const sizes = [
    { folder: 'mipmap-mdpi', size: 48 },
    { folder: 'mipmap-hdpi', size: 72 },
    { folder: 'mipmap-xhdpi', size: 96 },
    { folder: 'mipmap-xxhdpi', size: 144 },
    { folder: 'mipmap-xxxhdpi', size: 192 },
];

async function resizeIcons() {
    console.log('Starting icon resize...');
    console.log('Input:', inputImage);

    for (const { folder, size } of sizes) {
        const outputPath = path.join(androidResDir, folder, 'ic_launcher.png');
        const roundOutputPath = path.join(androidResDir, folder, 'ic_launcher_round.png');

        // Create square icon with white background
        await sharp(inputImage)
            .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .png()
            .toFile(outputPath);

        console.log(`Created ${folder}/ic_launcher.png (${size}x${size})`);

        // Create round icon (same as square, Android will apply circular mask)
        await sharp(inputImage)
            .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .png()
            .toFile(roundOutputPath);

        console.log(`Created ${folder}/ic_launcher_round.png (${size}x${size})`);
    }

    console.log('All icons created successfully!');
}

resizeIcons().catch(console.error);
