const fs = require('fs');
const path = require('path');

// Base64 encoded minimal PNG icons with "S" letter
// These are simple 1-color placeholder icons

const icons = {
  16: `iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA1ElEQVQ4T6WTsQ3CMBBF/1VCQ0cBEiNkBNgAJoANYAN2YAPYgA1gA9gANiAjsAElHQWiQELXoCSO45BAwtf5/s/2s0F9iqpxBIFaWF0C6AdwwjgD0AagWxCdMfYBnADYrA14FoCXOhxR9cAMOLuuW0jK8wDApOvdAsD9vALQD8CLqsaMgBVjbBHARJb1ZAKgP6o+rjLBl5pmZIDLZVMzs6dz4EsBrP9cxVqnqnoC4BSMsauINIjo5Fy4OgNuKaW1AXBNKW08MiLeG2O0/rvmXM53T+cdP9mWQAGCsNsAAAAASUVORK5CYII=`,
  48: `iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAA2klEQVRoQ+2YsQ3CMBBFf1ahoKOgYASyAUwAG8AGsAFswAawARvABrABbEBGYANKOgpEgYSuQUkc2yEgl5zv/8/2s0EiIYkE1ycSwAroGUD3gAvGGIAOAK2C6IqxD+AEwGZtwKsAvMThkKoHJsC5brtFlDwPAEx53i0A3K8rAL0AvKhaZASsGGOrACayrCcTAN1R9XGVCbS0zMgAl4tFzczezoEvBbD+cxVrnKrqCYBjMMauItImop1z4eoMuKaU1gbANaW08ciIeG+M0frvmnM53z2ddwyfb0n8w38A0pxQQVRFpv8AAAAASUVORK5CYII=`,
  128: `iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAA3klEQVR4Xu3cMQ6AIBAF0d3GxsYGDyAHcP/9eAAvYGOBhRZ0kyeNjYUxHyZMQAghIQkJ/B9IAvBXgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYgAEYQO4D+A1wzTgG0AngAvAD8ALwB3AD8AfwCOAX4BPACcA3wAuAOwB3AC4BXAK4BHAJ4BLAJYBLAJcALgFcArgEcAngEsAlgEsAlwAuAVwC/A6gP4YABYMNVFvdAAAAAElFTkSuQmCC`
};

const iconsDir = path.join(__dirname, '../public/icons');

// Ensure directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Write icons
Object.entries(icons).forEach(([size, base64]) => {
  const buffer = Buffer.from(base64, 'base64');
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Created ${filePath}`);
});

console.log('Icons generated successfully!');
