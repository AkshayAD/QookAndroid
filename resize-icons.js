// Script to resize Android app icons
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

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
        const foregroundPath = path.join(androidResDir, folder, 'ic_launcher_foreground.png');

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

        // Create foreground (for adaptive icons) - slightly larger logo in center
        const foregroundSize = Math.round(size * 1.5); // 108dp equivalent for adaptive
        await sharp(inputImage)
            .resize(Math.round(size * 0.7), Math.round(size * 0.7), { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .extend({
                top: Math.round(size * 0.4),
                bottom: Math.round(size * 0.4),
                left: Math.round(size * 0.4),
                right: Math.round(size * 0.4),
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .resize(foregroundSize, foregroundSize)
            .png()
            .toFile(foregroundPath);

        console.log(`Created ${folder}/ic_launcher_foreground.png`);
    }

    console.log('All icons created successfully!');
}

resizeIcons().catch(console.error);
