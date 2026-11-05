import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EventConfig, Facility } from '../types/festival';
import { RouteSegment } from './crowdSimulation';
import {
  getFacilityWorldFootprint,
  WorldAABB,
  worldAABBsOverlap,
} from './layoutGenerator';
import { createSeededRandom } from './prng';

const _sharedCanvasTextureCache = new Map<string, THREE.CanvasTexture>();

function getOrCreateSharedCanvasTexture(
  cacheKey: string,
  factory: () => THREE.CanvasTexture,
): THREE.CanvasTexture {
  const existing = _sharedCanvasTextureCache.get(cacheKey);
  if (existing) return existing;
  if (_sharedCanvasTextureCache.size > 96) {
    const oldestKey = _sharedCanvasTextureCache.keys().next().value;
    if (oldestKey) {
      const oldTex = _sharedCanvasTextureCache.get(oldestKey);
      if (oldTex) {
        oldTex.userData = { ...oldTex.userData, shared: false };
      }
      _sharedCanvasTextureCache.delete(oldestKey);
    }
  }
  const created = factory();
  created.userData = { ...created.userData, shared: true };
  _sharedCanvasTextureCache.set(cacheKey, created);
  return created;
}

function makeManicuredLawnTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  return getOrCreateSharedCanvasTexture(`lawn:${maxAnisotropy}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#8cc968';
    ctx.fillRect(0, 0, 256, 256);

    // Subtle park lawn mowing stripes
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.055)' : 'rgba(22, 101, 52, 0.055)';
      ctx.fillRect(i * 32, 0, 32, 256);
    }

    // Organic fine turf grain
    let seed = 1337;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 2400; i++) {
      const gx = nextRand() * 256;
      const gy = nextRand() * 256;
      ctx.fillStyle = nextRand() > 0.5 ? 'rgba(187, 247, 208, 0.16)' : 'rgba(21, 128, 61, 0.14)';
      ctx.fillRect(gx, gy, 2, 3);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 11);
    tex.anisotropy = maxAnisotropy;
    return tex;
  });
}

function makeStonePaverTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  return getOrCreateSharedCanvasTexture(`stonePaver:${maxAnisotropy}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#e5e9f0';
    ctx.fillRect(0, 0, 256, 256);

    const tones = ['#eef2f6', '#e2e8f0', '#dde4ee', '#eaeef4'];
    const tileW = 64;
    const tileH = 32;
    for (let row = 0; row < 8; row++) {
      const offset = (row % 2) * 32;
      for (let col = -1; col < 5; col++) {
        const tx = col * tileW + offset;
        const ty = row * tileH;
        ctx.fillStyle = tones[(row * 3 + col + 8) % tones.length];
        ctx.fillRect(tx + 1.5, ty + 1.5, tileW - 3, tileH - 3);
      }
    }

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.5;
    for (let row = 0; row <= 8; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * tileH);
      ctx.lineTo(256, row * tileH);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 12);
    tex.anisotropy = maxAnisotropy;
    return tex;
  });
}

function makeMenuSignBoardTexture(accentHex: string, titleText = 'MENU'): THREE.CanvasTexture {
  return getOrCreateSharedCanvasTexture(`menuSign:${accentHex}:${titleText}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 160);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 116, 148);

    ctx.fillStyle = accentHex;
    ctx.fillRect(14, 14, 100, 36);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText, 64, 33);

    ctx.fillStyle = '#475569';
    for (let r = 0; r < 4; r++) {
      ctx.fillRect(22, 66 + r * 20, 56, 7);
      ctx.fillStyle = accentHex;
      ctx.fillRect(86, 66 + r * 20, 20, 7);
      ctx.fillStyle = '#475569';
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

function paintAndPreparePart(
  rawGeo: THREE.BufferGeometry,
  hexColor: string,
): THREE.BufferGeometry {
  const geo = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo;
  geo.deleteAttribute('uv');
  if (!geo.attributes.normal) {
    geo.computeVertexNormals();
  }
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color(hexColor);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (geo !== rawGeo) rawGeo.dispose();
  return geo;
}

function makeStripedAwningTexture(primaryHex: string, stripeHex = '#ffffff'): THREE.CanvasTexture {
  return getOrCreateSharedCanvasTexture(`awning:${primaryHex}:${stripeHex}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const stripes = 8;
    const sw = canvas.width / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? primaryHex : stripeHex;
      ctx.fillRect(i * sw, 0, sw, canvas.height);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  });
}

function makeWheelchairSymbolTexture(bgHex = '#2563eb', fgHex = '#ffffff'): THREE.CanvasTexture {
  return getOrCreateSharedCanvasTexture(`isa:${bgHex}:${fgHex}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = fgHex;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 112, 112);

    ctx.fillStyle = fgHex;
    ctx.beginPath();
    ctx.arc(58, 30, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(58, 42);
    ctx.lineTo(58, 72);
    ctx.lineTo(84, 72);
    ctx.lineTo(94, 96);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(58, 55);
    ctx.lineTo(80, 55);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(52, 82, 22, 0.35 * Math.PI, 1.75 * Math.PI);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

function makeTactileBlockTexture(): THREE.CanvasTexture {
  return getOrCreateSharedCanvasTexture('tactileBlock', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 128, 64);

    ctx.fillStyle = '#ca8a04';
    for (let x = 8; x < 128; x += 16) {
      for (let y = 8; y < 64; y += 16) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  });
}

function makeStageScreenTexture(accentHex: string): THREE.CanvasTexture {
  return getOrCreateSharedCanvasTexture(`stageScreen:${accentHex}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e3a8a');
    grad.addColorStop(1, '#312e81');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    for (let i = 0; i < 28; i++) {
      const h = 40 + Math.sin(i * 0.55) * 35 + ((i * 29) % 55);
      ctx.fillStyle = i % 3 === 0 ? '#38bdf8' : i % 2 === 0 ? accentHex : '#a855f7';
      ctx.fillRect(28 + i * 16.5, 128 - h / 2, 10, h);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 492, 236);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

function makeRestroomDoorTexture(isFemale: boolean): THREE.CanvasTexture {
  return getOrCreateSharedCanvasTexture(`restroomDoor:${isFemale ? 'F' : 'M'}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = isFemale ? '#ec4899' : '#2563eb';
    ctx.fillRect(0, 0, 128, 256);

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 120, 248);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(64, 68, 16, 0, Math.PI * 2);
    ctx.fill();

    if (isFemale) {
      ctx.beginPath();
      ctx.moveTo(48, 92);
      ctx.lineTo(80, 92);
      ctx.lineTo(94, 156);
      ctx.lineTo(34, 156);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(49, 156, 11, 46);
      ctx.fillRect(68, 156, 11, 46);
    } else {
      ctx.beginPath();
      ctx.roundRect(42, 92, 44, 58, 8);
      ctx.fill();
      ctx.fillRect(47, 150, 14, 52);
      ctx.fillRect(67, 150, 14, 52);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

function makeCircleBadgeTexture(symbol: 'i' | '+' | 'truck'): THREE.CanvasTexture {
  return getOrCreateSharedCanvasTexture(`circleBadge:${symbol}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const bg = symbol === '+' ? '#ef4444' : symbol === 'i' ? '#1d4ed8' : '#fef08a';
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = symbol === 'truck' ? '#ca8a04' : '#ffffff';
    ctx.stroke();

    if (symbol === '+') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(52, 26, 24, 76);
      ctx.fillRect(26, 52, 76, 24);
    } else if (symbol === 'i') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(64, 34, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(54, 52, 20, 48);
      ctx.fillRect(46, 92, 36, 10);
    } else {
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.arc(64, 58, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(46, 76, 36, 14);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

function makeBannerSignTexture(bgHex: string, label: string, fgHex = '#ffffff'): THREE.CanvasTexture {
  return getOrCreateSharedCanvasTexture(`banner:${bgHex}:${label}:${fgHex}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 112);

    ctx.fillStyle = fgHex;
    ctx.font = 'bold 62px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 66);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

function makeVerticalPhotoZoneTexture(accentHex: string): THREE.CanvasTexture {
  return getOrCreateSharedCanvasTexture(`photoZoneV:${accentHex}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, 232, 488);

    ctx.fillStyle = accentHex;
    ctx.fillRect(24, 26, 208, 62);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PHOTO ZONE', 128, 58);

    const frameY = [108, 200, 292, 384];
    for (let i = 0; i < frameY.length; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#f8fafc' : '#e2e8f0';
      ctx.fillRect(38, frameY[i], 180, 78);
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 3;
      ctx.strokeRect(44, frameY[i] + 6, 168, 66);

      ctx.fillStyle = i % 2 === 0 ? accentHex : '#38bdf8';
      ctx.beginPath();
      ctx.arc(128, frameY[i] + 32, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(108, frameY[i] + 47, 40, 18);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

function makeFloorSurfaceTexture(
  kind:
    | 'epoxy_light'
    | 'expo_carpet'
    | 'wood_parquet'
    | 'polished_dark'
    | 'natural_lawn'
    | 'stone_plaza'
    | 'asphalt_street'
    | 'clay_campus',
  widthM: number,
  depthM: number,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const repX = Math.max(4, Math.round(widthM / 14));
  const repY = Math.max(4, Math.round(depthM / 14));
  return getOrCreateSharedCanvasTexture(`floor:${kind}:${repX}:${repY}:${maxAnisotropy}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    if (kind === 'epoxy_light') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 252, 252);
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(12, 12, 108, 108);
      ctx.fillRect(136, 136, 108, 108);
    } else if (kind === 'expo_carpet') {
      ctx.fillStyle = '#dbeafe';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#bfdbfe';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillRect(128, 128, 128, 128);
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, 128, 128);
      ctx.strokeRect(128, 128, 128, 128);
    } else if (kind === 'wood_parquet') {
      ctx.fillStyle = '#f3d5a5';
      ctx.fillRect(0, 0, 256, 256);
      const plankColors = ['#eec584', '#e5b56d', '#f5deb3', '#deb887'];
      for (let row = 0; row < 8; row++) {
        const py = row * 32;
        ctx.fillStyle = plankColors[row % plankColors.length];
        ctx.fillRect(0, py, 256, 30);
        ctx.strokeStyle = '#c6934b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(256, py);
        ctx.stroke();
        const jointX = ((row * 76) % 200) + 28;
        ctx.beginPath();
        ctx.moveTo(jointX, py);
        ctx.lineTo(jointX, py + 32);
        ctx.stroke();
      }
    } else if (kind === 'polished_dark') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#3b495e';
      ctx.fillRect(8, 8, 116, 116);
      ctx.fillRect(132, 132, 116, 116);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, 252, 252);
    } else if (kind === 'natural_lawn') {
      ctx.fillStyle = '#86efac';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#74e39a';
      ctx.fillRect(0, 0, 128, 256);
      for (let i = 0; i < 180; i++) {
        const gx = (i * 53) % 256;
        const gy = (i * 97) % 256;
        ctx.fillStyle = i % 2 === 0 ? '#4ade80' : '#bbf7d0';
        ctx.fillRect(gx, gy, 3, 7);
      }
    } else if (kind === 'stone_plaza') {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      for (let r = 0; r < 4; r++) {
        const y = r * 64;
        const offset = (r % 2) * 32;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
        for (let x = offset; x < 256; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 64);
          ctx.stroke();
        }
      }
    } else if (kind === 'asphalt_street') {
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 220; i++) {
        const ax = (i * 41) % 256;
        const ay = (i * 83) % 256;
        ctx.fillStyle = i % 2 === 0 ? '#64748b' : '#334155';
        ctx.fillRect(ax, ay, 3, 3);
      }
    } else {
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 200; i++) {
        const cx = (i * 61) % 256;
        const cy = (i * 89) % 256;
        ctx.fillStyle = i % 2 === 0 ? '#fdba74' : '#ffedd5';
        ctx.fillRect(cx, cy, 3, 3);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repX, repY);
    tex.anisotropy = maxAnisotropy;
    return tex;
  });
}

function makeParkingLotTexture(
  widthM: number,
  depthM: number,
  maxAnisotropy: number,
  accessibleParkingEnabled: boolean,
): THREE.CanvasTexture {
  const bays = Math.max(6, Math.round(depthM / 4.2));
  return getOrCreateSharedCanvasTexture(
    `parkingLot:${bays}:${maxAnisotropy}:${accessibleParkingEnabled ? 1 : 0}`,
    () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 14]);
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 20);
      ctx.lineTo(canvas.width / 2, canvas.height - 20);
      ctx.stroke();
      ctx.setLineDash([]);

      const step = (canvas.height - 32) / bays;

      for (let i = 0; i <= bays; i++) {
        const y = 16 + i * step;
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.lineTo(94, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(canvas.width - 94, y);
        ctx.lineTo(canvas.width - 10, y);
        ctx.stroke();

        if (accessibleParkingEnabled && i < Math.min(3, bays)) {
          ctx.fillStyle = '#2563eb';
          ctx.fillRect(12, y + 3, 62, step - 6);

          ctx.fillStyle = '#facc15';
          ctx.fillRect(76, y + 3, 18, step - 6);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2;
          for (let hy = y + 6; hy < y + step - 4; hy += 8) {
            ctx.beginPath();
            ctx.moveTo(76, hy);
            ctx.lineTo(94, hy + 5);
            ctx.stroke();
          }

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(43, y + step * 0.55, 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(43, y + step * 0.3, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      void widthM;
      return tex;
    },
  );
}

function makeLowPolyVehicle(colorHex: string, isAccessibleLiftVan = false): THREE.Group {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.32,
    metalness: 0.35,
  });
  const cabinMat = new THREE.MeshStandardMaterial({
    color: isAccessibleLiftVan ? '#dbeafe' : '#e2e8f0',
    roughness: 0.2,
    metalness: 0.1,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.12,
    metalness: 0.6,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.85,
    metalness: 0.1,
  });

  if (isAccessibleLiftVan) {
    // High-roof wheelchair lift van with blue stripe & rear ramp indicator
    const vanBody = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.55, 2.02), bodyMat);
    vanBody.position.y = 0.96;
    vanBody.castShadow = true;
    car.add(vanBody);

    const blueStripe = new THREE.Mesh(
      new THREE.BoxGeometry(4.54, 0.28, 2.06),
      new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.35 }),
    );
    blueStripe.position.y = 0.85;
    car.add(blueStripe);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.52, 2.06), glassMat);
    glass.position.set(0.1, 1.32, 0);
    car.add(glass);
  } else {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.75, 1.9), bodyMat);
    chassis.position.y = 0.55;
    chassis.castShadow = true;
    car.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 1.68), cabinMat);
    cabin.position.set(-0.15, 1.2, 0);
    cabin.castShadow = true;
    car.add(cabin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.48, 1.72), glassMat);
    windshield.position.set(-0.15, 1.18, 0);
    car.add(windshield);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelPositions: Array<[number, number, number]> = [
    [-1.25, 0.34, 0.92],
    [1.25, 0.34, 0.92],
    [-1.25, 0.34, -0.92],
    [1.25, 0.34, -0.92],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, wy, wz);
    car.add(w);
  }
  return car;
}

/**
 * Builds a physical 3D Barrier-Free Sloped Wheelchair Ramp with dual handrails,
 * safety-yellow tactile warning blocks, and an International Symbol of Access blue landing mat.
 * Oriented so at rotation.y = 0, it climbs from +Z (ground entry) toward -Z (facility threshold at z=0).
 */
function buildWheelchairRampUnit(
  rampWidth: number,
  riseHeight: number,
  rampLength: number,
  includeSignpost = true,
): THREE.Group {
  const unit = new THREE.Group();
  const safeRise = Math.max(0.24, riseHeight);
  const safeLen = Math.max(1.8, rampLength);

  // 1. True right-triangle wedge geometry sitting flush on y = 0
  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(0, 0);
  wedgeShape.lineTo(safeLen, 0);
  wedgeShape.lineTo(0, safeRise);
  wedgeShape.closePath();

  const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
    depth: rampWidth,
    bevelEnabled: false,
  });
  // Extrude is along +Z from 0..rampWidth, with X in 0..safeLen. Rotate so X becomes +Z (outward) and centered on X!
  wedgeGeo.translate(0, 0, -rampWidth / 2);
  wedgeGeo.rotateY(-Math.PI / 2);

  const rampDeckMat = new THREE.MeshStandardMaterial({
    color: '#0284c7',
    roughness: 0.55,
    metalness: 0.15,
  });
  const wedgeMesh = new THREE.Mesh(wedgeGeo, rampDeckMat);
  wedgeMesh.castShadow = true;
  wedgeMesh.receiveShadow = true;
  unit.add(wedgeMesh);

  // 2. Anti-slip white center guide strips + aluminum side curbs + dual stainless handrails
  const railMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.28,
    metalness: 0.78,
  });
  const slopeAngle = Math.atan2(safeRise, safeLen);
  const hyp = Math.hypot(safeLen, safeRise);
  const railHeight = 0.82;

  for (const side of [-1, 1]) {
    const rx = side * (rampWidth * 0.48);

    // Side safety wheel curb
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, hyp), railMat);
    curb.position.set(rx, safeRise * 0.5 + 0.05, safeLen * 0.5);
    curb.rotation.x = slopeAngle;
    unit.add(curb);

    // Sloped top & mid handrails
    const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, hyp + 0.3, 8), railMat);
    topRail.rotation.x = Math.PI / 2 + slopeAngle;
    topRail.position.set(rx, safeRise * 0.5 + railHeight, safeLen * 0.5);
    topRail.castShadow = true;
    unit.add(topRail);

    // Vertical handrail posts (top, middle, bottom)
    for (const frac of [0.06, 0.5, 0.94]) {
      const pz = safeLen * frac;
      const baseH = safeRise * (1 - frac);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, railHeight, 8),
        railMat,
      );
      post.position.set(rx, baseH + railHeight * 0.5, pz);
      unit.add(post);
    }
  }

  // 3. Safety-Yellow Tactile Warning Paving Strip at bottom landing (compact within front apron)
  const tactileTex = makeTactileBlockTexture();
  const tactileMat = new THREE.MeshStandardMaterial({
    map: tactileTex,
    roughness: 0.75,
  });
  const tactilePad = new THREE.Mesh(
    new THREE.BoxGeometry(rampWidth + 0.25, 0.05, 0.52),
    tactileMat,
  );
  tactilePad.position.set(0, 0.025, safeLen + 0.28);
  unit.add(tactilePad);

  // 4. Blue International Wheelchair Emblem Landing Mat directly at ramp toe
  const isaTex = makeWheelchairSymbolTexture('#2563eb', '#ffffff');
  const isaMat = new THREE.MeshStandardMaterial({
    map: isaTex,
    roughness: 0.65,
  });
  const isaPad = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 1.15), isaMat);
  isaPad.position.set(0, 0.02, safeLen + 1.05);
  unit.add(isaPad);

  // 5. Optional vertical blue Barrier-Free signpost beside the ramp entrance
  if (includeSignpost) {
    const signPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.0, 8),
      railMat,
    );
    signPost.position.set(rampWidth * 0.5 + 0.35, 1.0, safeLen + 0.25);
    unit.add(signPost);

    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.62, 0.08),
      isaMat,
    );
    signBoard.position.set(rampWidth * 0.5 + 0.35, 2.02, safeLen + 0.25);
    signBoard.castShadow = true;
    unit.add(signBoard);
  }

  return unit;
}

/**
 * Builds a traditional stepped curb (단차 계단) shown when wheelchair step-free access is disabled,
 * making the visual difference between OFF (steps) and ON (sloped ramp + handrails + tactile) unmistakable.
 */
function buildSteppedCurbUnit(stepWidth: number, totalRise: number): THREE.Group {
  const unit = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.85 });
  const nosingMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.6 });
  const steps = 3;
  const stepH = Math.max(0.12, totalRise / steps);
  const stepD = 0.42;

  for (let s = 0; s < steps; s++) {
    const h = stepH * (steps - s);
    const stepBox = new THREE.Mesh(new THREE.BoxGeometry(stepWidth, h, stepD), concreteMat);
    stepBox.position.set(0, h / 2, (s + 0.5) * stepD);
    stepBox.castShadow = true;
    unit.add(stepBox);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(stepWidth, 0.04, 0.08), nosingMat);
    nose.position.set(0, h + 0.01, (s + 1) * stepD - 0.04);
    unit.add(nose);
  }
  return unit;
}

export function buildFacilityGroup(
  facility: Facility,
  config?: EventConfig,
  maxAnisotropy = 4,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `facility-${facility.id}`;
  group.position.set(facility.position.x, 0, facility.position.z);
  group.rotation.y = facility.rotation;

  const W = facility.dimensions.width;
  const D = facility.dimensions.depth;
  const H = facility.dimensions.height;
  const accent = facility.colorAccent || '#2563eb';

  const isStepFree = Boolean(
    facility.accessibility.wheelchairAccessible &&
      facility.accessibility.stepFreeEntry &&
      (config ? config.accessibility.stepFreeRoutes : true),
  );
  const hasAccessibleRestroom = config ? config.accessibility.accessibleRestrooms : true;
  const hasAccessibleParking = config ? config.accessibility.accessibleParking : true;
  const boothModel = config?.boothModel ?? 'pagoda_tent';

  switch (facility.subtype) {
    case 'main_stage':
    case 'secondary_stage': {
      const isCenter360 =
        facility.subtype === 'main_stage' &&
        (Boolean(facility.notes?.includes('[360_ARENA]')) ||
          config?.stagePlacement === 'center_360');
      const isRunwayThrust =
        facility.subtype === 'main_stage' &&
        (Boolean(facility.notes?.includes('[RUNWAY_THRUST]')) ||
          config?.stagePlacement === 'runway_keynote');

      if (isCenter360) {
        const stageR = Math.min(W, D) * 0.48;
        const deckMat = new THREE.MeshStandardMaterial({
          color: '#1e293b',
          roughness: 0.68,
          metalness: 0.2,
        });
        const arenaDeck = new THREE.Mesh(
          new THREE.CylinderGeometry(stageR, stageR * 1.04, 1.7, 24),
          deckMat,
        );
        arenaDeck.position.y = 0.85;
        arenaDeck.castShadow = true;
        arenaDeck.receiveShadow = true;
        group.add(arenaDeck);

        const centerRing = new THREE.Mesh(
          new THREE.RingGeometry(stageR * 0.45, stageR * 0.82, 32),
          new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, side: THREE.DoubleSide }),
        );
        centerRing.rotation.x = -Math.PI / 2;
        centerRing.position.y = 1.72;
        group.add(centerRing);

        if (isStepFree) {
          const ramp = buildWheelchairRampUnit(2.4, 1.7, 5.8, true);
          ramp.position.set(-stageR - 1.2, 0, 0);
          group.add(ramp);
        } else {
          const steps = buildSteppedCurbUnit(2.6, 1.7);
          steps.position.set(0, 0, stageR + 1.1);
          group.add(steps);
        }

        const trussMat = new THREE.MeshStandardMaterial({
          color: '#94a3b8',
          roughness: 0.28,
          metalness: 0.82,
        });
        for (let i = 0; i < 4; i++) {
          const ang = (i * Math.PI) / 2 + Math.PI / 4;
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, H - 1.2, 8), trussMat);
          col.position.set(
            Math.cos(ang) * stageR * 0.72,
            1.7 + (H - 1.2) / 2,
            Math.sin(ang) * stageR * 0.72,
          );
          col.castShadow = true;
          group.add(col);
        }

        const haloTruss = new THREE.Mesh(
          new THREE.TorusGeometry(stageR * 0.84, 0.36, 10, 32),
          new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.45 }),
        );
        haloTruss.rotation.x = Math.PI / 2;
        haloTruss.position.y = H + 0.5;
        group.add(haloTruss);

        const screenTex = makeStageScreenTexture(accent);
        const screenMat = new THREE.MeshStandardMaterial({
          map: screenTex,
          emissive: new THREE.Color('#1d4ed8'),
          emissiveMap: screenTex,
          emissiveIntensity: 0.5,
          roughness: 0.25,
        });
        const ledCube = new THREE.Mesh(
          new THREE.BoxGeometry(stageR * 0.76, H * 0.38, stageR * 0.76),
          screenMat,
        );
        ledCube.position.y = H * 0.72;
        group.add(ledCube);

        const beamMat = new THREE.MeshBasicMaterial({
          color: '#60a5fa',
          transparent: true,
          opacity: 0.13,
          depthWrite: false,
        });
        for (let i = 0; i < 4; i++) {
          const ang = (i * Math.PI) / 2;
          const cone = new THREE.Mesh(new THREE.ConeGeometry(4.2, H * 1.05, 14, 1, true), beamMat);
          cone.position.set(Math.cos(ang) * stageR * 0.55, H * 0.54, Math.sin(ang) * stageR * 0.55);
          group.add(cone);
        }
        break;
      }

      const deckMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.72, metalness: 0.15 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 1.8, D), deckMat);
      deck.position.y = 0.9;
      deck.castShadow = true;
      deck.receiveShadow = true;
      group.add(deck);

      const carpetMat = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.85, metalness: 0.05 });
      if (isRunwayThrust) {
        const catwalk = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.76, 11.5), deckMat);
        catwalk.position.set(0, 0.88, D * 0.5 + 5.6);
        catwalk.castShadow = true;
        group.add(catwalk);

        const catwalkCarpet = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.82, 11.2), carpetMat);
        catwalkCarpet.position.set(0, 0.91, D * 0.5 + 5.6);
        group.add(catwalkCarpet);

        const tHead = new THREE.Mesh(new THREE.BoxGeometry(11.0, 1.78, 4.2), deckMat);
        tHead.position.set(0, 0.89, D * 0.5 + 11.8);
        tHead.castShadow = true;
        group.add(tHead);

        const tHeadTop = new THREE.Mesh(
          new THREE.BoxGeometry(10.2, 1.84, 3.4),
          new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45 }),
        );
        tHeadTop.position.set(0, 0.92, D * 0.5 + 11.8);
        group.add(tHeadTop);
      } else {
        const thrust = new THREE.Mesh(new THREE.BoxGeometry(W * 0.45, 1.84, 3.4), carpetMat);
        thrust.position.set(0, 0.92, D * 0.5 + 1.2);
        thrust.castShadow = true;
        group.add(thrust);
      }

      // Stage Accessibility: Side Stage Wheelchair Ramp + Front-Side Elevated Wheelchair Viewing Platform!
      if (isStepFree) {
        const stageRamp = buildWheelchairRampUnit(2.4, 1.8, 6.2, true);
        stageRamp.position.set(-W * 0.5 - 1.35, 0, -D * 0.15);
        group.add(stageRamp);

        // Dedicated Front-Side Barrier-Free Wheelchair Viewing Platform (무장애 관람 데크)
        const viewDeckW = Math.min(8.5, W * 0.28);
        const viewDeckD = 4.6;
        const viewDeckH = 0.58;
        const viewX = -W * 0.36;
        const viewZ = D * 0.5 + 5.2;

        const viewDeck = new THREE.Mesh(
          new THREE.BoxGeometry(viewDeckW, viewDeckH, viewDeckD),
          new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.55 }),
        );
        viewDeck.position.set(viewX, viewDeckH / 2, viewZ);
        viewDeck.castShadow = true;
        viewDeck.receiveShadow = true;
        group.add(viewDeck);

        const isaFloorTex = makeWheelchairSymbolTexture('#2563eb', '#ffffff');
        const isaMat = new THREE.MeshStandardMaterial({ map: isaFloorTex, roughness: 0.6 });
        for (const ox of [-viewDeckW * 0.25, viewDeckW * 0.25]) {
          const bay = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 2.1), isaMat);
          bay.position.set(viewX + ox, viewDeckH + 0.02, viewZ);
          group.add(bay);
        }

        const guardMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.7, roughness: 0.3 });
        const frontGuard = new THREE.Mesh(new THREE.BoxGeometry(viewDeckW, 0.85, 0.12), guardMat);
        frontGuard.position.set(viewX, viewDeckH + 0.42, viewZ - viewDeckD / 2 + 0.08);
        group.add(frontGuard);

        const deckRamp = buildWheelchairRampUnit(2.0, viewDeckH, 2.8, false);
        deckRamp.position.set(viewX, 0, viewZ + viewDeckD / 2);
        group.add(deckRamp);
      } else {
        const stageSteps = buildSteppedCurbUnit(2.8, 1.8);
        stageSteps.position.set(-W * 0.5 - 1.5, 0, 0);
        group.add(stageSteps);
      }

      const darkTrussMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.35, metalness: 0.72 });
      const pillarOffsets: Array<[number, number]> = [
        [-W * 0.44, -D * 0.42],
        [W * 0.44, -D * 0.42],
        [-W * 0.44, D * 0.38],
        [W * 0.44, D * 0.38],
      ];
      for (const [px, pz] of pillarOffsets) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.75, H - 1.5, 0.75), darkTrussMat);
        col.position.set(px, 1.8 + (H - 1.5) / 2, pz);
        col.castShadow = true;
        group.add(col);
      }

      // Open dark steel lighting rig perimeter beams connecting the 4 corner truss columns
      for (const bz of [-D * 0.42, D * 0.38]) {
        const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(W * 0.88 + 0.75, 0.55, 0.65), darkTrussMat);
        crossBeam.position.set(0, H + 0.05, bz);
        crossBeam.castShadow = true;
        group.add(crossBeam);
      }
      for (const bx of [-W * 0.44, W * 0.44]) {
        const sideBeam = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, D * 0.8 + 0.65), darkTrussMat);
        sideBeam.position.set(bx, H + 0.05, -D * 0.02);
        sideBeam.castShadow = true;
        group.add(sideBeam);
      }

      // Center front stage access stairs (Ref Sheet 11)
      if (!isRunwayThrust) {
        for (let s = 0; s < 4; s++) {
          const stepW = Math.min(5.2, W * 0.24);
          const stepH = 1.8 * ((4 - s) / 4);
          const st = new THREE.Mesh(
            new THREE.BoxGeometry(stepW, stepH, 0.55),
            new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.7 }),
          );
          st.position.set(0, stepH / 2, D * 0.5 + 2.95 + s * 0.52);
          group.add(st);
        }
      }

      const screenTex = makeStageScreenTexture(accent);
      const screenMat = new THREE.MeshStandardMaterial({
        map: screenTex,
        emissive: new THREE.Color('#2563eb'),
        emissiveMap: screenTex,
        emissiveIntensity: 0.55,
        roughness: 0.22,
      });
      const screen = new THREE.Mesh(new THREE.BoxGeometry(W * 0.76, H * 0.66, 0.65), screenMat);
      screen.position.set(0, 1.8 + H * 0.36, -D * 0.36);
      group.add(screen);

      // Left & Right Lattice Truss Towers + Curved Line-Array Speaker Hangs + Vertical Side LED Wing Screens
      const spkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.42, metalness: 0.45 });
      for (const side of [-1, 1]) {
        const wingX = side * (W * 0.5 + 2.4);
        const tower = new THREE.Mesh(new THREE.BoxGeometry(1.4, H * 0.96, 1.6), darkTrussMat);
        tower.position.set(wingX, (H * 0.96) / 2, D * 0.24);
        tower.castShadow = true;
        group.add(tower);

        // Curved J-hang line-array speaker cabinets
        for (let c = 0; c < 6; c++) {
          const cab = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.48, 1.15), spkMat);
          cab.position.set(
            side * (W * 0.46 + 0.6),
            H * 0.88 - c * 0.56,
            D * 0.32 + Math.max(0, c - 3) * 0.14,
          );
          cab.rotation.x = Math.max(0, c - 2) * 0.12;
          cab.castShadow = true;
          group.add(cab);
        }

        // Vertical side LED wing screen (Ref Sheet 11 & Aerial Sheet 8)
        const sideLed = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(2.6, W * 0.16), H * 0.58, 0.42),
          screenMat,
        );
        sideLed.position.set(side * (W * 0.5 + 3.2), 1.8 + H * 0.32, D * 0.18);
        sideLed.castShadow = true;
        group.add(sideLed);
      }

      // Freestanding Dual-Leg Giant LED Relay Screen beside secondary_stage (compact within +4.8m wing bound)
      if (facility.subtype === 'secondary_stage') {
        const relayX = W * 0.5 + 2.8;
        for (const lx of [-1.3, 1.3]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.45, H * 0.92, 0.65), darkTrussMat);
          leg.position.set(relayX + lx, (H * 0.92) / 2, 0);
          group.add(leg);
        }
        const relayPanel = new THREE.Mesh(new THREE.BoxGeometry(3.8, H * 0.52, 0.42), screenMat);
        relayPanel.position.set(relayX, H * 0.62, 0.2);
        relayPanel.castShadow = true;
        group.add(relayPanel);
      }

      // Dark acoustic stage backdrop curtain behind LED wall
      const backdropCurtain = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.92, H * 0.78, 0.28),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.88 }),
      );
      backdropCurtain.position.set(0, 1.8 + H * 0.39, -D * 0.44);
      group.add(backdropCurtain);

      // Front Steel Crowd-Control Moat Barriers (Ref Sheet 10 & Overall Aerial View)
      const moatMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.78, roughness: 0.28 });
      const moatZ = isRunwayThrust ? D * 0.5 + 14.1 : D * 0.5 + 4.4;
      for (const side of [-1, 1]) {
        const moatSpan = W * 0.38;
        const moatRail = new THREE.Mesh(new THREE.BoxGeometry(moatSpan, 1.05, 0.1), moatMat);
        moatRail.position.set(side * (W * 0.26), 0.53, moatZ);
        group.add(moatRail);
      }

      for (let m = -2; m <= 2; m++) {
        const mon = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.55, 0.85), spkMat);
        mon.position.set(m * (W * 0.14), 2.05, D * 0.42);
        mon.rotation.x = -0.3;
        group.add(mon);
      }

      // Concert floor blue/violet wash pad + Volumetric stage beams
      const washPad = new THREE.Mesh(
        new THREE.PlaneGeometry(W * 0.92, 3.6),
        new THREE.MeshBasicMaterial({
          color: '#6366f1',
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        }),
      );
      washPad.rotation.x = -Math.PI / 2;
      washPad.position.set(0, 0.09, D * 0.5 + 2.2);
      group.add(washPad);

      const beamMat = new THREE.MeshBasicMaterial({
        color: '#60a5fa',
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      });
      for (const bx of [-W * 0.26, 0, W * 0.26]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, H * 1.15, 16, 1, true), beamMat);
        cone.position.set(bx, H * 0.52, D * 0.32);
        cone.rotation.x = 0.38;
        group.add(cone);
      }
      break;
    }

    case 'seating_block': {
      const padMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.85, metalness: 0.05 });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(W, 0.38, D), padMat);
      pad.position.y = 0.19;
      pad.receiveShadow = true;
      group.add(pad);

      const aisleMat = new THREE.MeshStandardMaterial({
        color: isStepFree ? '#38bdf8' : '#94a3b8',
        roughness: 0.72,
      });
      const aisle = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.42, D * 0.96), aisleMat);
      aisle.position.y = 0.21;
      group.add(aisle);

      const rowMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, metalness: 0.15 });
      const backMat = new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.55 });
      const numRows = Math.max(4, Math.min(9, Math.floor(D / 2.6)));
      const rowSpacing = (D - 3.6) / numRows;
      const sideW = (W - 3.8) / 2;

      for (let r = 0; r < numRows; r++) {
        // Reserve front row partially for wheelchair bays when isStepFree is enabled
        if (isStepFree && r === 0) continue;
        const rz = -D / 2 + 2.2 + r * rowSpacing;
        const stepH = 0.35 + (r / numRows) * 0.7;
        for (const side of [-1, 1]) {
          const sx = side * (sideW / 2 + 1.4);
          const bench = new THREE.Mesh(new THREE.BoxGeometry(sideW, stepH, 1.1), rowMat);
          bench.position.set(sx, 0.38 + stepH / 2, rz);
          bench.castShadow = true;
          bench.receiveShadow = true;
          group.add(bench);

          const backrest = new THREE.Mesh(new THREE.BoxGeometry(sideW, 0.55, 0.25), backMat);
          backrest.position.set(sx, 0.38 + stepH + 0.22, rz + 0.42);
          group.add(backrest);
        }
      }

      if (isStepFree) {
        const isaTex = makeWheelchairSymbolTexture('#2563eb', '#ffffff');
        const isaMat = new THREE.MeshStandardMaterial({ map: isaTex, roughness: 0.6 });
        for (const side of [-1, 1]) {
          for (const sub of [-0.26, 0.26]) {
            const bay = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 2.1), isaMat);
            bay.position.set(side * (sideW / 2 + 1.4) + sub * sideW * 0.65, 0.41, -D / 2 + 2.3);
            group.add(bay);
          }
        }
        const frontRamp = buildWheelchairRampUnit(2.4, 0.42, 2.2, true);
        frontRamp.position.set(0, 0, D / 2);
        group.add(frontRamp);
      } else {
        const rearSteps = buildSteppedCurbUnit(2.4, 0.42);
        rearSteps.position.set(0, 0, D / 2);
        group.add(rearSteps);
      }

      const railMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.4, metalness: 0.7 });
      const frontRail = new THREE.Mesh(new THREE.BoxGeometry(W, 0.95, 0.2), railMat);
      frontRail.position.set(0, 0.5, -D / 2 + 0.2);
      group.add(frontRail);
      break;
    }

    case 'food_truck': {
      // Retro Cream & Mustard Two-Tone Food Truck with Blue-White Striped Awning & Rooftop Emblem (Ref Sheet 7)
      const lowerBodyMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.36, metalness: 0.2 });
      const upperCreamMat = new THREE.MeshStandardMaterial({ color: '#fefce8', roughness: 0.42, metalness: 0.08 });
      const chromeMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.22, metalness: 0.85 });
      const glassMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.15, metalness: 0.65 });
      const wheelMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.85 });

      const truckLen = Math.min(W, 9.2);
      const truckWid = Math.min(D, 4.2);

      // Lower mustard-gold body + Upper cream body
      const lowerBox = new THREE.Mesh(new THREE.BoxGeometry(truckLen * 0.74, 1.35, truckWid), lowerBodyMat);
      lowerBox.position.set(-truckLen * 0.1, 1.18, 0);
      lowerBox.castShadow = true;
      group.add(lowerBox);

      const upperBox = new THREE.Mesh(new THREE.BoxGeometry(truckLen * 0.74, 1.65, truckWid * 0.99), upperCreamMat);
      upperBox.position.set(-truckLen * 0.1, 2.68, 0);
      upperBox.castShadow = true;
      group.add(upperBox);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(truckLen * 0.72, 0.24, truckWid * 0.92), upperCreamMat);
      cap.position.set(-truckLen * 0.1, 3.62, 0);
      group.add(cap);

      // Rooftop menu lightbox + circular emblem medallion (Ref Sheet 7)
      const roofSignBox = new THREE.Mesh(
        new THREE.BoxGeometry(truckLen * 0.44, 0.42, 0.75),
        new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#fef3c7'), emissiveIntensity: 0.35 }),
      );
      roofSignBox.position.set(-truckLen * 0.1, 3.92, 0);
      group.add(roofSignBox);

      const emblemTex = makeCircleBadgeTexture('truck');
      const emblemDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.68, 0.14, 20),
        new THREE.MeshStandardMaterial({ map: emblemTex, roughness: 0.4 }),
      );
      emblemDisc.rotation.x = Math.PI / 2;
      emblemDisc.position.set(-truckLen * 0.1, 4.65, 0);
      emblemDisc.castShadow = true;
      group.add(emblemDisc);

      // Two-tone front cab + chrome grille + round headlights
      const cabLower = new THREE.Mesh(new THREE.BoxGeometry(truckLen * 0.26, 1.25, truckWid * 0.94), lowerBodyMat);
      cabLower.position.set(truckLen * 0.38, 1.12, 0);
      cabLower.castShadow = true;
      group.add(cabLower);

      const cabUpper = new THREE.Mesh(new THREE.BoxGeometry(truckLen * 0.24, 1.15, truckWid * 0.92), upperCreamMat);
      cabUpper.position.set(truckLen * 0.37, 2.3, 0);
      cabUpper.castShadow = true;
      group.add(cabUpper);

      const wind = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.92, truckWid * 0.8), glassMat);
      wind.position.set(truckLen * 0.49, 2.28, 0);
      group.add(wind);

      const grille = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.58, truckWid * 0.58), chromeMat);
      grille.position.set(truckLen * 0.51, 0.98, 0);
      group.add(grille);

      for (const hz of [-truckWid * 0.34, truckWid * 0.34]) {
        const lamp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12),
          new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: new THREE.Color('#fde047'), emissiveIntensity: 0.6 }),
        );
        lamp.rotation.z = Math.PI / 2;
        lamp.position.set(truckLen * 0.51, 1.02, hz);
        group.add(lamp);
      }

      const counterMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.55 });
      const windowRecess = new THREE.Mesh(
        new THREE.BoxGeometry(truckLen * 0.48, 1.25, 0.28),
        new THREE.MeshStandardMaterial({
          color: '#fef3c7',
          emissive: new THREE.Color('#f59e0b'),
          emissiveIntensity: 0.35,
          roughness: 0.4,
        }),
      );
      windowRecess.position.set(-truckLen * 0.1, 2.25, truckWid * 0.5 + 0.03);
      group.add(windowRecess);

      const serviceShelf = new THREE.Mesh(
        new THREE.BoxGeometry(truckLen * 0.5, 0.12, 0.52),
        counterMat,
      );
      serviceShelf.position.set(-truckLen * 0.1, 1.6, truckWid * 0.5 + 0.24);
      group.add(serviceShelf);

      // Universal Design Fold-Down Lowered Service Counter + Compact Barrier-Free Approach Deck
      if (isStepFree) {
        const lowCounter = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 0.12, 0.65),
          new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.35 }),
        );
        lowCounter.position.set(-truckLen * 0.1, 0.78, truckWid * 0.5 + 0.34);
        lowCounter.castShadow = true;
        group.add(lowCounter);

        const approachDeck = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 0.2, 1.05),
          new THREE.MeshStandardMaterial({ color: '#e0f2fe', roughness: 0.75 }),
        );
        approachDeck.position.set(-truckLen * 0.1, 0.1, truckWid * 0.5 + 0.52);
        group.add(approachDeck);

        const ramp = buildWheelchairRampUnit(1.85, 0.2, 1.45, false);
        ramp.position.set(-truckLen * 0.1, 0, truckWid * 0.5 + 1.02);
        group.add(ramp);
      }

      // Crisp Blue & White Striped Awning (Ref Sheet 7)
      const awningTex = makeStripedAwningTexture('#2563eb', '#ffffff');
      const awningMat = new THREE.MeshStandardMaterial({ map: awningTex, roughness: 0.55 });
      const awning = new THREE.Mesh(new THREE.BoxGeometry(truckLen * 0.54, 0.14, 1.55), awningMat);
      awning.position.set(-truckLen * 0.1, 3.05, truckWid * 0.5 + 0.72);
      awning.rotation.x = 0.26;
      awning.castShadow = true;
      group.add(awning);

      // Front-side A-frame menu board tucked cleanly beside cab
      const menuTex = makeMenuSignBoardTexture(accent, 'FOOD');
      const menuBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 1.05, 0.12),
        new THREE.MeshStandardMaterial({ map: menuTex, roughness: 0.45 }),
      );
      menuBoard.position.set(truckLen * 0.22, 0.55, truckWid * 0.5 + 0.48);
      menuBoard.rotation.x = -0.14;
      menuBoard.castShadow = true;
      group.add(menuBoard);

      const wGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14);
      wGeo.rotateX(Math.PI / 2);
      for (const wx of [-truckLen * 0.32, truckLen * 0.34]) {
        for (const wz of [-truckWid * 0.46, truckWid * 0.46]) {
          const wh = new THREE.Mesh(wGeo, wheelMat);
          wh.position.set(wx, 0.55, wz);
          group.add(wh);
        }
      }
      break;
    }

    case 'food_stall': {
      const deckH = boothModel === 'open_canopy' ? 0.22 : 0.34;
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(W, deckH, D),
        new THREE.MeshStandardMaterial({
          color: boothModel === 'wooden_pavilion' ? '#fde68a' : isStepFree ? '#dbeafe' : '#cbd5e1',
          roughness: 0.8,
        }),
      );
      base.position.y = deckH / 2;
      base.receiveShadow = true;
      group.add(base);

      const woodMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.72 });
      const counter = new THREE.Mesh(new THREE.BoxGeometry(W * 0.54, 1.08, 1.05), woodMat);
      counter.position.set(-W * 0.14, deckH + 0.54, D * 0.26);
      counter.castShadow = true;
      group.add(counter);

      // Countertop warm food display cases + interior back prep counter (Ref Sheet 7)
      const displayCase = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.26, 0.38, 0.62),
        new THREE.MeshStandardMaterial({
          color: '#fef3c7',
          emissive: new THREE.Color('#f59e0b'),
          emissiveIntensity: 0.28,
          roughness: 0.3,
        }),
      );
      displayCase.position.set(-W * 0.22, deckH + 1.26, D * 0.24);
      group.add(displayCase);

      const prepShelf = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.68, 0.95, 0.78),
        new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.75 }),
      );
      prepShelf.position.set(0, deckH + 0.48, -D * 0.24);
      group.add(prepShelf);

      // Front menu board sign on counter skirt (Ref Sheet 7 center stalls)
      const menuBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 1.08, 0.1),
        new THREE.MeshStandardMaterial({ map: makeMenuSignBoardTexture(accent, 'MENU'), roughness: 0.45 }),
      );
      menuBoard.position.set(-W * 0.14, deckH + 0.54, D * 0.38);
      menuBoard.rotation.x = -0.12;
      group.add(menuBoard);

      if (isStepFree) {
        const lowCounter = new THREE.Mesh(
          new THREE.BoxGeometry(W * 0.32, 0.76, 1.08),
          new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4 }),
        );
        lowCounter.position.set(W * 0.27, deckH + 0.38, D * 0.26);
        lowCounter.castShadow = true;
        group.add(lowCounter);

        const ramp = buildWheelchairRampUnit(1.85, deckH, 1.55, false);
        ramp.position.set(W * 0.22, 0, D * 0.5);
        group.add(ramp);
      } else {
        const steps = buildSteppedCurbUnit(1.9, deckH);
        steps.position.set(0, 0, D * 0.5);
        group.add(steps);
      }

      if (boothModel === 'modern_container') {
        const containerMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.45 });
        const darkTrim = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.35, metalness: 0.65 });
        const boxShell = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 2.85, D * 0.72), containerMat);
        boxShell.position.set(0, deckH + 1.42, -D * 0.1);
        boxShell.castShadow = true;
        group.add(boxShell);

        const serviceCutout = new THREE.Mesh(
          new THREE.BoxGeometry(W * 0.76, 1.35, 0.18),
          new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.5 }),
        );
        serviceCutout.position.set(0, deckH + 1.65, D * 0.26);
        group.add(serviceCutout);

        const flipAwning = new THREE.Mesh(new THREE.BoxGeometry(W * 0.84, 0.14, 1.7), darkTrim);
        flipAwning.position.set(0, deckH + 2.55, D * 0.38);
        flipAwning.rotation.x = 0.2;
        flipAwning.castShadow = true;
        group.add(flipAwning);

        const roofSign = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.75, 0.22), darkTrim);
        roofSign.position.set(0, deckH + 3.22, D * 0.18);
        group.add(roofSign);
      } else if (boothModel === 'open_canopy') {
        const postMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.65, roughness: 0.3 });
        for (const px of [-W * 0.44, W * 0.44]) {
          for (const pz of [-D * 0.42, D * 0.42]) {
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.0, 8), postMat);
            p.position.set(px, deckH + 1.5, pz);
            group.add(p);
          }
        }
        const stripeTex = makeStripedAwningTexture('#2563eb', '#ffffff');
        const stripeMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.52 });
        for (const side of [-1, 1]) {
          const slope = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.18, D * 0.62), stripeMat);
          slope.position.set(0, deckH + 3.22, side * (D * 0.24));
          slope.rotation.x = side * 0.38;
          slope.castShadow = true;
          group.add(slope);
        }
      } else if (boothModel === 'wooden_pavilion') {
        const cedarMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.78 });
        const canvasRoofMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.68 });
        for (const px of [-W * 0.42, W * 0.42]) {
          for (const pz of [-D * 0.38, D * 0.38]) {
            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.9, 0.26), cedarMat);
            beam.position.set(px, deckH + 1.45, pz);
            beam.castShadow = true;
            group.add(beam);
          }
        }
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 2.4, 0.35), cedarMat);
        backWall.position.set(0, deckH + 1.2, -D * 0.34);
        group.add(backWall);

        for (const side of [-1, 1]) {
          const slope = new THREE.Mesh(new THREE.BoxGeometry(W * 0.62, 0.2, D + 0.6), canvasRoofMat);
          slope.position.set(side * (W * 0.24), deckH + 3.35, 0);
          slope.rotation.z = -side * 0.38;
          slope.castShadow = true;
          group.add(slope);
        }
        // Warm Festoon String Lights along front eave (Ref Sheet 7)
        const bulbMat = new THREE.MeshStandardMaterial({
          color: '#fef08a',
          emissive: new THREE.Color('#f59e0b'),
          emissiveIntensity: 0.75,
        });
        for (let b = -3; b <= 3; b++) {
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), bulbMat);
          bulb.position.set(b * (W * 0.11), deckH + 2.85 - Math.abs(b) * 0.03, D * 0.44);
          group.add(bulb);
        }
      } else if (boothModel === 'geodesic_dome') {
        const rDome = Math.min(W, D) * 0.52;
        const domeGeo = new THREE.IcosahedronGeometry(rDome, 1);
        const domeShell = new THREE.Mesh(
          domeGeo,
          new THREE.MeshStandardMaterial({
            color: '#f8fafc',
            roughness: 0.38,
            metalness: 0.1,
            flatShading: true,
          }),
        );
        domeShell.scale.set(1.08, 0.82, 1.02);
        domeShell.position.set(0, deckH + rDome * 0.35, -0.2);
        domeShell.castShadow = true;
        group.add(domeShell);

        const portalRing = new THREE.Mesh(
          new THREE.TorusGeometry(rDome * 0.56, 0.18, 8, 18, Math.PI),
          new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35 }),
        );
        portalRing.position.set(0, deckH + 0.2, D * 0.34);
        group.add(portalRing);
      } else if (boothModel === 'expo_shell') {
        const panelMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.45 });
        const aluMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.78, roughness: 0.25 });
        const headerMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4 });

        const backWall = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 2.75, 0.14), panelMat);
        backWall.position.set(0, deckH + 1.38, -D * 0.44);
        backWall.castShadow = true;
        group.add(backWall);

        for (const side of [-1, 1]) {
          const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.75, D * 0.88), panelMat);
          sideWall.position.set(side * W * 0.46, deckH + 1.38, 0);
          sideWall.castShadow = true;
          group.add(sideWall);

          const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.9, 0.18), aluMat);
          post.position.set(side * W * 0.46, deckH + 1.45, D * 0.44);
          group.add(post);
        }

        const fascia = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 0.46, 0.2), headerMat);
        fascia.position.set(0, deckH + 2.68, D * 0.44);
        group.add(fascia);
      } else if (boothModel === 'parasol_table') {
        const mastMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.72 });
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.35, 10), mastMat);
        mast.position.set(0, deckH + 1.68, -0.15);
        mast.castShadow = true;
        group.add(mast);

        const stripeTex = makeStripedAwningTexture(accent, '#fffbeb');
        const umbrella = new THREE.Mesh(
          new THREE.ConeGeometry(Math.max(W, D) * 0.58, 1.25, 8),
          new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.58 }),
        );
        umbrella.position.set(0, deckH + 3.45, -0.15);
        umbrella.castShadow = true;
        group.add(umbrella);
      } else if (boothModel === 'inflatable_air') {
        const tubeMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.08 });
        const shellR = Math.min(W, D) * 0.48;
        for (const rotY of [0, Math.PI / 2]) {
          const arch = new THREE.Mesh(
            new THREE.TorusGeometry(shellR, 0.42, 12, 24, Math.PI),
            tubeMat,
          );
          arch.rotation.y = rotY;
          arch.position.set(0, deckH + 0.1, 0);
          arch.castShadow = true;
          group.add(arch);
        }
        const membrane = new THREE.Mesh(
          new THREE.SphereGeometry(shellR * 0.94, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
          new THREE.MeshStandardMaterial({
            color: '#ffffff',
            roughness: 0.32,
            transparent: true,
            opacity: 0.85,
          }),
        );
        membrane.position.set(0, deckH + 0.1, 0);
        group.add(membrane);
      } else {
        // Default: 'pagoda_tent' — Crisp White Pointed Pagoda Tent with Scalloped Valance & White Skirt (Ref Sheet 7)
        const whiteFabricMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.52 });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(W * 0.88, 2.6, 0.35), whiteFabricMat);
        wall.position.set(0, deckH + 1.3, -D * 0.36);
        wall.castShadow = true;
        group.add(wall);

        const frontSkirt = new THREE.Mesh(new THREE.BoxGeometry(W * 0.84, 0.92, 0.14), whiteFabricMat);
        frontSkirt.position.set(0, deckH + 0.46, D * 0.36);
        group.add(frontSkirt);

        const postMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.65, roughness: 0.3 });
        for (const px of [-W * 0.42, W * 0.42]) {
          for (const pz of [-D * 0.38, D * 0.38]) {
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.05, 8), postMat);
            p.position.set(px, deckH + 1.52, pz);
            group.add(p);
          }
        }

        const valance = new THREE.Mesh(
          new THREE.BoxGeometry(W * 0.92, 0.34, D * 0.84),
          new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 }),
        );
        valance.position.y = deckH + 2.95;
        group.add(valance);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(W, D) * 0.68, 1.85, 4), whiteFabricMat);
        roof.position.y = deckH + 3.95;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);

        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), postMat);
        finial.position.y = deckH + 4.92;
        group.add(finial);
      }
      break;
    }

    case 'experience_booth': {
      const deckH = boothModel === 'open_canopy' ? 0.22 : 0.34;
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(W, deckH, D),
        new THREE.MeshStandardMaterial({
          color: boothModel === 'wooden_pavilion' ? '#fef3c7' : isStepFree ? '#e0f2fe' : '#cbd5e1',
          roughness: 0.8,
        }),
      );
      pad.position.y = deckH / 2;
      pad.receiveShadow = true;
      group.add(pad);

      if (isStepFree) {
        const ramp = buildWheelchairRampUnit(1.9, deckH, 1.6, false);
        ramp.position.set(0, 0, D * 0.5);
        group.add(ramp);
      } else {
        const steps = buildSteppedCurbUnit(1.9, deckH);
        steps.position.set(0, 0, D * 0.5);
        group.add(steps);
      }

      const tableH = isStepFree ? 0.76 : 1.02;
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.62, tableH, 1.3),
        new THREE.MeshStandardMaterial({ color: isStepFree ? '#0284c7' : accent, roughness: 0.5 }),
      );
      table.position.set(0, deckH + tableH / 2, D * 0.18);
      table.castShadow = true;
      group.add(table);

      // Interior display backdrop board + tabletop showcase props + front sign (Ref Sheets 6 & 7)
      const backdropBoard = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.68, 1.9, 0.16),
        new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.48 }),
      );
      backdropBoard.position.set(0, deckH + 1.15, -D * 0.28);
      group.add(backdropBoard);

      const backdropBanner = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.56, 0.62, 0.2),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4 }),
      );
      backdropBanner.position.set(0, deckH + 1.68, -D * 0.27);
      group.add(backdropBanner);

      const frontSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.84, 0.96, 0.1),
        new THREE.MeshStandardMaterial({ map: makeMenuSignBoardTexture(accent, 'BOOTH'), roughness: 0.45 }),
      );
      frontSign.position.set(-W * 0.32, deckH + 0.48, D * 0.36);
      frontSign.rotation.x = -0.12;
      group.add(frontSign);

      if (boothModel === 'modern_container') {
        const bodyMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.42, metalness: 0.55 });
        const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.3 });
        const glassMat = new THREE.MeshStandardMaterial({
          color: '#bae6fd',
          roughness: 0.18,
          metalness: 0.35,
          transparent: true,
          opacity: 0.72,
        });

        const containerBox = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 3.05, D * 0.76), bodyMat);
        containerBox.position.set(0, deckH + 1.52, -D * 0.08);
        containerBox.castShadow = true;
        group.add(containerBox);

        const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 2.1, 0.14), glassMat);
        frontGlass.position.set(0, deckH + 1.45, D * 0.31);
        group.add(frontGlass);

        const topFascia = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.68, D * 0.86), accentMat);
        topFascia.position.set(0, deckH + 3.32, -D * 0.04);
        topFascia.castShadow = true;
        group.add(topFascia);

        const visor = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.16, 1.5), accentMat);
        visor.position.set(0, deckH + 2.75, D * 0.42);
        visor.castShadow = true;
        group.add(visor);
      } else if (boothModel === 'open_canopy') {
        const legMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.65, roughness: 0.3 });
        for (const px of [-W * 0.44, W * 0.44]) {
          for (const pz of [-D * 0.44, D * 0.44]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.05, 8), legMat);
            leg.position.set(px, deckH + 1.52, pz);
            group.add(leg);
          }
        }
        const canopyTop = new THREE.Mesh(
          new THREE.BoxGeometry(W + 0.4, 0.24, D + 0.4),
          new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }),
        );
        canopyTop.position.set(0, deckH + 3.12, 0);
        canopyTop.castShadow = true;
        group.add(canopyTop);

        const valance = new THREE.Mesh(
          new THREE.BoxGeometry(W + 0.44, 0.35, 0.12),
          new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }),
        );
        valance.position.set(0, deckH + 2.92, D * 0.5 + 0.18);
        group.add(valance);
      } else if (boothModel === 'wooden_pavilion') {
        const timberMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.76 });
        const shingleMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.82 });
        const trimMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.48 });

        for (const px of [-W * 0.43, W * 0.43]) {
          for (const pz of [-D * 0.42, D * 0.42]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.05, 0.3), timberMat);
            post.position.set(px, deckH + 1.52, pz);
            post.castShadow = true;
            group.add(post);
          }
        }
        const backPanel = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 2.5, 0.28), timberMat);
        backPanel.position.set(0, deckH + 1.25, -D * 0.4);
        group.add(backPanel);

        for (const side of [-1, 1]) {
          const gable = new THREE.Mesh(new THREE.BoxGeometry(W * 0.62, 0.22, D + 0.6), shingleMat);
          gable.position.set(side * (W * 0.25), deckH + 3.55, 0);
          gable.rotation.z = -side * 0.42;
          gable.castShadow = true;
          group.add(gable);
        }
        const signBeam = new THREE.Mesh(new THREE.BoxGeometry(W * 0.72, 0.42, 0.18), trimMat);
        signBeam.position.set(0, deckH + 2.88, D * 0.44);
        group.add(signBeam);
      } else if (boothModel === 'geodesic_dome') {
        const rDome = W * 0.54;
        const domeGeo = new THREE.IcosahedronGeometry(rDome, 1);
        const domeMat = new THREE.MeshStandardMaterial({
          color: '#f8fafc',
          roughness: 0.34,
          metalness: 0.12,
          flatShading: true,
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.scale.set(1, 0.86, 1);
        dome.position.set(0, deckH + rDome * 0.38, -0.15);
        dome.castShadow = true;
        group.add(dome);

        const wireGeo = new THREE.IcosahedronGeometry(rDome * 1.01, 1);
        const wire = new THREE.Mesh(
          wireGeo,
          new THREE.MeshBasicMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.45 }),
        );
        wire.scale.set(1, 0.86, 1);
        wire.position.set(0, deckH + rDome * 0.38, -0.15);
        group.add(wire);

        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(rDome * 0.52, 0.2, 8, 18, Math.PI),
          new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35 }),
        );
        arch.position.set(0, deckH + 0.2, D * 0.38);
        group.add(arch);
      } else if (boothModel === 'expo_shell') {
        const wallMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42 });
        const aluMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.8, roughness: 0.25 });
        const headerMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.38 });

        const carpet = new THREE.Mesh(
          new THREE.BoxGeometry(W * 0.94, 0.05, D * 0.92),
          new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.9 }),
        );
        carpet.position.set(0, deckH + 0.03, 0);
        group.add(carpet);

        const backWall = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 2.8, 0.14), wallMat);
        backWall.position.set(0, deckH + 1.4, -D * 0.45);
        backWall.castShadow = true;
        group.add(backWall);

        for (const side of [-1, 1]) {
          const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.8, D * 0.9), wallMat);
          sideWall.position.set(side * W * 0.46, deckH + 1.4, 0);
          sideWall.castShadow = true;
          group.add(sideWall);

          const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.95, 0.18), aluMat);
          frontPost.position.set(side * W * 0.46, deckH + 1.48, D * 0.45);
          group.add(frontPost);
        }

        const headerBoard = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 0.48, 0.22), headerMat);
        headerBoard.position.set(0, deckH + 2.74, D * 0.45);
        headerBoard.castShadow = true;
        group.add(headerBoard);
      } else if (boothModel === 'parasol_table') {
        const poleMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.72 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.4, 10), poleMat);
        pole.position.set(0, deckH + 1.7, 0);
        pole.castShadow = true;
        group.add(pole);

        const stripeTex = makeStripedAwningTexture(accent, '#ffffff');
        const umbrella = new THREE.Mesh(
          new THREE.ConeGeometry(Math.max(W, D) * 0.58, 1.35, 8),
          new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.55 }),
        );
        umbrella.position.set(0, deckH + 3.55, 0);
        umbrella.castShadow = true;
        group.add(umbrella);
      } else if (boothModel === 'inflatable_air') {
        const tubeMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.34, metalness: 0.08 });
        const archR = Math.min(W, D) * 0.48;
        for (const rotY of [0, Math.PI / 2]) {
          const tube = new THREE.Mesh(
            new THREE.TorusGeometry(archR, 0.44, 12, 24, Math.PI),
            tubeMat,
          );
          tube.rotation.y = rotY;
          tube.position.set(0, deckH + 0.1, 0);
          tube.castShadow = true;
          group.add(tube);
        }
        const domeCap = new THREE.Mesh(
          new THREE.SphereGeometry(archR * 0.94, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
          new THREE.MeshStandardMaterial({
            color: '#f8fafc',
            roughness: 0.32,
            transparent: true,
            opacity: 0.86,
          }),
        );
        domeCap.position.set(0, deckH + 0.1, 0);
        group.add(domeCap);
      } else {
        // Default: 'pagoda_tent'
        const legMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.65, roughness: 0.35 });
        for (const px of [-W * 0.42, W * 0.42]) {
          for (const pz of [-D * 0.42, D * 0.42]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.0, 0.28), legMat);
            leg.position.set(px, deckH + 1.5, pz);
            leg.castShadow = true;
            group.add(leg);
          }
        }

        const fasciaMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45 });
        const fascia = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.55, D * 0.94), fasciaMat);
        fascia.position.y = deckH + 3.1;
        group.add(fascia);

        const peakMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 });
        const peak = new THREE.Mesh(new THREE.ConeGeometry(W * 0.68, 2.2, 4), peakMat);
        peak.position.y = deckH + 4.45;
        peak.rotation.y = Math.PI / 4;
        peak.castShadow = true;
        group.add(peak);

        const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6), legMat);
        flagPole.position.set(W * 0.48, 2.1, D * 0.48);
        group.add(flagPole);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.6, 0.08), fasciaMat);
        flag.position.set(W * 0.48 + 0.35, 2.7, D * 0.48);
        group.add(flag);
      }
      break;
    }

    case 'family_lounge': {
      // Vine-Draped Wooden Pergola & Nursing/Family Rest Pavilion (Ref Sheet 4 right)
      const deckH = 0.28;
      const rampPad = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.8, deckH, D + 0.8),
        new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.85 }),
      );
      rampPad.position.y = deckH / 2;
      rampPad.receiveShadow = true;
      group.add(rampPad);

      if (isStepFree) {
        const ramp = buildWheelchairRampUnit(2.4, deckH, 2.2, true);
        ramp.position.set(0, 0, D * 0.5 + 0.4);
        group.add(ramp);
      } else {
        const steps = buildSteppedCurbUnit(2.2, deckH);
        steps.position.set(0, 0, D * 0.5 + 0.4);
        group.add(steps);
      }

      const timberMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.78 });
      const vineMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.82 });
      const cabinMat = new THREE.MeshStandardMaterial({ color: '#fff1f2', roughness: 0.55 });

      // Pergola corner posts + planter boxes
      for (const px of [-W * 0.42, W * 0.42]) {
        for (const pz of [-D * 0.4, D * 0.4]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.2, 0.32), timberMat);
          post.position.set(px, deckH + 1.6, pz);
          post.castShadow = true;
          group.add(post);

          const planter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.58, 1.1), timberMat);
          planter.position.set(px, deckH + 0.29, pz);
          group.add(planter);

          const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), vineMat);
          shrub.position.set(px, deckH + 0.72, pz);
          group.add(shrub);
        }
      }

      // Overhead timber pergola rafters + lush vine clusters
      const rafterCount = 7;
      for (let r = 0; r < rafterCount; r++) {
        const rx = -W * 0.44 + (r / (rafterCount - 1)) * (W * 0.88);
        const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, D * 0.92), timberMat);
        rafter.position.set(rx, deckH + 3.25, 0);
        rafter.castShadow = true;
        group.add(rafter);
      }
      for (let v = 0; v < 9; v++) {
        const vx = ((v % 3) - 1) * (W * 0.28);
        const vz = (Math.floor(v / 3) - 1) * (D * 0.26);
        const vine = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 6), vineMat);
        vine.scale.set(1.3, 0.38, 1.2);
        vine.position.set(vx, deckH + 3.38, vz);
        group.add(vine);
      }

      // Cozy enclosed nursing & diaper-care pod at rear half
      const nursingPod = new THREE.Mesh(new THREE.BoxGeometry(W * 0.62, 2.55, D * 0.42), cabinMat);
      nursingPod.position.set(0, deckH + 1.28, -D * 0.18);
      nursingPod.castShadow = true;
      group.add(nursingPod);
      break;
    }

    case 'rain_canopy': {
      // Warm-Beige Tensile Shade Sail Canopy with Tensioned Poles & Guy-Wires (Ref Sheet 4 left)
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.14, D),
        new THREE.MeshStandardMaterial({ color: '#e7e5e4', roughness: 0.88 }),
      );
      deck.position.y = 0.07;
      deck.receiveShadow = true;
      group.add(deck);

      const mastMat = new THREE.MeshStandardMaterial({ color: '#78350f', metalness: 0.35, roughness: 0.55 });
      const cableMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.8, roughness: 0.25 });
      const sailMat = new THREE.MeshStandardMaterial({
        color: '#f5ebe0',
        roughness: 0.48,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });

      for (const px of [-W * 0.45, 0, W * 0.45]) {
        for (const pz of [-D * 0.43, D * 0.43]) {
          const poleH = px === 0 ? H + 0.55 : H - 0.65;
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, poleH, 10), mastMat);
          mast.position.set(px, poleH / 2, pz);
          mast.castShadow = true;
          group.add(mast);

          if (px !== 0) {
            const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, poleH * 1.08, 6), cableMat);
            wire.position.set(px + Math.sign(px) * 1.1, poleH * 0.46, pz);
            wire.rotation.z = Math.sign(px) * 0.26;
            group.add(wire);
          }
        }
      }

      // Dual-bay pitched tensile sail membranes
      for (const baySide of [-1, 1]) {
        const sail = new THREE.Mesh(new THREE.BoxGeometry(W * 0.48, 0.16, D * 0.92), sailMat);
        sail.position.set(baySide * (W * 0.23), H - 0.15, 0);
        sail.rotation.z = -baySide * 0.14;
        sail.castShadow = true;
        group.add(sail);
      }

      // Park benches underneath the tensile shade
      const benchWood = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.75 });
      for (const bx of [-W * 0.24, W * 0.24]) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 0.65), benchWood);
        seat.position.set(bx, 0.52, 0);
        seat.castShadow = true;
        group.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.45, 0.12), benchWood);
        back.position.set(bx, 0.8, -0.28);
        group.add(back);
      }
      break;
    }

    case 'rest_plaza':
    case 'fountain_plaza': {
      // Wooden A-Frame Picnic Tables with Cream Octagonal Parasols & Park Benches (Ref Sheet 4 & 10)
      const patio = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.22, D),
        new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.88 }),
      );
      patio.position.y = 0.11;
      patio.receiveShadow = true;
      group.add(patio);

      if (isStepFree) {
        const ramp = buildWheelchairRampUnit(2.2, 0.22, 1.9, false);
        ramp.position.set(0, 0, D * 0.5);
        group.add(ramp);
      }

      if (facility.subtype === 'fountain_plaza') {
        const stoneMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.72 });
        const waterMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.16, metalness: 0.25 });
        const basinR = Math.min(W, D) * 0.26;
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(basinR, basinR * 1.06, 0.72, 24), stoneMat);
        basin.position.set(0, 0.48, 0);
        basin.castShadow = true;
        group.add(basin);

        const water = new THREE.Mesh(new THREE.CylinderGeometry(basinR * 0.88, basinR * 0.88, 0.76, 24), waterMat);
        water.position.set(0, 0.5, 0);
        group.add(water);

        const plume = new THREE.Mesh(
          new THREE.ConeGeometry(0.65, 2.8, 12),
          new THREE.MeshBasicMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.75 }),
        );
        plume.position.set(0, 2.0, 0);
        group.add(plume);
      }

      const cols = Math.max(2, Math.floor(W / 8));
      const rows = Math.max(2, Math.floor(D / 7.5));
      const parasolPalette = ['#fef3c7', '#fffbeb', '#fde68a', '#e0f2fe'];
      const woodMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.76 });
      const ironMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.65, roughness: 0.35 });

      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tx = -W / 2 + (W / (cols + 1)) * (c + 1);
          const tz = -D / 2 + (D / (rows + 1)) * (r + 1);
          if (facility.subtype === 'fountain_plaza' && Math.hypot(tx, tz) < Math.min(W, D) * 0.32) {
            continue;
          }

          // A-frame wooden picnic table + twin attached benches
          const tblTop = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 1.15), woodMat);
          tblTop.position.set(tx, 0.84, tz);
          tblTop.castShadow = true;
          group.add(tblTop);

          for (const side of [-0.82, 0.82]) {
            const benchPlank = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.38), woodMat);
            benchPlank.position.set(tx, 0.52, tz + side);
            group.add(benchPlank);
          }

          const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.75, 8), ironMat);
          ped.position.set(tx, 1.48, tz);
          group.add(ped);

          const umbColor = parasolPalette[idx % parasolPalette.length];
          const umb = new THREE.Mesh(
            new THREE.ConeGeometry(2.35, 0.78, 8),
            new THREE.MeshStandardMaterial({ color: umbColor, roughness: 0.52 }),
          );
          umb.position.set(tx, 3.02, tz);
          umb.castShadow = true;
          group.add(umb);
          idx++;
        }
      }
      break;
    }

    case 'play_zone': {
      // Ferris Wheel + Circular Stone Fountain + Rainbow Inflatable Bounce Slide (Ref Sheets 6, 8, 10)
      const plaza = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.24, D),
        new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.85 }),
      );
      plaza.position.y = 0.12;
      plaza.receiveShadow = true;
      group.add(plaza);

      if (isStepFree) {
        const ramp = buildWheelchairRampUnit(2.2, 0.24, 1.9, false);
        ramp.position.set(0, 0, D * 0.5);
        group.add(ramp);
      }

      // 1. Rainbow Inflatable Bounce Slide at South-East Quadrant (Ref Sheet 6 left)
      const bx = W * 0.24;
      const bz = D * 0.16;
      const bounceBase = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.65, 5.2),
        new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.42 }),
      );
      bounceBase.position.set(bx, 0.56, bz);
      bounceBase.castShadow = true;
      group.add(bounceBase);

      const bounceWall = new THREE.Mesh(
        new THREE.BoxGeometry(5.4, 3.4, 1.8),
        new THREE.MeshStandardMaterial({ color: '#ec4899', roughness: 0.38 }),
      );
      bounceWall.position.set(bx, 2.2, bz - 1.5);
      bounceWall.castShadow = true;
      group.add(bounceWall);

      const bounceArch = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.65, 1.9),
        new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.35 }),
      );
      bounceArch.position.set(bx, 4.15, bz - 1.5);
      group.add(bounceArch);

      for (const sx of [-1.2, 1.2]) {
        const slideChute = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 0.35, 3.8),
          new THREE.MeshStandardMaterial({ color: sx < 0 ? '#facc15' : '#22c55e', roughness: 0.32 }),
        );
        slideChute.position.set(bx + sx, 1.95, bz + 0.6);
        slideChute.rotation.x = 0.56;
        slideChute.castShadow = true;
        group.add(slideChute);
      }

      // 2. Circular Stone Fountain at North-East Quadrant
      const fx = W * 0.24;
      const fz = -D * 0.24;
      const brickMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.75 });
      const waterMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.18, metalness: 0.2 });

      const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.72, 20), brickMat);
      basin.position.set(fx, 0.48, fz);
      basin.castShadow = true;
      group.add(basin);

      const water = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.78, 20), waterMat);
      water.position.set(fx, 0.52, fz);
      group.add(water);

      // 3. Illuminated Ferris Wheel at West Half (Ref Sheet 8 & 10)
      const wx = -W * 0.2;
      const wheelR = 6.2;
      const centerH = 8.0;
      const strutMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.65, roughness: 0.3 });
      const rimMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', metalness: 0.4, roughness: 0.35 });

      for (const zSide of [-1.4, 1.4]) {
        const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 9.2, 8), strutMat);
        legL.position.set(wx - 2.3, 4.3, zSide);
        legL.rotation.z = -0.26;
        legL.castShadow = true;
        group.add(legL);

        const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 9.2, 8), strutMat);
        legR.position.set(wx + 2.3, 4.3, zSide);
        legR.rotation.z = 0.26;
        legR.castShadow = true;
        group.add(legR);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(wheelR, 0.18, 10, 28), rimMat);
        ring.position.set(wx, centerH, zSide * 0.65);
        ring.castShadow = true;
        group.add(ring);
      }

      const GondolaColors = ['#f97316', '#ec4899', '#eab308', '#06b6d4', '#8b5cf6', '#10b981'];
      for (let g = 0; g < 10; g++) {
        const ang = (g / 10) * Math.PI * 2;
        const gx = wx + Math.cos(ang) * wheelR;
        const gy = centerH + Math.sin(ang) * wheelR;
        const gondola = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 1.15, 1.3),
          new THREE.MeshStandardMaterial({ color: GondolaColors[g % GondolaColors.length], roughness: 0.4 }),
        );
        gondola.position.set(gx, gy - 0.5, 0);
        gondola.castShadow = true;
        group.add(gondola);
      }
      break;
    }

    case 'restroom_bank': {
      // White Modular Restroom Block with Blue (Male) & Magenta-Pink (Female) Pictogram Doors (Ref Sheet 3 & 10)
      const deckH = 0.32;
      const wallMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.48 });
      const capMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.42 });

      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(W, deckH, D * 0.84),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.8 }),
      );
      plinth.position.y = deckH / 2;
      group.add(plinth);

      const bldg = new THREE.Mesh(new THREE.BoxGeometry(W, 2.95, D * 0.76), wallMat);
      bldg.position.y = deckH + 1.48;
      bldg.castShadow = true;
      bldg.receiveShadow = true;
      group.add(bldg);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.35, 0.36, D * 0.82), capMat);
      roof.position.y = deckH + 3.12;
      roof.castShadow = true;
      group.add(roof);

      const maleDoorMat = new THREE.MeshStandardMaterial({ map: makeRestroomDoorTexture(false), roughness: 0.42 });
      const femaleDoorMat = new THREE.MeshStandardMaterial({ map: makeRestroomDoorTexture(true), roughness: 0.42 });

      // Modular Restroom Stalls + Integrated Accessible Bay inside [-W/2, +W/2] (zero side overhang!)
      const reservedAccW = hasAccessibleRestroom ? Math.min(3.4, W * 0.28) : 0;
      const regularSpanW = W - reservedAccW - 1.2;
      const stallCount = Math.max(3, Math.floor(regularSpanW / 2.0));
      const spacing = regularSpanW / stallCount;
      const startX = -W / 2 + 0.6;

      for (let i = 0; i < stallCount; i++) {
        const dx = startX + spacing * (i + 0.5);
        const isFemale = i >= Math.floor(stallCount / 2);
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(1.42, spacing * 0.84), 2.35, 0.14),
          isFemale ? femaleDoorMat : maleDoorMat,
        );
        door.position.set(dx, deckH + 1.24, D * 0.38 + 0.05);
        group.add(door);
      }

      // Queue separation steel crowd barrier rail in front (Ref Sheet 10)
      const railMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.78, roughness: 0.28 });
      const frontBarrier = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, 0.92, 0.08), railMat);
      frontBarrier.position.set(-W * 0.16, 0.48, D * 0.5 + 1.05);
      group.add(frontBarrier);

      // Integrated Barrier-Free Accessible Restroom Bay on the right side of the bank (within W!)
      if (hasAccessibleRestroom) {
        const podW = reservedAccW;
        const podX = W / 2 - podW / 2 - 0.35;

        const podRoof = new THREE.Mesh(
          new THREE.BoxGeometry(podW + 0.15, 0.36, D * 0.86),
          new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.4 }),
        );
        podRoof.position.set(podX, deckH + 3.22, 0);
        group.add(podRoof);

        const wideDoor = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(1.55, podW * 0.72), 2.28, 0.18),
          new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.4, metalness: 0.2 }),
        );
        wideDoor.position.set(podX, deckH + 1.18, D * 0.39 + 0.06);
        group.add(wideDoor);

        const isaTex = makeWheelchairSymbolTexture('#2563eb', '#ffffff');
        const isaSign = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.95, 0.1),
          new THREE.MeshStandardMaterial({ map: isaTex, roughness: 0.5 }),
        );
        isaSign.position.set(podX, deckH + 2.52, D * 0.39 + 0.1);
        group.add(isaSign);

        if (isStepFree) {
          const podRamp = buildWheelchairRampUnit(1.9, deckH, 1.55, true);
          podRamp.position.set(podX, 0, D * 0.42);
          group.add(podRamp);
        }
      }

      if (isStepFree && !hasAccessibleRestroom) {
        const mainRamp = buildWheelchairRampUnit(2.0, deckH, 1.55, true);
        mainRamp.position.set(0, 0, D * 0.42);
        group.add(mainRamp);
      } else {
        const steps = buildSteppedCurbUnit(2.1, deckH);
        steps.position.set(-W * 0.16, 0, D * 0.42);
        group.add(steps);
      }
      break;
    }

    case 'medical_station': {
      // White Pitched-Gable Medical Tent with Circular Red '+' Medallion & Curtained Entrance (Ref Sheet 3 & 10)
      const deckH = 0.28;
      const whiteTentMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.52 });
      const curtainMat = new THREE.MeshStandardMaterial({ color: '#ec4899', roughness: 0.55 });

      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.9, deckH, D * 0.86),
        new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.8 }),
      );
      plinth.position.y = deckH / 2;
      group.add(plinth);

      const bldg = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 2.85, D * 0.82), whiteTentMat);
      bldg.position.y = deckH + 1.42;
      bldg.castShadow = true;
      bldg.receiveShadow = true;
      group.add(bldg);

      // Pitched Gable Roof Slopes
      for (const side of [-1, 1]) {
        const roofSlope = new THREE.Mesh(
          new THREE.BoxGeometry(W * 0.52, 0.2, D * 0.88),
          whiteTentMat,
        );
        roofSlope.position.set(side * (W * 0.22), deckH + 3.42, 0);
        roofSlope.rotation.z = -side * 0.42;
        roofSlope.castShadow = true;
        group.add(roofSlope);
      }

      // Circular Red '+' Cross Medallion on Front Gable Peak (Ref Sheet 3)
      const crossTex = makeCircleBadgeTexture('+');
      const crossMedallion = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.15, 0.18, 24),
        new THREE.MeshStandardMaterial({ map: crossTex, roughness: 0.38 }),
      );
      crossMedallion.rotation.x = Math.PI / 2;
      crossMedallion.position.set(0, deckH + 3.65, D * 0.44);
      crossMedallion.castShadow = true;
      group.add(crossMedallion);

      // Front curtained entrance + privacy side panel
      for (const side of [-1, 1]) {
        const flap = new THREE.Mesh(new THREE.BoxGeometry(W * 0.22, 2.25, 0.14), side > 0 ? curtainMat : whiteTentMat);
        flap.position.set(side * (W * 0.26), deckH + 1.14, D * 0.42);
        group.add(flap);
      }

      if (isStepFree) {
        const stretcherRamp = buildWheelchairRampUnit(2.6, deckH, 2.4, true);
        stretcherRamp.position.set(0, 0, D * 0.43);
        group.add(stretcherRamp);
      } else {
        const steps = buildSteppedCurbUnit(2.4, deckH);
        steps.position.set(0, 0, D * 0.43);
        group.add(steps);
      }
      break;
    }

    case 'main_entrance':
    case 'secondary_entrance': {
      // Main Entrance: Curved Blue Illuminated FESTIVAL Arch + Turnstiles + Shrub Planters + 3-Blade Signpost (Ref Sheet 2)
      // Secondary Entrance: Orange & Blue WELCOME Truss Portal + Guard Booth + Traffic Cone (Ref Sheet 10)
      const span = Math.max(W, D);
      const thick = Math.min(W, D);
      const isAlongZ = D > W;

      const archGroup = new THREE.Group();
      if (isAlongZ) archGroup.rotation.y = Math.PI / 2;

      const halfSpan = span * 0.42;
      const metalMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.78, roughness: 0.26 });

      if (facility.subtype === 'main_entrance') {
        const blueGlowMat = new THREE.MeshStandardMaterial({
          color: '#1d4ed8',
          emissive: new THREE.Color('#1e40af'),
          emissiveIntensity: 0.35,
          roughness: 0.32,
          metalness: 0.2,
        });

        for (const side of [-1, 1]) {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.1, H * 0.58, thick * 0.52), blueGlowMat);
          pillar.position.set(side * halfSpan, (H * 0.58) / 2, 0);
          pillar.castShadow = true;
          archGroup.add(pillar);

          // Shrub planter boxes flanking the gate (compact within +1.5m side apron — Ref Sheet 2)
          const planter = new THREE.Mesh(
            new THREE.BoxGeometry(1.25, 0.88, 1.25),
            new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 }),
          );
          planter.position.set(side * (halfSpan + 1.45), 0.44, 0);
          archGroup.add(planter);
          const bush = new THREE.Mesh(
            new THREE.SphereGeometry(0.75, 8, 8),
            new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.8 }),
          );
          bush.position.set(side * (halfSpan + 1.45), 1.2, 0);
          archGroup.add(bush);
        }

        // Segmented curved arch crown
        const archCrown = new THREE.Mesh(
          new THREE.TorusGeometry(halfSpan, 1.05, 10, 28, Math.PI),
          blueGlowMat,
        );
        archCrown.scale.set(1, 0.46, 0.65);
        archCrown.position.set(0, H * 0.56, 0);
        archCrown.castShadow = true;
        archGroup.add(archCrown);

        const festSignTex = makeBannerSignTexture('#1d4ed8', 'FESTIVAL');
        const festSign = new THREE.Mesh(
          new THREE.BoxGeometry(span * 0.46, 1.75, thick * 0.58),
          new THREE.MeshStandardMaterial({ map: festSignTex, roughness: 0.3 }),
        );
        festSign.position.set(0, H * 0.56 + halfSpan * 0.44, 0);
        archGroup.add(festSign);

        // 3-Blade Blue Directional Wayfinding Signpost (tucked cleanly at halfSpan + 2.35m)
        const signPostX = halfSpan + 2.35;
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.14, 3.8, 8),
          new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.6 }),
        );
        post.position.set(signPostX, 1.9, thick * 0.35);
        archGroup.add(post);
        for (let b = 0; b < 3; b++) {
          const blade = new THREE.Mesh(
            new THREE.BoxGeometry(1.75, 0.34, 0.1),
            new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.4 }),
          );
          blade.position.set(signPostX + 0.15, 3.4 - b * 0.48, thick * 0.35);
          blade.rotation.y = (b - 1) * 0.18;
          archGroup.add(blade);
        }
      } else {
        // Secondary Entrance: Orange & Blue WELCOME Truss Gate + Security Booth (Ref Sheet 10 bottom-right)
        const orangeMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.42, metalness: 0.18 });
        const trussCrossMat = new THREE.MeshStandardMaterial({ color: '#fb923c', metalness: 0.65, roughness: 0.32 });

        for (const side of [-1, 1]) {
          const tower = new THREE.Mesh(new THREE.BoxGeometry(2.1, H, thick * 0.56), orangeMat);
          tower.position.set(side * halfSpan, H / 2, 0);
          tower.castShadow = true;
          archGroup.add(tower);
        }

        const trussSpan = new THREE.Mesh(new THREE.BoxGeometry(span * 0.88, 1.5, thick * 0.44), trussCrossMat);
        trussSpan.position.set(0, H - 1.0, 0);
        archGroup.add(trussSpan);

        const welcomeTex = makeBannerSignTexture('#2563eb', 'WELCOME');
        const welcomeBoard = new THREE.Mesh(
          new THREE.BoxGeometry(span * 0.56, 1.85, thick * 0.58),
          new THREE.MeshStandardMaterial({ map: welcomeTex, roughness: 0.32 }),
        );
        welcomeBoard.position.set(0, H - 1.0, 0);
        welcomeBoard.castShadow = true;
        archGroup.add(welcomeBoard);

        // Adjacent White Security Guard Booth (compact within +2.6m side bound)
        const guardBooth = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 2.65, 2.2),
          new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.55 }),
        );
        guardBooth.position.set(halfSpan + 1.95, 1.32, 0);
        guardBooth.castShadow = true;
        archGroup.add(guardBooth);
      }

      // Stainless Steel Turnstile Gates
      const laneCount = Math.max(3, Math.floor((span - 4) / 2.6));
      for (let l = 0; l < laneCount; l++) {
        if (isStepFree && l === laneCount - 1) continue;
        const lx = -halfSpan + 2.2 + l * ((span - 5) / Math.max(1, laneCount - 1));
        const turnstile = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.08, 1.85), metalMat);
        turnstile.position.set(lx, 0.54, 0);
        turnstile.castShadow = true;
        archGroup.add(turnstile);
      }

      if (isStepFree) {
        const isaTex = makeWheelchairSymbolTexture('#2563eb', '#ffffff');
        const priorityLane = new THREE.Mesh(
          new THREE.BoxGeometry(2.8, 0.06, thick * 0.95),
          new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.6 }),
        );
        priorityLane.position.set(halfSpan - 2.3, 0.03, 0);
        archGroup.add(priorityLane);

        const isaTile = new THREE.Mesh(
          new THREE.BoxGeometry(1.7, 0.07, 1.7),
          new THREE.MeshStandardMaterial({ map: isaTex, roughness: 0.55 }),
        );
        isaTile.position.set(halfSpan - 2.3, 0.04, 0);
        archGroup.add(isaTile);

        const tactileTex = makeTactileBlockTexture();
        const tactileStrip = new THREE.Mesh(
          new THREE.BoxGeometry(span * 0.78, 0.05, 0.65),
          new THREE.MeshStandardMaterial({ map: tactileTex, roughness: 0.75 }),
        );
        tactileStrip.position.set(0, 0.03, thick * 0.48);
        archGroup.add(tactileStrip);
      }

      group.add(archGroup);
      break;
    }

    case 'ticket_info':
    case 'multilingual_info': {
      // White & Glass Information Booth with Blue Interior Glow & Circular 'i' Medallion (Ref Sheet 3 & 10)
      const deckH = 0.3;
      const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.48 });
      const headerTex = makeBannerSignTexture('#1d4ed8', 'INFORMATION');
      const headerMat = new THREE.MeshStandardMaterial({ map: headerTex, roughness: 0.35 });
      const glowGlassMat = new THREE.MeshStandardMaterial({
        color: '#60a5fa',
        emissive: new THREE.Color('#2563eb'),
        emissiveIntensity: 0.42,
        roughness: 0.16,
        metalness: 0.35,
      });

      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.9, deckH, D * 0.86),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.8 }),
      );
      plinth.position.y = deckH / 2;
      group.add(plinth);

      const bldg = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 3.1, D * 0.8), bodyMat);
      bldg.position.y = deckH + 1.55;
      bldg.castShadow = true;
      group.add(bldg);

      const win = new THREE.Mesh(new THREE.BoxGeometry(W * 0.74, 1.45, D * 0.84), glowGlassMat);
      win.position.y = deckH + 1.82;
      group.add(win);

      if (isStepFree) {
        const lowDesk = new THREE.Mesh(
          new THREE.BoxGeometry(W * 0.48, 0.76, 0.78),
          new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4 }),
        );
        lowDesk.position.set(0, deckH + 0.38, D * 0.41 + 0.28);
        group.add(lowDesk);

        const ramp = buildWheelchairRampUnit(1.9, deckH, 1.55, false);
        ramp.position.set(0, 0, D * 0.43 + 0.35);
        group.add(ramp);
      } else {
        const steps = buildSteppedCurbUnit(1.9, deckH);
        steps.position.set(0, 0, D * 0.43);
        group.add(steps);
      }

      // Blue-and-white striped front sun awning under INFORMATION fascia (Ref Sheet 10)
      const infoAwning = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.84, 0.14, 1.25),
        new THREE.MeshStandardMaterial({
          map: makeStripedAwningTexture('#1d4ed8', '#ffffff'),
          roughness: 0.52,
        }),
      );
      infoAwning.position.set(0, deckH + 2.78, D * 0.44 + 0.45);
      infoAwning.rotation.x = 0.24;
      infoAwning.castShadow = true;
      group.add(infoAwning);

      const roofFascia = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.72, D * 0.9), headerMat);
      roofFascia.position.y = deckH + 3.46;
      roofFascia.castShadow = true;
      group.add(roofFascia);

      // Circular Royal-Blue 'i' Medallion Sign on Roof (Ref Sheet 3)
      const iTex = makeCircleBadgeTexture('i');
      const iMedallion = new THREE.Mesh(
        new THREE.CylinderGeometry(1.18, 1.18, 0.22, 24),
        new THREE.MeshStandardMaterial({ map: iTex, roughness: 0.32 }),
      );
      iMedallion.rotation.x = Math.PI / 2;
      iMedallion.position.set(0, deckH + 4.65, D * 0.22);
      iMedallion.castShadow = true;
      group.add(iMedallion);

      if (facility.subtype === 'multilingual_info') {
        const orbitRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.55, 0.1, 8, 24),
          new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.4, roughness: 0.3 }),
        );
        orbitRing.position.set(0, deckH + 4.65, D * 0.22);
        orbitRing.rotation.x = Math.PI / 3;
        group.add(orbitRing);
      }
      break;
    }

    case 'vip_lounge': {
      const deckH = 0.68;
      const deckMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.75 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(W, deckH, D), deckMat);
      deck.position.y = deckH / 2;
      deck.castShadow = true;
      deck.receiveShadow = true;
      group.add(deck);

      if (isStepFree) {
        const vipRamp = buildWheelchairRampUnit(2.4, deckH, 3.4, true);
        vipRamp.position.set(0, 0, D * 0.5);
        group.add(vipRamp);
      } else {
        const vipSteps = buildSteppedCurbUnit(2.6, deckH);
        vipSteps.position.set(0, 0, D * 0.5);
        group.add(vipSteps);
      }

      const canopyMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.42, metalness: 0.2 });
      const postMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.7, roughness: 0.3 });
      for (const px of [-W * 0.44, W * 0.44]) {
        for (const pz of [-D * 0.42, D * 0.42]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.0, 8), postMat);
          p.position.set(px, 2.6, pz);
          group.add(p);
        }
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 0.45, D * 0.94), canopyMat);
      roof.position.y = 4.65;
      roof.castShadow = true;
      group.add(roof);

      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.6, 1.15, 1.5),
        new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35 }),
      );
      bar.position.set(0, 1.2, -D * 0.28);
      group.add(bar);

      const sofaMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.65 });
      for (const sx of [-W * 0.25, W * 0.25]) {
        const sofa = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 1.6), sofaMat);
        sofa.position.set(sx, 1.0, D * 0.2);
        group.add(sofa);
      }
      break;
    }

    case 'camping_zone': {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.16, D),
        new THREE.MeshStandardMaterial({ color: '#d9f99d', roughness: 0.92 }),
      );
      pad.position.y = 0.08;
      pad.receiveShadow = true;
      group.add(pad);

      // Pet-friendly agility/hydration station corner on camping lawn
      const petDeck = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.4, 0.12, 16),
        new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.8 }),
      );
      petDeck.position.set(-W * 0.36, 0.18, D * 0.34);
      group.add(petDeck);

      const tentColors = ['#0d9488', '#0284c7', '#f59e0b', '#6366f1', '#10b981'];
      const cols = Math.max(2, Math.floor(W / 10));
      const rows = Math.max(2, Math.floor(D / 9.5));
      let tIdx = 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tx = -W / 2 + (W / (cols + 1)) * (c + 1);
          const tz = -D / 2 + (D / (rows + 1)) * (r + 1);
          const tentMat = new THREE.MeshStandardMaterial({
            color: tentColors[tIdx % tentColors.length],
            roughness: 0.68,
          });
          const tent = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.3, 4), tentMat);
          tent.position.set(tx, 1.25, tz);
          tent.rotation.y = Math.PI / 4 + ((tIdx % 3) - 1) * 0.12;
          tent.castShadow = true;
          group.add(tent);
          tIdx++;
        }
      }
      break;
    }

    case 'parking_lot': {
      const lotTex = makeParkingLotTexture(W, D, maxAnisotropy, hasAccessibleParking);
      const lotMat = new THREE.MeshStandardMaterial({
        map: lotTex,
        roughness: 0.88,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const lot = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, D), lotMat);
      lot.position.y = 0.08;
      lot.receiveShadow = true;
      group.add(lot);

      const carColors = ['#ef4444', '#3b82f6', '#eab308', '#f8fafc', '#10b981', '#64748b'];
      const rand = createSeededRandom(Math.round(W * 31 + D * 17));
      const bays = Math.max(5, Math.floor(D / 5.5));
      const isaTex = makeWheelchairSymbolTexture('#2563eb', '#ffffff');
      const isaMat = new THREE.MeshStandardMaterial({ map: isaTex, roughness: 0.5 });
      const postMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.7, roughness: 0.3 });

      for (let b = 0; b < bays; b++) {
        const bz = -D / 2 + 3.5 + b * ((D - 7) / Math.max(1, bays - 1));
        for (const side of [-1, 1]) {
          const isReservedBay = hasAccessibleParking && side === -1 && b < 2;
          if (isReservedBay) {
            // Vertical 3D Accessible Parking Signpost + White Wheelchair Lift Van
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8), postMat);
            post.position.set(side * (W * 0.45), 1.15, bz);
            group.add(post);
            const sign = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.8), isaMat);
            sign.position.set(side * (W * 0.45), 2.35, bz);
            group.add(sign);

            if (b === 0) {
              const liftVan = makeLowPolyVehicle('#ffffff', true);
              liftVan.position.set(side * (W * 0.29), 0.16, bz);
              group.add(liftVan);
            }
          } else if (rand() < 0.68) {
            const car = makeLowPolyVehicle(carColors[Math.floor(rand() * carColors.length)]);
            car.position.set(side * (W * 0.31), 0.16, bz);
            if (side === 1) car.rotation.y = Math.PI;
            group.add(car);
          }
        }
      }
      break;
    }

    case 'goods_shop': {
      // Official Merch / MD Pop-up Flagship Store
      const deckH = 0.34;
      const baseDeck = new THREE.Mesh(
        new THREE.BoxGeometry(W, deckH, D),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.75 }),
      );
      baseDeck.position.y = deckH / 2;
      baseDeck.receiveShadow = true;
      group.add(baseDeck);

      if (isStepFree) {
        const ramp = buildWheelchairRampUnit(2.4, deckH, 2.4, true);
        ramp.position.set(0, 0, D * 0.5);
        group.add(ramp);
      }

      const shell = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.94, 3.2, D * 0.72),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4, metalness: 0.45 }),
      );
      shell.position.set(0, deckH + 1.6, -D * 0.08);
      shell.castShadow = true;
      group.add(shell);

      const glassFront = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.84, 2.2, 0.16),
        new THREE.MeshStandardMaterial({
          color: '#bae6fd',
          transparent: true,
          opacity: 0.72,
          roughness: 0.15,
          metalness: 0.35,
        }),
      );
      glassFront.position.set(0, deckH + 1.4, D * 0.29);
      group.add(glassFront);

      const signCrown = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.98, 0.85, D * 0.8),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35 }),
      );
      signCrown.position.set(0, deckH + 3.55, -D * 0.05);
      signCrown.castShadow = true;
      group.add(signCrown);

      // Queue stanchions out front
      const postMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.75, roughness: 0.25 });
      for (const qx of [-W * 0.32, 0, W * 0.32]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.95, 8), postMat);
        post.position.set(qx, 0.48, D * 0.46);
        group.add(post);
      }
      break;
    }

    case 'beer_garden': {
      // Craft Beer Garden & Standing Barrel Lounge
      const woodFloor = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.24, D),
        new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.85 }),
      );
      woodFloor.position.y = 0.12;
      woodFloor.receiveShadow = true;
      group.add(woodFloor);

      if (isStepFree) {
        const ramp = buildWheelchairRampUnit(2.4, 0.24, 2.2, false);
        ramp.position.set(0, 0, D * 0.5);
        group.add(ramp);
      }

      const barCounter = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.76, 1.15, 2.2),
        new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.65 }),
      );
      barCounter.position.set(0, 0.24 + 0.58, -D * 0.32);
      barCounter.castShadow = true;
      group.add(barCounter);

      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.84, 0.28, 3.8),
        new THREE.MeshStandardMaterial({
          map: makeStripedAwningTexture(accent, '#fef3c7'),
          roughness: 0.55,
        }),
      );
      awning.position.set(0, 3.4, -D * 0.3);
      awning.rotation.x = 0.15;
      awning.castShadow = true;
      group.add(awning);

      // Standing oak barrels + amber festoon light posts
      const barrelMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.75 });
      const bulbMat = new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: new THREE.Color('#f59e0b'),
        emissiveIntensity: 0.65,
      });
      for (const bx of [-W * 0.28, 0, W * 0.28]) {
        for (const bz of [0.05, D * 0.25]) {
          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.58, 1.05, 12), barrelMat);
          barrel.position.set(bx, 0.24 + 0.52, bz);
          barrel.castShadow = true;
          group.add(barrel);
        }
      }
      for (const px of [-W * 0.44, W * 0.44]) {
        for (const pz of [-D * 0.42, D * 0.42]) {
          const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 3.8, 8),
            new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.6 }),
          );
          pole.position.set(px, 1.9, pz);
          group.add(pole);
          const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bulbMat);
          lantern.position.set(px, 3.85, pz);
          group.add(lantern);
        }
      }
      break;
    }

    case 'photo_zone': {
      // Vertically Tall Rectangular Prism (세로로 긴 직육면체) Signature Photo Zone Monolith
      const boxW = Math.max(2.6, Math.min(W * 0.82, 5.2));
      const boxD = Math.max(2.2, Math.min(D * 0.82, 4.2));
      const boxH = Math.max(H, Math.max(boxW, boxD) * 1.75, 7.2);
      const padH = 0.2;

      // 1. Rectangular Step-Free Plinth Pad
      const basePad = new THREE.Mesh(
        new THREE.BoxGeometry(boxW + 0.7, padH, boxD + 0.7),
        new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.78 }),
      );
      basePad.position.y = padH / 2;
      basePad.receiveShadow = true;
      group.add(basePad);

      if (isStepFree) {
        const ramp = buildWheelchairRampUnit(Math.min(2.0, boxW * 0.65), padH, 1.3, false);
        ramp.position.set(0, 0, (boxD + 0.7) * 0.5);
        group.add(ramp);
      }

      // 2. Primary Silhouette: Tall Vertical Rectangular Prism Body (직육면체 본체)
      const bodyMat = new THREE.MeshStandardMaterial({
        color: accent || '#ec4899',
        roughness: 0.34,
        metalness: 0.18,
      });
      const tallPrism = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxD), bodyMat);
      tallPrism.position.y = padH + boxH / 2;
      tallPrism.castShadow = true;
      tallPrism.receiveShadow = true;
      group.add(tallPrism);

      // 3. Secondary Architectural Trim: 4 Vertical Corner Columns + Flat Rectangular Top Cap
      const frameMat = new THREE.MeshStandardMaterial({
        color: '#0f172a',
        roughness: 0.28,
        metalness: 0.62,
      });
      const edgeT = 0.18;
      for (const sx of [-boxW / 2, boxW / 2]) {
        for (const sz of [-boxD / 2, boxD / 2]) {
          const cornerCol = new THREE.Mesh(
            new THREE.BoxGeometry(edgeT, boxH + 0.06, edgeT),
            frameMat,
          );
          cornerCol.position.set(sx, padH + boxH / 2, sz);
          cornerCol.castShadow = true;
          group.add(cornerCol);
        }
      }

      const topCap = new THREE.Mesh(
        new THREE.BoxGeometry(boxW + 0.24, 0.24, boxD + 0.24),
        frameMat,
      );
      topCap.position.y = padH + boxH + 0.12;
      topCap.castShadow = true;
      group.add(topCap);

      // 4. Front & Rear Vertical Portrait Display Panels (CanvasTexture) + Vertical Studio LED Bars
      const photoTex = makeVerticalPhotoZoneTexture(accent || '#ec4899');
      const displayMat = new THREE.MeshStandardMaterial({
        map: photoTex,
        emissive: new THREE.Color(accent || '#ec4899'),
        emissiveIntensity: 0.18,
        roughness: 0.24,
      });
      const ledStripMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: new THREE.Color('#fef08a'),
        emissiveIntensity: 0.85,
        roughness: 0.15,
      });

      for (const zDir of [-1, 1]) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(boxW * 0.78, boxH * 0.82, 0.08),
          displayMat,
        );
        panel.position.set(0, padH + boxH * 0.52, zDir * (boxD / 2 + 0.04));
        if (zDir < 0) panel.rotation.y = Math.PI;
        group.add(panel);

        for (const lx of [-boxW * 0.43, boxW * 0.43]) {
          const ledBar = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, boxH * 0.82, 0.1),
            ledStripMat,
          );
          ledBar.position.set(lx, padH + boxH * 0.52, zDir * (boxD / 2 + 0.05));
          group.add(ledBar);
        }
      }

      // 5. Eye-level Rectangular Camera Module Visor on Front Face
      const camHousing = new THREE.Mesh(
        new THREE.BoxGeometry(boxW * 0.36, 0.28, 0.18),
        frameMat,
      );
      camHousing.position.set(0, padH + 1.68, boxD / 2 + 0.09);
      group.add(camHousing);
      break;
    }

    case 'locker_charging': {
      // Smart Locker Wall + Phone Charging Hub
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.24, D),
        new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.8 }),
      );
      pad.position.y = 0.12;
      group.add(pad);

      const bank = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.88, 2.25, 1.25),
        new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4, metalness: 0.5 }),
      );
      bank.position.set(0, 0.24 + 1.12, -D * 0.22);
      bank.castShadow = true;
      group.add(bank);

      const doorMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35 });
      for (let col = -2; col <= 2; col++) {
        const doorCol = new THREE.Mesh(new THREE.BoxGeometry(W * 0.13, 1.9, 0.1), doorMat);
        doorCol.position.set(col * (W * 0.16), 0.24 + 1.15, -D * 0.22 + 0.65);
        group.add(doorCol);
      }

      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.6, 0.22, D + 0.6),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.45 }),
      );
      canopy.position.set(0, 3.05, 0);
      canopy.castShadow = true;
      group.add(canopy);
      break;
    }

    case 'pet_zone': {
      // Companion Pet Playground & Hydration Zone
      const turfPad = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.2, D),
        new THREE.MeshStandardMaterial({ color: '#86efac', roughness: 0.9 }),
      );
      turfPad.position.y = 0.1;
      turfPad.receiveShadow = true;
      group.add(turfPad);

      const fenceMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.7 });
      const railN = new THREE.Mesh(new THREE.BoxGeometry(W, 0.75, 0.16), fenceMat);
      railN.position.set(0, 0.55, -D * 0.48);
      group.add(railN);
      for (const side of [-1, 1]) {
        const railSide = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.75, D * 0.96), fenceMat);
        railSide.position.set(side * W * 0.48, 0.55, 0);
        group.add(railSide);
      }

      // Agility tunnel + jump hurdle + shade canopy
      const tunnel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 3.4, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, side: THREE.DoubleSide }),
      );
      tunnel.rotation.z = Math.PI / 2;
      tunnel.position.set(-W * 0.18, 0.95, 0);
      tunnel.castShadow = true;
      group.add(tunnel);

      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 1.1, 6),
        new THREE.MeshStandardMaterial({ color: '#fb923c', roughness: 0.55 }),
      );
      shade.position.set(W * 0.24, 2.85, -D * 0.15);
      group.add(shade);
      const shadePole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 2.7, 8),
        new THREE.MeshStandardMaterial({ color: '#78350f' }),
      );
      shadePole.position.set(W * 0.24, 1.35, -D * 0.15);
      group.add(shadePole);
      break;
    }

    case 'eco_station': {
      // Reusable Cup Return & 4-Stream Recycling Eco Station
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.2, D),
        new THREE.MeshStandardMaterial({ color: '#dcfce7', roughness: 0.85 }),
      );
      base.position.y = 0.1;
      group.add(base);

      const binColors = ['#2563eb', '#16a34a', '#f59e0b', '#475569'];
      for (let i = 0; i < 4; i++) {
        const bx = -W * 0.34 + i * (W * 0.225);
        const bin = new THREE.Mesh(
          new THREE.BoxGeometry(W * 0.18, 1.25, 1.1),
          new THREE.MeshStandardMaterial({ color: binColors[i], roughness: 0.45 }),
        );
        bin.position.set(bx, 0.2 + 0.62, 0);
        bin.castShadow = true;
        group.add(bin);
      }

      const greenRoof = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.4, 0.24, D * 0.85),
        new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.55 }),
      );
      greenRoof.position.set(0, 2.75, 0);
      greenRoof.rotation.x = 0.1;
      greenRoof.castShadow = true;
      group.add(greenRoof);
      break;
    }

    case 'shuttle_stop': {
      // Blue Glass Boarding Shelter + Docked Blue-and-White Festival Shuttle Coach (Ref Sheet 1 & 10)
      const lane = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.18, D),
        new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.88 }),
      );
      lane.position.y = 0.09;
      lane.receiveShadow = true;
      group.add(lane);

      const yellowCurb = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.92, 0.26, 1.2),
        new THREE.MeshStandardMaterial({ map: makeTactileBlockTexture(), roughness: 0.7 }),
      );
      yellowCurb.position.set(0, 0.13, -D * 0.28);
      group.add(yellowCurb);

      // Blue Glass Boarding Shelter Frame (Ref Sheet 1 right)
      const shelterBlueMat = new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.35, metalness: 0.3 });
      const shelterGlassMat = new THREE.MeshStandardMaterial({
        color: '#93c5fd',
        transparent: true,
        opacity: 0.58,
        roughness: 0.15,
        metalness: 0.4,
      });
      const shelterW = Math.min(7.5, W * 0.52);
      const shelterX = -W * 0.16;
      const shelterZ = -D * 0.3;

      const shelterRoof = new THREE.Mesh(new THREE.BoxGeometry(shelterW, 0.28, 3.0), shelterBlueMat);
      shelterRoof.position.set(shelterX, 3.18, shelterZ);
      shelterRoof.castShadow = true;
      group.add(shelterRoof);

      const backGlass = new THREE.Mesh(new THREE.BoxGeometry(shelterW * 0.94, 2.75, 0.14), shelterGlassMat);
      backGlass.position.set(shelterX, 1.65, shelterZ - 1.35);
      group.add(backGlass);

      for (const sx of [-shelterW * 0.46, shelterW * 0.46]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.1, 0.24), shelterBlueMat);
        post.position.set(shelterX + sx, 1.6, shelterZ + 1.3);
        group.add(post);
      }

      // Docked Blue-and-White Festival Coach Bus with Panoramic Windows
      const busX = W * 0.12;
      const busZ = D * 0.16;
      const busLower = new THREE.Mesh(
        new THREE.BoxGeometry(9.4, 1.15, 2.75),
        shelterBlueMat,
      );
      busLower.position.set(busX, 0.95, busZ);
      busLower.castShadow = true;
      group.add(busLower);

      const busUpper = new THREE.Mesh(
        new THREE.BoxGeometry(9.36, 1.55, 2.72),
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 }),
      );
      busUpper.position.set(busX, 2.28, busZ);
      busUpper.castShadow = true;
      group.add(busUpper);

      const busWindows = new THREE.Mesh(
        new THREE.BoxGeometry(8.9, 0.88, 2.78),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.15, metalness: 0.65 }),
      );
      busWindows.position.set(busX, 2.35, busZ);
      group.add(busWindows);

      const busRoofCap = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.22, 2.6), shelterBlueMat);
      busRoofCap.position.set(busX, 3.15, busZ);
      group.add(busRoofCap);

      const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.36, 14);
      wheelGeo.rotateX(Math.PI / 2);
      const busWheelMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.85 });
      for (const wx of [-3.1, 3.1]) {
        for (const wz of [-1.32, 1.32]) {
          const wh = new THREE.Mesh(wheelGeo, busWheelMat);
          wh.position.set(busX + wx, 0.52, busZ + wz);
          group.add(wh);
        }
      }
      break;
    }

    case 'wristband_hub': {
      // Multi-Lane Ticket/Wristband Exchange & Bag-Check Hub
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.2, D),
        new THREE.MeshStandardMaterial({ color: '#e0f2fe', roughness: 0.82 }),
      );
      pad.position.y = 0.1;
      group.add(pad);

      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.45, D * 0.65),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.42 }),
      );
      canopy.position.set(0, 3.55, 0);
      canopy.castShadow = true;
      group.add(canopy);

      const archMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.65, roughness: 0.3 });
      const lanes = 4;
      for (let i = 0; i <= lanes; i++) {
        const lx = -W * 0.42 + (i / lanes) * (W * 0.84);
        const divider = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.35, 1.8), archMat);
        divider.position.set(lx, 1.75, 0);
        divider.castShadow = true;
        group.add(divider);
      }
      break;
    }

    case 'foh_control': {
      // Truss-Framed FOH Sound & Lighting Booth with Black Skirt & White Pitched Canopy (Ref Sheet 11 center)
      const trussMat = new THREE.MeshStandardMaterial({
        color: '#64748b',
        metalness: 0.8,
        roughness: 0.26,
      });
      const blackSkirtMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.78 });

      const lowerSkirt = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 1.45, D * 0.9), blackSkirtMat);
      lowerSkirt.position.y = 0.725;
      lowerSkirt.castShadow = true;
      group.add(lowerSkirt);

      for (const px of [-W * 0.42, W * 0.42]) {
        for (const pz of [-D * 0.42, D * 0.42]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.32, H - 0.6, 0.32), trussMat);
          leg.position.set(px, (H - 0.6) / 2, pz);
          leg.castShadow = true;
          group.add(leg);
        }
      }

      const mixingDesk = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.68, 0.85, 1.45),
        new THREE.MeshStandardMaterial({
          color: '#1e293b',
          emissive: new THREE.Color('#2563eb'),
          emissiveIntensity: 0.35,
          roughness: 0.3,
        }),
      );
      mixingDesk.position.set(0, 1.85, -D * 0.12);
      group.add(mixingDesk);

      // Crisp White Pitched Canopy Peak (Ref Sheet 11)
      const whiteCanopy = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(W, D) * 0.68, 1.55, 4),
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.48 }),
      );
      whiteCanopy.position.y = H + 0.15;
      whiteCanopy.rotation.y = Math.PI / 4;
      whiteCanopy.castShadow = true;
      group.add(whiteCanopy);
      break;
    }

    case 'mist_cooling': {
      // Cooling Mist Portal Arches & Shade Zone
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.16, D),
        new THREE.MeshStandardMaterial({ color: '#bae6fd', roughness: 0.75 }),
      );
      pad.position.y = 0.08;
      group.add(pad);

      const archMat = new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.3, metalness: 0.35 });
      const mistMat = new THREE.MeshBasicMaterial({
        color: '#e0f2fe',
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      });

      for (const az of [-D * 0.32, 0, D * 0.32]) {
        const portal = new THREE.Mesh(
          new THREE.TorusGeometry(W * 0.38, 0.22, 10, 22, Math.PI),
          archMat,
        );
        portal.position.set(0, 0.16, az);
        portal.castShadow = true;
        group.add(portal);

        const fog = new THREE.Mesh(new THREE.ConeGeometry(W * 0.34, 3.0, 12, 1, true), mistMat);
        fog.position.set(0, 1.65, az);
        group.add(fog);
      }
      break;
    }

    case 'smoking_booth': {
      // Enclosed Ventilated Perimeter Smoking Booth
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.22, D),
        new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 }),
      );
      base.position.y = 0.11;
      group.add(base);

      const glassBox = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.88, 2.5, D * 0.84),
        new THREE.MeshStandardMaterial({
          color: '#94a3b8',
          transparent: true,
          opacity: 0.58,
          roughness: 0.2,
          metalness: 0.4,
        }),
      );
      glassBox.position.y = 0.22 + 1.25;
      group.add(glassBox);

      const purifierRoof = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.92, 0.55, D * 0.88),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.45, metalness: 0.5 }),
      );
      purifierRoof.position.y = 2.95;
      purifierRoof.castShadow = true;
      group.add(purifierRoof);
      break;
    }

    case 'wheelchair_viewing': {
      // Dedicated Elevated Wheelchair & Companion Viewing Deck (1:1 W x D x H)
      const deckH = Math.max(0.55, Math.min(1.2, H * 0.65));
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(W, deckH, D * 0.78),
        new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.65, metalness: 0.2 }),
      );
      deck.position.set(0, deckH / 2, -D * 0.08);
      deck.castShadow = true;
      deck.receiveShadow = true;
      group.add(deck);

      const isaTex = makeWheelchairSymbolTexture('#2563eb', '#ffffff');
      const bayCount = Math.max(2, Math.floor(W / 2.8));
      for (let i = 0; i < bayCount; i++) {
        const bx = -W * 0.38 + (i / Math.max(1, bayCount - 1)) * (W * 0.76);
        const isaTile = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.04, 1.5),
          new THREE.MeshStandardMaterial({ map: isaTex, roughness: 0.5 }),
        );
        isaTile.position.set(bx, deckH + 0.02, -D * 0.14);
        group.add(isaTile);
      }

      // Safety glass front guardrail so seated eye-level sightlines stay unobstructed
      const glassRail = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.96, 0.95, 0.08),
        new THREE.MeshStandardMaterial({
          color: '#93c5fd',
          transparent: true,
          opacity: 0.52,
          roughness: 0.15,
          metalness: 0.35,
        }),
      );
      glassRail.position.set(0, deckH + 0.48, -D * 0.46);
      group.add(glassRail);

      const ramp = buildWheelchairRampUnit(Math.min(2.4, W * 0.35), deckH, Math.min(2.8, D * 0.32), true);
      ramp.position.set(0, 0, D * 0.31);
      group.add(ramp);
      break;
    }

    case 'access_ramp': {
      // Standalone 1:12 Step-Free Modular Ramp with Dual Handrails & Tactile Landings
      const rampH = Math.max(0.45, Math.min(1.4, H));
      const rampSlope = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.88, rampH * 0.5, D * 0.76),
        new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.68 }),
      );
      rampSlope.position.set(0, rampH * 0.25, 0);
      rampSlope.rotation.x = 0.085;
      rampSlope.castShadow = true;
      rampSlope.receiveShadow = true;
      group.add(rampSlope);

      const railMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.78, roughness: 0.24 });
      for (const sx of [-W * 0.42, W * 0.42]) {
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, D * 0.86), railMat);
        topRail.position.set(sx, rampH + 0.65, 0);
        topRail.rotation.x = 0.085;
        group.add(topRail);
        for (const sz of [-D * 0.36, 0, D * 0.36]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), railMat);
          post.position.set(sx, rampH * 0.45 + 0.35, sz);
          group.add(post);
        }
      }

      const tacMat = new THREE.MeshStandardMaterial({ map: makeTactileBlockTexture(), roughness: 0.75 });
      for (const sz of [-D * 0.44, D * 0.44]) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.05, 0.8), tacMat);
        pad.position.set(0, 0.03, sz);
        group.add(pad);
      }
      break;
    }

    case 'tactile_paving': {
      // KS F 4561 High-Contrast Tactile Guidance Spine + Warning Decision Nodes
      const tacTex = makeTactileBlockTexture();
      const spine = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(W, 1.4), 0.06, D),
        new THREE.MeshStandardMaterial({ map: tacTex, roughness: 0.72 }),
      );
      spine.position.y = 0.03;
      spine.receiveShadow = true;
      group.add(spine);

      const curbMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.82 });
      for (const sx of [-Math.min(W * 0.45, 0.9), Math.min(W * 0.45, 0.9)]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, D), curbMat);
        edge.position.set(sx, 0.025, 0);
        group.add(edge);
      }

      // Audio-tactile guidance bollard at entry end
      const bollard = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 1.05, 12),
        new THREE.MeshStandardMaterial({ color: '#ca8a04', roughness: 0.35, metalness: 0.3 }),
      );
      bollard.position.set(Math.min(W * 0.4, 0.95), 0.52, D * 0.42);
      bollard.castShadow = true;
      group.add(bollard);
      break;
    }

    case 'senior_rest': {
      // Barrier-Free Senior & Mobility Shaded Lounge with Armrest Benches & Hydration Point
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.16, D),
        new THREE.MeshStandardMaterial({ color: '#ecfdf5', roughness: 0.85 }),
      );
      deck.position.y = 0.08;
      deck.receiveShadow = true;
      group.add(deck);

      const timberMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.72 });
      for (const px of [-W * 0.44, W * 0.44]) {
        for (const pz of [-D * 0.42, D * 0.42]) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.24, H - 0.3, 0.24), timberMat);
          col.position.set(px, (H - 0.3) / 2 + 0.16, pz);
          col.castShadow = true;
          group.add(col);
        }
      }

      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.98, 0.28, D * 0.96),
        new THREE.MeshStandardMaterial({ color: '#059669', roughness: 0.55 }),
      );
      canopy.position.y = H - 0.14;
      canopy.castShadow = true;
      group.add(canopy);

      for (const bx of [-W * 0.26, W * 0.26]) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.48, 0.75), timberMat);
        seat.position.set(bx, 0.4, -D * 0.12);
        seat.castShadow = true;
        group.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.52, 0.12), timberMat);
        back.position.set(bx, 0.82, -D * 0.12 - 0.32);
        group.add(back);
      }
      break;
    }

    case 'fire_safety_unit': {
      // Fire Hydrant, Oversized Extinguisher Bank & Emergency Strobe Post
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.18, D),
        new THREE.MeshStandardMaterial({ color: '#fee2e2', roughness: 0.82 }),
      );
      pad.position.y = 0.09;
      group.add(pad);

      const redMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.35, metalness: 0.35 });
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(W * 0.72, H * 0.68, D * 0.48), redMat);
      cabinet.position.set(0, 0.18 + H * 0.34, -D * 0.12);
      cabinet.castShadow = true;
      group.add(cabinet);

      const hydrant = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.15, 12), redMat);
      hydrant.position.set(-W * 0.28, 0.75, D * 0.24);
      hydrant.castShadow = true;
      group.add(hydrant);

      const strobe = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 12, 10),
        new THREE.MeshStandardMaterial({
          color: '#ef4444',
          emissive: new THREE.Color('#dc2626'),
          emissiveIntensity: 0.85,
        }),
      );
      strobe.position.set(0, 0.18 + H * 0.68 + 0.26, -D * 0.12);
      group.add(strobe);
      break;
    }

    case 'emergency_shelter': {
      // Large High-Visibility Disaster & Weather Evacuation Shelter
      const floorPad = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.18, D),
        new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.8 }),
      );
      floorPad.position.y = 0.09;
      floorPad.receiveShadow = true;
      group.add(floorPad);

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.94, H * 0.64, D * 0.88),
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.48 }),
      );
      body.position.y = 0.18 + H * 0.32;
      body.castShadow = true;
      group.add(body);

      const redRoof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(W, D) * 0.64, H * 0.34, 4),
        new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.45 }),
      );
      redRoof.position.y = 0.18 + H * 0.64 + H * 0.17;
      redRoof.rotation.y = Math.PI / 4;
      redRoof.castShadow = true;
      group.add(redRoof);

      const signTex = makeBannerSignTexture('#dc2626', 'SHELTER');
      const fascia = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.52, 0.85, 0.18),
        new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 }),
      );
      fascia.position.set(0, 0.18 + H * 0.58, D * 0.45);
      group.add(fascia);
      break;
    }

    case 'accessible_parking': {
      // Dedicated Barrier-Free Parking Lot (3.3m x 5.0m bays + hatched transfer zones + lift vans)
      const lotTex = makeParkingLotTexture(W, D, maxAnisotropy, true);
      const lot = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.16, D),
        new THREE.MeshStandardMaterial({ map: lotTex, roughness: 0.84 }),
      );
      lot.position.y = 0.08;
      lot.receiveShadow = true;
      group.add(lot);

      const bluePad = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.88, 0.03, D * 0.82),
        new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.65 }),
      );
      bluePad.position.y = 0.17;
      group.add(bluePad);

      const isaTex = makeWheelchairSymbolTexture('#2563eb', '#ffffff');
      const isaMat = new THREE.MeshStandardMaterial({ map: isaTex, roughness: 0.45 });
      const postMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.7, roughness: 0.3 });
      for (const bx of [-W * 0.25, W * 0.25]) {
        const tile = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 2.1), isaMat);
        tile.position.set(bx, 0.19, 0);
        group.add(tile);

        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8), postMat);
        post.position.set(bx, 1.15, -D * 0.38);
        group.add(post);

        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.1), isaMat);
        sign.position.set(bx, 2.25, -D * 0.38);
        group.add(sign);
      }
      const liftVan = makeLowPolyVehicle('#ffffff', true);
      liftVan.position.set(-W * 0.25, 0.18, 0.4);
      group.add(liftVan);
      break;
    }

    case 'experience_pavilion':
    case 'exhibition_hall': {
      // Cultural Experience Pavilion / Exhibition Hall (1:1 W x D x H)
      const isExpo = facility.subtype === 'exhibition_hall';
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.24, D),
        new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.78 }),
      );
      base.position.y = 0.12;
      base.receiveShadow = true;
      group.add(base);

      const hallBody = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.94, H * 0.74, D * 0.88),
        new THREE.MeshStandardMaterial({
          color: isExpo ? '#f8fafc' : '#f0fdfa',
          roughness: 0.42,
          metalness: 0.15,
        }),
      );
      hallBody.position.y = 0.24 + H * 0.37;
      hallBody.castShadow = true;
      group.add(hallBody);

      const glassAtrium = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.68, H * 0.56, 0.18),
        new THREE.MeshStandardMaterial({
          color: isExpo ? '#c7d2fe' : '#99f6e4',
          transparent: true,
          opacity: 0.64,
          roughness: 0.14,
          metalness: 0.35,
        }),
      );
      glassAtrium.position.set(0, 0.24 + H * 0.32, D * 0.44);
      group.add(glassAtrium);

      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.98, H * 0.16, D * 0.92),
        new THREE.MeshStandardMaterial({
          color: isExpo ? '#4f46e5' : '#0d9488',
          roughness: 0.32,
          metalness: 0.25,
        }),
      );
      crown.position.y = 0.24 + H * 0.82;
      crown.castShadow = true;
      group.add(crown);

      if (isStepFree) {
        const ramp = buildWheelchairRampUnit(2.4, 0.24, 1.8, false);
        ramp.position.set(0, 0, D * 0.46);
        group.add(ramp);
      }
      break;
    }

    case 'volunteer_center': {
      // Volunteer & Operations Staff Hub
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.22, D),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.8 }),
      );
      pad.position.y = 0.11;
      group.add(pad);

      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.9, H * 0.72, D * 0.78),
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }),
      );
      cabin.position.set(0, 0.22 + H * 0.36, -D * 0.06);
      cabin.castShadow = true;
      group.add(cabin);

      const header = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.94, 0.58, D * 0.84),
        new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.36 }),
      );
      header.position.set(0, 0.22 + H * 0.76, -D * 0.04);
      header.castShadow = true;
      group.add(header);
      break;
    }

    case 'control_room': {
      // Elevated Integrated Command & Control Room (CP) with Observation Window & Comms Mast
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.3, D),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.75 }),
      );
      base.position.y = 0.15;
      group.add(base);

      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.92, H * 0.48, D * 0.86),
        new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.42, metalness: 0.45 }),
      );
      lower.position.y = 0.3 + H * 0.24;
      lower.castShadow = true;
      group.add(lower);

      const upperDeck = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.86, H * 0.42, D * 0.8),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.35, metalness: 0.55 }),
      );
      upperDeck.position.y = 0.3 + H * 0.69;
      upperDeck.castShadow = true;
      group.add(upperDeck);

      const obsGlass = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.78, H * 0.24, D * 0.84),
        new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          emissive: new THREE.Color('#0284c7'),
          emissiveIntensity: 0.35,
          roughness: 0.15,
          metalness: 0.45,
        }),
      );
      obsGlass.position.y = 0.3 + H * 0.72;
      group.add(obsGlass);

      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.1, 2.2, 8),
        new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.8, roughness: 0.2 }),
      );
      mast.position.set(W * 0.32, 0.3 + H + 0.9, -D * 0.28);
      group.add(mast);
      break;
    }

    case 'beam_projector': {
      // Non-Performance Indoor Beam Projector, 16:9 Wide Screen & Low Step-Free Presentation Riser
      const riserH = 0.42;
      const riser = new THREE.Mesh(
        new THREE.BoxGeometry(W, riserH, D),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.65, metalness: 0.18 }),
      );
      riser.position.y = riserH / 2;
      riser.castShadow = true;
      riser.receiveShadow = true;
      group.add(riser);

      const riserCarpet = new THREE.Mesh(
        new THREE.BoxGeometry(W - 0.5, 0.04, D - 0.5),
        new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.82 }),
      );
      riserCarpet.position.y = riserH + 0.02;
      riserCarpet.receiveShadow = true;
      group.add(riserCarpet);

      if (isStepFree) {
        const ramp = buildWheelchairRampUnit(1.8, riserH, 3.2, true);
        ramp.position.set(-W * 0.5 - 0.95, 0, D * 0.05);
        group.add(ramp);
      }

      // Twin Vertical Aluminum Truss Masts + Top Crossbar holding the 16:9 Projection Screen
      const screenW = Math.max(6.4, W * 0.78);
      const screenH = Math.max(3.6, Math.min(H - 1.1, screenW * 0.56));
      const screenCenterY = riserH + 0.65 + screenH * 0.5;
      const screenZ = -D * 0.34;
      const trussMat = new THREE.MeshStandardMaterial({
        color: '#475569',
        metalness: 0.78,
        roughness: 0.26,
      });

      for (const sx of [-screenW * 0.5 - 0.22, screenW * 0.5 + 0.22]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, screenH + 1.0, 0.28), trussMat);
        post.position.set(sx, riserH + (screenH + 1.0) * 0.5, screenZ);
        post.castShadow = true;
        group.add(post);
      }
      const topTruss = new THREE.Mesh(
        new THREE.BoxGeometry(screenW + 0.9, 0.26, 0.32),
        trussMat,
      );
      topTruss.position.set(0, screenCenterY + screenH * 0.5 + 0.2, screenZ);
      group.add(topTruss);

      // Framed Matte Projection Screen with crisp procedural presentation slide CanvasTexture
      const borderFrame = new THREE.Mesh(
        new THREE.BoxGeometry(screenW + 0.36, screenH + 0.36, 0.14),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.5, metalness: 0.35 }),
      );
      borderFrame.position.set(0, screenCenterY, screenZ);
      borderFrame.castShadow = true;
      group.add(borderFrame);

      const slideCanvas = document.createElement('canvas');
      slideCanvas.width = 512;
      slideCanvas.height = 288;
      const sctx = slideCanvas.getContext('2d');
      if (sctx) {
        sctx.fillStyle = '#f8fafc';
        sctx.fillRect(0, 0, 512, 288);
        sctx.fillStyle = '#0f172a';
        sctx.fillRect(0, 0, 512, 46);
        sctx.fillStyle = '#38bdf8';
        sctx.fillRect(24, 16, 14, 14);
        sctx.fillStyle = '#ffffff';
        sctx.font = 'bold 17px sans-serif';
        sctx.fillText('KEYNOTE & INDOOR SESSION BRIEFING', 48, 29);

        // Clean chart bars & presentation layout lines
        sctx.fillStyle = '#e2e8f0';
        sctx.fillRect(28, 68, 210, 184);
        const barColors = ['#2563eb', '#0ea5e9', '#10b981', '#6366f1'];
        const barHeights = [82, 118, 96, 142];
        barHeights.forEach((bh, idx) => {
          sctx.fillStyle = barColors[idx];
          sctx.fillRect(50 + idx * 44, 232 - bh, 28, bh);
        });
        sctx.fillStyle = '#1e293b';
        sctx.fillRect(262, 76, 216, 16);
        sctx.fillStyle = '#64748b';
        sctx.fillRect(262, 108, 192, 10);
        sctx.fillRect(262, 128, 174, 10);
        sctx.fillRect(262, 148, 204, 10);
        sctx.fillStyle = '#dbeafe';
        sctx.fillRect(262, 180, 216, 68);
        sctx.strokeStyle = '#2563eb';
        sctx.lineWidth = 2;
        sctx.strokeRect(262, 180, 216, 68);
      }
      const slideTex = new THREE.CanvasTexture(slideCanvas);
      slideTex.colorSpace = THREE.SRGBColorSpace;
      slideTex.anisotropy = maxAnisotropy;

      const screenSurface = new THREE.Mesh(
        new THREE.PlaneGeometry(screenW, screenH),
        new THREE.MeshStandardMaterial({
          map: slideTex,
          emissive: new THREE.Color('#e0f2fe'),
          emissiveMap: slideTex,
          emissiveIntensity: 0.32,
          roughness: 0.4,
        }),
      );
      screenSurface.position.set(0, screenCenterY, screenZ + 0.08);
      group.add(screenSurface);

      // Overhead Gantry Rig + High-Lumen Laser Beam Projector Body + Optical Lens + Light Cone
      const projZ = D * 0.42;
      const projY = screenCenterY + screenH * 0.34;

      // Overhead support arms from screen top truss forward to projector rig
      for (const armX of [-1.1, 1.1]) {
        const boom = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.12, projZ - screenZ + 0.4),
          trussMat,
        );
        boom.position.set(armX, screenCenterY + screenH * 0.5 + 0.2, (screenZ + projZ) * 0.5);
        group.add(boom);
      }
      const dropMount = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, screenCenterY + screenH * 0.5 + 0.2 - projY, 10),
        trussMat,
      );
      dropMount.position.set(0, (screenCenterY + screenH * 0.5 + 0.2 + projY) * 0.5, projZ);
      group.add(dropMount);

      const projectorBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.42, 1.35),
        new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.32, metalness: 0.35 }),
      );
      projectorBody.position.set(0, projY, projZ);
      projectorBody.castShadow = true;
      group.add(projectorBody);

      const lensBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.2, 0.38, 16),
        new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.85, roughness: 0.18 }),
      );
      lensBarrel.rotation.x = Math.PI / 2;
      lensBarrel.position.set(0, projY - 0.02, projZ - 0.78);
      group.add(lensBarrel);

      const lensGlow = new THREE.Mesh(
        new THREE.CircleGeometry(0.14, 16),
        new THREE.MeshBasicMaterial({ color: '#bae6fd' }),
      );
      lensGlow.rotation.y = Math.PI;
      lensGlow.position.set(0, projY - 0.02, projZ - 0.98);
      group.add(lensGlow);

      // Subtle translucent projection throw cone from lens toward screen
      const throwDist = Math.max(2.2, projZ - 0.98 - (screenZ + 0.1));
      const beamCone = new THREE.Mesh(
        new THREE.ConeGeometry(screenW * 0.42, throwDist, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color: '#7dd3fc',
          transparent: true,
          opacity: 0.13,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      beamCone.rotation.x = Math.PI / 2;
      beamCone.position.set(0, (projY + screenCenterY) * 0.5, (projZ - 0.98 + screenZ + 0.1) * 0.5);
      group.add(beamCone);

      // Presenter Lectern / Podium + Confidence Monitor + Compact Column Speakers
      const podiumX = W * 0.28;
      const podiumZ = D * 0.16;
      const podium = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 1.15, 0.65),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.45, metalness: 0.25 }),
      );
      podium.position.set(podiumX, riserH + 0.575, podiumZ);
      podium.castShadow = true;
      group.add(podium);

      const confMonitor = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.48, 0.35),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4 }),
      );
      confMonitor.position.set(0, riserH + 0.24, D * 0.34);
      confMonitor.rotation.x = -0.35;
      group.add(confMonitor);

      for (const spkX of [-W * 0.44, W * 0.44]) {
        const spkPole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.06, 2.2, 8),
          trussMat,
        );
        spkPole.position.set(spkX, riserH + 1.1, -D * 0.12);
        group.add(spkPole);
        const colSpk = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 1.35, 0.32),
          new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.5 }),
        );
        colSpk.position.set(spkX, riserH + 2.1, -D * 0.12);
        colSpk.castShadow = true;
        group.add(colSpk);
      }
      break;
    }
  }

  if (facility.locked) {
    const lockFrameMat = new THREE.MeshBasicMaterial({
      color: '#d97706',
      transparent: true,
      opacity: 0.9,
    });
    const lockPadW = W + 0.9;
    const lockPadD = D + 0.9;
    const barThick = 0.22;
    for (const sz of [-lockPadD / 2, lockPadD / 2]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(lockPadW, 0.12, barThick), lockFrameMat);
      bar.position.set(0, 0.12, sz);
      group.add(bar);
    }
    for (const sx of [-lockPadW / 2, lockPadW / 2]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(barThick, 0.12, lockPadD), lockFrameMat);
      bar.position.set(sx, 0.12, 0);
      group.add(bar);
    }
  }

  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(5, W + 2.0), Math.max(3.2, H + 1), Math.max(5, D + 2.4)),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitBox.position.y = Math.max(1.6, H / 2);
  hitBox.layers.enable(1);
  hitBox.userData = { facilityId: facility.id };
  group.add(hitBox);

  return group;
}

export function buildGhostPreviewGroup(
  ghostFacilities: Facility[],
  config: EventConfig,
): THREE.Group {
  const ghostGroup = new THREE.Group();
  ghostGroup.name = 'ghost-preview-group';
  const ghostMat = new THREE.MeshStandardMaterial({
    color: '#2563eb',
    emissive: new THREE.Color('#1d4ed8'),
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.42,
    roughness: 0.35,
    metalness: 0.1,
    depthWrite: false,
  });
  const outlineMat = new THREE.MeshBasicMaterial({
    color: '#2563eb',
    transparent: true,
    opacity: 0.88,
  });

  for (const fac of ghostFacilities) {
    const meshGrp = buildFacilityGroup(fac, config, 2);
    meshGrp.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh) {
        if (!obj.material || (obj.material as THREE.Material).visible === false) {
          obj.visible = false;
        } else {
          obj.material = ghostMat;
          obj.castShadow = false;
          obj.receiveShadow = false;
        }
      }
    });

    const fw = fac.dimensions.width + 0.8;
    const fd = fac.dimensions.depth + 0.8;
    const t = 0.24;
    for (const sz of [-fd / 2, fd / 2]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.14, t), outlineMat);
      edge.position.set(0, 0.15, sz);
      meshGrp.add(edge);
    }
    for (const sx of [-fw / 2, fw / 2]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(t, 0.14, fd), outlineMat);
      edge.position.set(sx, 0.15, 0);
      meshGrp.add(edge);
    }

    ghostGroup.add(meshGrp);
  }
  return ghostGroup;
}

export function buildVenueGroundAndPerimeter(
  config: EventConfig,
  facilities: Facility[] = [],
  maxAnisotropy = 4,
): THREE.Group {
  const envGroup = new THREE.Group();
  envGroup.name = 'venue-environment';

  const W = config.venueWidth;
  const D = config.venueDepth;
  const halfW = W / 2;
  const halfD = D / 2;
  const isOutdoor = config.venueEnvironment === 'outdoor';
  const floorSettings = config.floorSettings ?? {
    mode: 'preset' as const,
    indoorPreset: 'epoxy_light' as const,
    outdoorPreset: 'natural_lawn' as const,
    customColor: isOutdoor ? '#bbf7d0' : '#f8fafc',
    customImageUrl: '',
    imageFit: 'repeat' as const,
    showGrid: true,
  };
  const venueShape = config.venueShape ?? 'rectangle';
  const venueModel = config.venueLayoutModel ?? 'standard';
  const stonePaverTex = makeStonePaverTexture(maxAnisotropy);

  // 1. Structural Plinth beneath the main W x D venue floor
  const subPlinth = new THREE.Mesh(
    new THREE.BoxGeometry(W + 1.6, 0.38, D + 1.6),
    new THREE.MeshStandardMaterial({
      color: isOutdoor ? '#94a3b8' : '#cbd5e1',
      roughness: 0.85,
      metalness: 0.05,
    }),
  );
  subPlinth.position.y = -0.23;
  subPlinth.receiveShadow = true;
  envGroup.add(subPlinth);

  // 2. Main Venue Floor Surface (Indoor vs Outdoor + Preset / Custom Color / Custom Image)
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: isOutdoor ? 0.88 : 0.72,
    metalness: isOutdoor ? 0.02 : 0.06,
  });

  if (floorSettings.mode === 'color') {
    floorMat.color = new THREE.Color(floorSettings.customColor || (isOutdoor ? '#bbf7d0' : '#f8fafc'));
  } else if (floorSettings.mode === 'image' && floorSettings.customImageUrl.trim()) {
    floorMat.color = new THREE.Color('#ffffff');
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      floorSettings.customImageUrl.trim(),
      (loadedTex) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.anisotropy = maxAnisotropy;
        if (floorSettings.imageFit === 'repeat') {
          loadedTex.wrapS = THREE.RepeatWrapping;
          loadedTex.wrapT = THREE.RepeatWrapping;
          loadedTex.repeat.set(Math.max(2, Math.round(W / 24)), Math.max(2, Math.round(D / 24)));
        } else {
          loadedTex.wrapS = THREE.ClampToEdgeWrapping;
          loadedTex.wrapT = THREE.ClampToEdgeWrapping;
          loadedTex.repeat.set(1, 1);
        }
        loadedTex.needsUpdate = true;
        floorMat.map = loadedTex;
        floorMat.needsUpdate = true;
      },
      undefined,
      () => {
        floorMat.color = new THREE.Color(floorSettings.customColor || '#e2e8f0');
        floorMat.needsUpdate = true;
      },
    );
  } else {
    const presetKind = isOutdoor
      ? floorSettings.outdoorPreset || 'natural_lawn'
      : floorSettings.indoorPreset || 'epoxy_light';
    floorMat.map = makeFloorSurfaceTexture(presetKind, W, D, maxAnisotropy);
  }

  const venueFloor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, D), floorMat);
  venueFloor.position.y = -0.04;
  venueFloor.receiveShadow = true;
  envGroup.add(venueFloor);

  // 3. Optional Metric Floor Grid (5m sub-grid + 20m major structural grid merged into 2 LineSegments)
  if (floorSettings.showGrid !== false) {
    const customCol = new THREE.Color(floorSettings.customColor || '#f8fafc');
    const customLum = customCol.r * 0.2126 + customCol.g * 0.7152 + customCol.b * 0.0722;
    const isDarkSurface =
      (floorSettings.mode === 'preset' &&
        ((!isOutdoor && floorSettings.indoorPreset === 'polished_dark') ||
          (isOutdoor && floorSettings.outdoorPreset === 'asphalt_street'))) ||
      (floorSettings.mode === 'color' && customLum < 0.28);

    const minorVerts: number[] = [];
    const majorVerts: number[] = [];
    const stepM = 5;
    const zMin = -(D - 0.6) * 0.5;
    const zMax = (D - 0.6) * 0.5;
    const xMin = -(W - 0.6) * 0.5;
    const xMax = (W - 0.6) * 0.5;
    const gridY = 0.048;

    for (let gx = -Math.floor(halfW / stepM) * stepM; gx <= halfW - 0.5; gx += stepM) {
      if (Math.abs(gx) >= halfW - 0.2) continue;
      const target = Math.abs(gx) % 20 === 0 ? majorVerts : minorVerts;
      target.push(gx, gridY, zMin, gx, gridY, zMax);
    }
    for (let gz = -Math.floor(halfD / stepM) * stepM; gz <= halfD - 0.5; gz += stepM) {
      if (Math.abs(gz) >= halfD - 0.2) continue;
      const target = Math.abs(gz) % 20 === 0 ? majorVerts : minorVerts;
      target.push(xMin, gridY, gz, xMax, gridY, gz);
    }

    if (minorVerts.length > 0) {
      const minorGeo = new THREE.BufferGeometry();
      minorGeo.setAttribute('position', new THREE.Float32BufferAttribute(minorVerts, 3));
      const minorMat = new THREE.LineBasicMaterial({
        color: isDarkSurface ? '#64748b' : isOutdoor ? '#ffffff' : '#e2e8f0',
        transparent: true,
        opacity: isOutdoor ? 0.34 : 0.8,
      });
      envGroup.add(new THREE.LineSegments(minorGeo, minorMat));
    }

    if (majorVerts.length > 0) {
      const majorGeo = new THREE.BufferGeometry();
      majorGeo.setAttribute('position', new THREE.Float32BufferAttribute(majorVerts, 3));
      const majorMat = new THREE.LineBasicMaterial({
        color: isDarkSurface ? '#94a3b8' : isOutdoor ? '#f8fafc' : '#cbd5e1',
        transparent: true,
        opacity: isOutdoor ? 0.55 : 0.94,
      });
      envGroup.add(new THREE.LineSegments(majorGeo, majorMat));
    }
  }

  // 4. Optional Shape Zone Inlays (when using default preset mode so custom floor image/color stays unobstructed)
  if (floorSettings.mode === 'preset') {
    if (venueShape === 'circle_arena') {
      const stadiumConcourse = new THREE.Mesh(
        new THREE.RingGeometry(0.84, 0.96, 48),
        new THREE.MeshStandardMaterial({
          map: stonePaverTex,
          roughness: 0.82,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
      stadiumConcourse.rotation.x = -Math.PI / 2;
      stadiumConcourse.scale.set(W * 0.46, D * 0.46, 1);
      stadiumConcourse.position.y = 0.052;
      envGroup.add(stadiumConcourse);
    } else if (venueShape === 'courtyard_campus') {
      const trackRing = new THREE.Mesh(
        new THREE.RingGeometry(0.76, 0.91, 48),
        new THREE.MeshStandardMaterial({
          color: '#fed7aa',
          roughness: 0.84,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
      trackRing.rotation.x = -Math.PI / 2;
      trackRing.scale.set(W * 0.46, D * 0.44, 1);
      trackRing.position.y = 0.052;
      envGroup.add(trackRing);
    } else if (venueShape === 'fan_amphitheater') {
      const terraceMat = new THREE.MeshStandardMaterial({
        map: stonePaverTex,
        roughness: 0.82,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      for (const frac of [0.36, 0.56, 0.74]) {
        const arcR = Math.min(W * 0.48, D * 0.78) * frac;
        const arc = new THREE.Mesh(
          new THREE.RingGeometry(arcR - 2.2, arcR, 36, 1, Math.PI * 0.15, Math.PI * 0.7),
          terraceMat,
        );
        arc.rotation.x = -Math.PI / 2;
        arc.position.set(0, 0.052, -D * 0.34);
        envGroup.add(arc);
      }
    }
  }

  // 5. Concourse Promenades (subtle when preset mode is active)
  if (floorSettings.mode === 'preset') {
    const plazaStoneMat = new THREE.MeshStandardMaterial({
      color: isOutdoor ? '#e2e8f0' : '#eef2f6',
      roughness: 0.84,
      transparent: true,
      opacity: isOutdoor ? 0.72 : 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    if (venueModel === 'standard' && venueShape === 'rectangle') {
      for (const px of [-W * 0.2, W * 0.14]) {
        const sideWalkway = new THREE.Mesh(new THREE.PlaneGeometry(7.0, D * 0.66), plazaStoneMat);
        sideWalkway.rotation.x = -Math.PI / 2;
        sideWalkway.position.set(px, 0.05, D * 0.05);
        sideWalkway.receiveShadow = true;
        envGroup.add(sideWalkway);
      }
      const southProm = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.76, 8.0), plazaStoneMat);
      southProm.rotation.x = -Math.PI / 2;
      southProm.position.set(0, 0.05, D * 0.23);
      southProm.receiveShadow = true;
      envGroup.add(southProm);
    } else if (venueModel === 'circular_plaza') {
      const outerR = Math.min(W, D) * 0.3;
      const ring = new THREE.Mesh(new THREE.RingGeometry(outerR * 0.68, outerR, 40), plazaStoneMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.05, 6);
      envGroup.add(ring);
    } else if (venueModel === 'boulevard_grid') {
      for (const bx of [-W * 0.18, W * 0.14]) {
        const blvd = new THREE.Mesh(new THREE.PlaneGeometry(11, D * 0.62), plazaStoneMat);
        blvd.rotation.x = -Math.PI / 2;
        blvd.position.set(bx, 0.05, D * 0.05);
        envGroup.add(blvd);
      }
    }
  }

  // 6. Grounded Booth Apron Pads (inside venue floor)
  const apronMat = new THREE.MeshStandardMaterial({
    color: isOutdoor ? '#f1f5f9' : '#e2e8f0',
    roughness: 0.86,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  for (const f of facilities) {
    if (f.category === 'parking' || f.subtype === 'camping_zone' || f.subtype === 'pet_zone') {
      continue;
    }
    const padW = Math.min(W - 1, f.dimensions.width + 1.0);
    const padD = Math.min(D - 1, f.dimensions.depth + 1.2);
    const padMesh = new THREE.Mesh(new THREE.PlaneGeometry(padW, padD), apronMat);
    padMesh.rotation.order = 'YXZ';
    padMesh.rotation.y = f.rotation || 0;
    padMesh.rotation.x = -Math.PI / 2;
    padMesh.position.set(f.position.x, 0.054, f.position.z);
    padMesh.receiveShadow = true;
    envGroup.add(padMesh);
  }

  // 7. Exterior Parking Zone Aprons & Step-Free Gate Crosswalk Connectors (행사장 외부 공간 주차장)
  const exteriorParkings = facilities.filter((f) => f.category === 'parking');
  const gates = facilities.filter(
    (f) => f.subtype === 'main_entrance' || f.subtype === 'secondary_entrance',
  );
  if (exteriorParkings.length > 0) {
    const extDeckMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      roughness: 0.88,
      metalness: 0.05,
    });
    const extCurbMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.76,
    });
    const crosswalkMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.65,
    });
    const accLinkMat = new THREE.MeshStandardMaterial({
      color: '#0d9488',
      roughness: 0.6,
    });

    for (const pk of exteriorParkings) {
      const isRot90 = Math.abs(Math.sin(pk.rotation || 0)) > 0.7;
      const pw = (isRot90 ? pk.dimensions.depth : pk.dimensions.width) + 7.5;
      const pd = (isRot90 ? pk.dimensions.width : pk.dimensions.depth) + 7.5;

      // Exterior paved parking deck slab outside the venue
      const extCurb = new THREE.Mesh(new THREE.BoxGeometry(pw + 1.2, 0.3, pd + 1.2), extCurbMat);
      extCurb.position.set(pk.position.x, -0.19, pk.position.z);
      extCurb.receiveShadow = true;
      envGroup.add(extCurb);

      const extSlab = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.16, pd), extDeckMat);
      extSlab.position.set(pk.position.x, -0.05, pk.position.z);
      extSlab.receiveShadow = true;
      envGroup.add(extSlab);

      // Step-free pedestrian & wheelchair crosswalk bridge connecting exterior parking to venue boundary
      const clampedEdgeX = Math.max(-halfW, Math.min(halfW, pk.position.x));
      const clampedEdgeZ = Math.max(-halfD, Math.min(halfD, pk.position.z));
      const bridgeMidX = (pk.position.x + clampedEdgeX) * 0.5;
      const bridgeMidZ = (pk.position.z + clampedEdgeZ) * 0.5;
      const gapX = Math.abs(pk.position.x - clampedEdgeX);
      const gapZ = Math.abs(pk.position.z - clampedEdgeZ);

      if (gapX >= gapZ && gapX > 2) {
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(gapX, 0.14, 7.2), extCurbMat);
        bridge.position.set(bridgeMidX, -0.04, clampedEdgeZ);
        bridge.receiveShadow = true;
        envGroup.add(bridge);

        // Accessible teal path + white zebra stripes
        const accLane = new THREE.Mesh(new THREE.BoxGeometry(gapX - 1, 0.04, 2.0), accLinkMat);
        accLane.position.set(bridgeMidX, 0.04, clampedEdgeZ - 2.0);
        envGroup.add(accLane);

        const stripeCount = 5;
        for (let s = 0; s < stripeCount; s++) {
          const zOff = clampedEdgeZ + 0.4 + s * 0.65;
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(Math.max(2, gapX * 0.55), 0.04, 0.36), crosswalkMat);
          stripe.position.set(bridgeMidX, 0.04, zOff);
          envGroup.add(stripe);
        }
      } else if (gapZ > 2) {
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.14, gapZ), extCurbMat);
        bridge.position.set(clampedEdgeX, -0.04, bridgeMidZ);
        bridge.receiveShadow = true;
        envGroup.add(bridge);

        const accLane = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, gapZ - 1), accLinkMat);
        accLane.position.set(clampedEdgeX - 2.0, 0.04, bridgeMidZ);
        envGroup.add(accLane);

        const stripeCount = 5;
        for (let s = 0; s < stripeCount; s++) {
          const xOff = clampedEdgeX + 0.4 + s * 0.65;
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, Math.max(2, gapZ * 0.55)), crosswalkMat);
          stripe.position.set(xOff, 0.04, bridgeMidZ);
          envGroup.add(stripe);
        }
      }
    }
  }

  // 8. Venue Perimeter Boundary:
  //    - Indoor Venue: Low Cutaway Architectural Walls (2.0m) + Structural Corner Columns
  //    - Outdoor Venue: Open-Air Festival Perimeter Bollards, Turf Curb & Low Safety Rail (1.05m, no walls)
  const portalMat = new THREE.MeshStandardMaterial({
    color: '#0d9488',
    roughness: 0.6,
  });

  if (!isOutdoor) {
    const wallH = 2.0;
    const wallT = 0.46;
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.65,
      metalness: 0.08,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      roughness: 0.45,
      metalness: 0.25,
    });

    const buildSegmentedWallAlongX = (zPos: number) => {
      const openings: Array<[number, number]> = [];
      for (const g of gates) {
        if (Math.abs(g.position.z - zPos) < 22) {
          const halfSpan = Math.max(8, Math.max(g.dimensions.width, g.dimensions.depth) * 0.62);
          openings.push([
            Math.max(-halfW + 1, g.position.x - halfSpan),
            Math.min(halfW - 1, g.position.x + halfSpan),
          ]);
          const thresh = new THREE.Mesh(new THREE.BoxGeometry(halfSpan * 1.8, 0.08, 2.2), portalMat);
          thresh.position.set(g.position.x, 0.05, zPos + (zPos > 0 ? -1.1 : 1.1));
          envGroup.add(thresh);
        }
      }
      openings.sort((a, b) => a[0] - b[0]);

      let cursor = -halfW;
      for (const [oStart, oEnd] of openings) {
        if (oStart > cursor + 0.8) {
          const segLen = oStart - cursor;
          const cx = cursor + segLen / 2;
          const wMesh = new THREE.Mesh(new THREE.BoxGeometry(segLen, wallH, wallT), wallMat);
          wMesh.position.set(cx, wallH / 2, zPos);
          wMesh.castShadow = true;
          wMesh.receiveShadow = true;
          envGroup.add(wMesh);

          const cMesh = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.12, wallT + 0.1), capMat);
          cMesh.position.set(cx, wallH + 0.06, zPos);
          envGroup.add(cMesh);
        }
        cursor = Math.max(cursor, oEnd);
      }
      if (halfW > cursor + 0.8) {
        const segLen = halfW - cursor;
        const cx = cursor + segLen / 2;
        const wMesh = new THREE.Mesh(new THREE.BoxGeometry(segLen, wallH, wallT), wallMat);
        wMesh.position.set(cx, wallH / 2, zPos);
        wMesh.castShadow = true;
        wMesh.receiveShadow = true;
        envGroup.add(wMesh);

        const cMesh = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.12, wallT + 0.1), capMat);
        cMesh.position.set(cx, wallH + 0.06, zPos);
        envGroup.add(cMesh);
      }
    };

    const buildSegmentedWallAlongZ = (xPos: number) => {
      const openings: Array<[number, number]> = [];
      for (const g of gates) {
        if (Math.abs(g.position.x - xPos) < 22) {
          const halfSpan = Math.max(8, Math.max(g.dimensions.width, g.dimensions.depth) * 0.62);
          openings.push([
            Math.max(-halfD + 1, g.position.z - halfSpan),
            Math.min(halfD - 1, g.position.z + halfSpan),
          ]);
          const thresh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, halfSpan * 1.8), portalMat);
          thresh.position.set(xPos + (xPos > 0 ? -1.1 : 1.1), 0.05, g.position.z);
          envGroup.add(thresh);
        }
      }
      openings.sort((a, b) => a[0] - b[0]);

      let cursor = -halfD;
      for (const [oStart, oEnd] of openings) {
        if (oStart > cursor + 0.8) {
          const segLen = oStart - cursor;
          const cz = cursor + segLen / 2;
          const wMesh = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, segLen), wallMat);
          wMesh.position.set(xPos, wallH / 2, cz);
          wMesh.castShadow = true;
          wMesh.receiveShadow = true;
          envGroup.add(wMesh);

          const cMesh = new THREE.Mesh(new THREE.BoxGeometry(wallT + 0.1, 0.12, segLen), capMat);
          cMesh.position.set(xPos, wallH + 0.06, cz);
          envGroup.add(cMesh);
        }
        cursor = Math.max(cursor, oEnd);
      }
      if (halfD > cursor + 0.8) {
        const segLen = halfD - cursor;
        const cz = cursor + segLen / 2;
        const wMesh = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, segLen), wallMat);
        wMesh.position.set(xPos, wallH / 2, cz);
        wMesh.castShadow = true;
        wMesh.receiveShadow = true;
        envGroup.add(wMesh);

        const cMesh = new THREE.Mesh(new THREE.BoxGeometry(wallT + 0.1, 0.12, segLen), capMat);
        cMesh.position.set(xPos, wallH + 0.06, cz);
        envGroup.add(cMesh);
      }
    };

    buildSegmentedWallAlongX(-halfD);
    buildSegmentedWallAlongX(halfD);
    buildSegmentedWallAlongZ(-halfW);
    buildSegmentedWallAlongZ(halfW);

    const postMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.45, metalness: 0.35 });
    for (const cx of [-halfW, halfW]) {
      for (const cz of [-halfD, halfD]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.85, wallH + 0.25, 0.85), postMat);
        post.position.set(cx, (wallH + 0.25) / 2, cz);
        post.castShadow = true;
        envGroup.add(post);
      }
    }
  } else {
    // Outdoor Venue: Open-air low stone curb + festival safety bollards & open steel rail (no indoor walls)
    const bollardMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4, metalness: 0.55 });
    const railMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.35, metalness: 0.65 });
    const shrubMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.82 });

    const isNearGate = (px: number, pz: number) =>
      gates.some((g) => Math.hypot(g.position.x - px, g.position.z - pz) < 16);

    const spacing = 10;
    for (let x = -halfW; x <= halfW; x += spacing) {
      for (const zPos of [-halfD, halfD]) {
        if (isNearGate(x, zPos)) continue;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.05, 8), bollardMat);
        post.position.set(x, 0.52, zPos);
        post.castShadow = true;
        envGroup.add(post);
        if (x + spacing <= halfW && !isNearGate(x + spacing, zPos)) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(spacing, 0.07, 0.07), railMat);
          rail.position.set(x + spacing / 2, 0.88, zPos);
          envGroup.add(rail);
        }
      }
    }
    for (let z = -halfD + spacing; z <= halfD - spacing; z += spacing) {
      for (const xPos of [-halfW, halfW]) {
        if (isNearGate(xPos, z)) continue;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.05, 8), bollardMat);
        post.position.set(xPos, 0.52, z);
        post.castShadow = true;
        envGroup.add(post);
        if (z + spacing <= halfD && !isNearGate(xPos, z + spacing)) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, spacing), railMat);
          rail.position.set(xPos, 0.88, z + spacing / 2);
          envGroup.add(rail);
        }
      }
    }
    // Corner planter markers for outdoor open-air boundary
    for (const cx of [-halfW, halfW]) {
      for (const cz of [-halfD, halfD]) {
        const planter = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 0.65, 2.2),
          new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 }),
        );
        planter.position.set(cx, 0.32, cz);
        envGroup.add(planter);
        const bush = new THREE.Mesh(new THREE.SphereGeometry(1.05, 10, 8), shrubMat);
        bush.position.set(cx, 1.15, cz);
        bush.castShadow = true;
        envGroup.add(bush);
      }
    }
  }

  return envGroup;
}

function pointToSegmentDistSq(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-6) {
    return (px - ax) * (px - ax) + (pz - az) * (pz - az);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / lenSq));
  const cx = ax + t * vx;
  const cz = az + t * vz;
  return (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
}

export function buildLandscapingTrees(
  config: EventConfig,
  facilities: Facility[],
  routes: RouteSegment[] = [],
): THREE.Group {
  const treeGroup = new THREE.Group();
  treeGroup.name = 'landscaping-trees';

  // Interior-only venue: zero exterior tree belts, outdoor roads, or park boulders.
  // Only subtle indoor lighting & wayfinding stanchions inside collision-free interior spots when facilities exist.
  if (facilities.length === 0) {
    return treeGroup;
  }

  const W = config.venueWidth;
  const D = config.venueDepth;
  const facilityEnvelopes: WorldAABB[] = facilities.map((f) =>
    getFacilityWorldFootprint(f, config, 2.0),
  );

  const overlapsRoute = (cx: number, cz: number, r: number): boolean => {
    for (const seg of routes) {
      const minClear = seg.width * 0.5 + r + 0.8;
      if (pointToSegmentDistSq(cx, cz, seg.x1, seg.z1, seg.x2, seg.z2) < minClear * minClear) {
        return true;
      }
    }
    return false;
  };

  const isSpotFree = (cx: number, cz: number, r: number): boolean => {
    if (Math.abs(cx) > W * 0.5 - r - 2 || Math.abs(cz) > D * 0.5 - r - 2) return false;
    const probe: WorldAABB = {
      minX: cx - r,
      maxX: cx + r,
      minZ: cz - r,
      maxZ: cz + r,
      centerX: cx,
      centerZ: cz,
      spanW: r * 2,
      spanD: r * 2,
    };
    for (const fBox of facilityEnvelopes) {
      if (worldAABBsOverlap(probe, fBox, 1.0)) return false;
    }
    return !overlapsRoute(cx, cz, r);
  };

  const steelMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.65, roughness: 0.35 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: '#fef9c3',
    emissive: new THREE.Color('#fde047'),
    emissiveIntensity: 0.6,
  });

  const indoorCorners: Array<[number, number]> = [
    [-W * 0.45, -D * 0.43],
    [W * 0.45, -D * 0.43],
    [-W * 0.45, D * 0.43],
    [W * 0.45, D * 0.43],
  ];
  for (const [lx, lz] of indoorCorners) {
    if (!isSpotFree(lx, lz, 1.2)) continue;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 6.2, 8), steelMat);
    mast.position.set(lx, 3.1, lz);
    treeGroup.add(mast);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5), lampMat);
    head.position.set(lx, 6.2, lz);
    treeGroup.add(head);
  }

  return treeGroup;
}

export function buildRouteLayers(
  routes: RouteSegment[],
  config?: EventConfig,
): {
  pedestrianGroup: THREE.Group;
  evacuationGroup: THREE.Group;
  emergencyAmbulanceGroup: THREE.Group;
} {
  const pedestrianGroup = new THREE.Group();
  const evacuationGroup = new THREE.Group();
  const emergencyAmbulanceGroup = new THREE.Group();
  const isWideBarrierFree = Boolean(config?.accessibility.wideCorridors);
  const hasTactile = Boolean(config?.accessibility.stepFreeRoutes || isWideBarrierFree);

  const pedMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.88,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const mobilityLaneMat = new THREE.MeshStandardMaterial({
    color: '#99f6e4',
    roughness: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const accessibleEgressMat = new THREE.MeshBasicMaterial({
    color: '#0d9488',
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });

  const tactileLineMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    roughness: 0.68,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });

  const evacMat = new THREE.MeshBasicMaterial({
    color: '#2563eb',
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });

  const evacChevronMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  });

  const ambulanceMat = new THREE.MeshBasicMaterial({
    color: '#ef4444',
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const evacJunctionSet = new Set<string>();
  const accessJunctionSet = new Set<string>();

  for (const seg of routes) {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const len = Math.hypot(dx, dz);
    if (len < 1) continue;

    const midX = (seg.x1 + seg.x2) / 2;
    const midZ = (seg.z1 + seg.z2) / 2;
    const angle = Math.atan2(dx, dz);

    if (seg.isAccessibleEgress) {
      const laneW = seg.width * 0.68;
      const accGrp = new THREE.Group();
      accGrp.position.set(midX, 0, midZ);
      accGrp.rotation.y = angle;

      const strip = new THREE.Mesh(new THREE.PlaneGeometry(laneW, len + laneW * 0.3), accessibleEgressMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.y = 0.115;
      accGrp.add(strip);

      const arrowSpacing = 9.0;
      const arrowCount = Math.max(1, Math.floor(len / arrowSpacing));
      for (let a = 0; a < arrowCount; a++) {
        const zOff = -len * 0.5 + ((a + 0.55) / arrowCount) * len;
        const chevron = new THREE.Mesh(new THREE.ConeGeometry(laneW * 0.24, 1.25, 3), evacChevronMat);
        chevron.rotation.x = Math.PI / 2;
        chevron.position.set(0, 0.135, zOff);
        accGrp.add(chevron);
      }
      pedestrianGroup.add(accGrp);

      for (const [jx, jz] of [
        [seg.x1, seg.z1],
        [seg.x2, seg.z2],
      ]) {
        const key = `${Math.round(jx)}_${Math.round(jz)}`;
        if (!accessJunctionSet.has(key)) {
          accessJunctionSet.add(key);
          const hub = new THREE.Mesh(new THREE.CircleGeometry(laneW * 0.54, 18), accessibleEgressMat);
          hub.rotation.x = -Math.PI / 2;
          hub.position.set(jx, 0.116, jz);
          pedestrianGroup.add(hub);
        }
      }
    } else if (seg.isEvacuation) {
      const laneW = seg.width * 0.68;
      const evacSegGrp = new THREE.Group();
      evacSegGrp.position.set(midX, 0, midZ);
      evacSegGrp.rotation.y = angle;

      const strip = new THREE.Mesh(new THREE.PlaneGeometry(laneW, len + laneW * 0.35), evacMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.y = 0.14;
      evacSegGrp.add(strip);

      const arrowSpacing = 9.5;
      const arrowCount = Math.max(1, Math.floor(len / arrowSpacing));
      for (let a = 0; a < arrowCount; a++) {
        const zOff = -len * 0.5 + ((a + 0.55) / arrowCount) * len;
        const chevron = new THREE.Mesh(new THREE.ConeGeometry(laneW * 0.24, 1.35, 3), evacChevronMat);
        chevron.rotation.x = Math.PI / 2;
        chevron.position.set(0, 0.16, zOff);
        evacSegGrp.add(chevron);
      }
      evacuationGroup.add(evacSegGrp);

      for (const [jx, jz] of [
        [seg.x1, seg.z1],
        [seg.x2, seg.z2],
      ]) {
        const key = `${Math.round(jx)}_${Math.round(jz)}`;
        if (!evacJunctionSet.has(key)) {
          evacJunctionSet.add(key);
          const hub = new THREE.Mesh(new THREE.CircleGeometry(laneW * 0.54, 18), evacMat);
          hub.rotation.x = -Math.PI / 2;
          hub.position.set(jx, 0.142, jz);
          evacuationGroup.add(hub);

          const ambHub = new THREE.Mesh(new THREE.CircleGeometry(seg.width * 0.9, 18), ambulanceMat);
          ambHub.rotation.x = -Math.PI / 2;
          ambHub.position.set(jx, 0.22, jz);
          emergencyAmbulanceGroup.add(ambHub);
        }
      }

      const ambStrip = new THREE.Mesh(new THREE.PlaneGeometry(seg.width * 1.65, len + 2.0), ambulanceMat);
      ambStrip.rotation.x = -Math.PI / 2;
      ambStrip.rotation.z = angle;
      ambStrip.position.set(midX, 0.22, midZ);
      emergencyAmbulanceGroup.add(ambStrip);
    } else {
      const segGroup = new THREE.Group();
      segGroup.position.set(midX, 0, midZ);
      segGroup.rotation.y = angle;

      const pathMesh = new THREE.Mesh(
        new THREE.BoxGeometry(seg.width, 0.08, len + seg.width * 0.45),
        pedMat,
      );
      pathMesh.position.y = 0.04;
      pathMesh.receiveShadow = true;
      segGroup.add(pathMesh);

      if (isWideBarrierFree) {
        const tealLane = new THREE.Mesh(
          new THREE.BoxGeometry(seg.width * 0.34, 0.092, len + seg.width * 0.35),
          mobilityLaneMat,
        );
        tealLane.position.set(seg.width * 0.24, 0.048, 0);
        segGroup.add(tealLane);
      }

      if (hasTactile) {
        const tac = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.098, len + seg.width * 0.25),
          tactileLineMat,
        );
        tac.position.set(isWideBarrierFree ? 0.1 : 0, 0.052, 0);
        segGroup.add(tac);
      }

      pedestrianGroup.add(segGroup);
    }
  }

  // Add Blue 360° Wheelchair Turning Hub Circles at primary corridor intersections when wideCorridors is ON
  if (isWideBarrierFree && config) {
    const W = config.venueWidth;
    const D = config.venueDepth;
    const hubMat = new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.65 });
    const ringMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
    const hubs: Array<[number, number]> = [
      [-7, 6],
      [-W * 0.2, 6],
      [W * 0.2, 6],
      [-7, D * 0.28],
    ];
    for (const [hx, hz] of hubs) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.1, 24), ringMat);
      ring.position.set(hx, 0.052, hz);
      pedestrianGroup.add(ring);

      const inner = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.11, 24), hubMat);
      inner.position.set(hx, 0.058, hz);
      pedestrianGroup.add(inner);
    }
  }

  return { pedestrianGroup, evacuationGroup, emergencyAmbulanceGroup };
}

/**
 * Composite 3D Crowd Role & Assistive Device Geometries (InstancedMesh-ready with vertexColors)
 */
export function buildStaffGearGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Fluorescent safety lime-yellow vest
  const vest = new THREE.CylinderGeometry(0.36, 0.43, 0.68, 8);
  vest.translate(0, 1.0, 0);
  parts.push(paintAndPreparePart(vest, '#a3e635'));

  // Dual white reflective safety stripes
  const stripe1 = new THREE.CylinderGeometry(0.375, 0.39, 0.08, 8);
  stripe1.translate(0, 1.12, 0);
  parts.push(paintAndPreparePart(stripe1, '#ffffff'));

  const stripe2 = new THREE.CylinderGeometry(0.4, 0.415, 0.08, 8);
  stripe2.translate(0, 0.88, 0);
  parts.push(paintAndPreparePart(stripe2, '#ffffff'));

  // Safety helmet / cap + visor
  const cap = new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
  cap.translate(0, 1.66, 0);
  parts.push(paintAndPreparePart(cap, '#facc15'));

  const visor = new THREE.BoxGeometry(0.36, 0.05, 0.24);
  visor.translate(0, 1.68, 0.22);
  parts.push(paintAndPreparePart(visor, '#0f172a'));

  // Raised right arm + glowing red LED signal wand (경광봉)
  const arm = new THREE.CylinderGeometry(0.08, 0.09, 0.48, 6);
  arm.rotateX(-0.55);
  arm.translate(0.42, 1.25, 0.18);
  parts.push(paintAndPreparePart(arm, '#84cc16'));

  const wand = new THREE.CylinderGeometry(0.045, 0.045, 0.62, 6);
  wand.rotateX(-0.35);
  wand.translate(0.44, 1.64, 0.34);
  parts.push(paintAndPreparePart(wand, '#ef4444'));

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

export function buildWheelchairAgentGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 1. Left & Right large rear spoked drive wheels + silver push-rims
  for (const side of [-1, 1]) {
    const tire = new THREE.TorusGeometry(0.42, 0.065, 8, 16);
    tire.rotateY(Math.PI / 2);
    tire.translate(side * 0.48, 0.44, -0.08);
    parts.push(paintAndPreparePart(tire, '#0f172a'));

    const hub = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12);
    hub.rotateZ(Math.PI / 2);
    hub.translate(side * 0.46, 0.44, -0.08);
    parts.push(paintAndPreparePart(hub, '#cbd5e1'));

    // Front caster wheel
    const caster = new THREE.CylinderGeometry(0.14, 0.14, 0.06, 10);
    caster.rotateZ(Math.PI / 2);
    caster.translate(side * 0.36, 0.14, 0.44);
    parts.push(paintAndPreparePart(caster, '#1e293b'));

    // Padded armrest
    const armRest = new THREE.BoxGeometry(0.08, 0.07, 0.52);
    armRest.translate(side * 0.42, 0.86, 0.04);
    parts.push(paintAndPreparePart(armRest, '#475569'));
  }

  // 2. Seat pan, backrest, rear push handles & front footrest plate
  const seat = new THREE.BoxGeometry(0.76, 0.1, 0.64);
  seat.translate(0, 0.56, 0.02);
  parts.push(paintAndPreparePart(seat, '#1e293b'));

  const backrest = new THREE.BoxGeometry(0.74, 0.68, 0.1);
  backrest.translate(0, 0.92, -0.28);
  parts.push(paintAndPreparePart(backrest, '#334155'));

  const footplate = new THREE.BoxGeometry(0.64, 0.06, 0.32);
  footplate.translate(0, 0.16, 0.52);
  parts.push(paintAndPreparePart(footplate, '#94a3b8'));

  // 3. Seated rider actively using the wheelchair (Unified Emerald-Teal Accessibility Group)
  const thighs = new THREE.BoxGeometry(0.56, 0.2, 0.5);
  thighs.translate(0, 0.68, 0.12);
  parts.push(paintAndPreparePart(thighs, '#115e59'));

  const calves = new THREE.BoxGeometry(0.48, 0.42, 0.18);
  calves.rotateX(-0.22);
  calves.translate(0, 0.4, 0.42);
  parts.push(paintAndPreparePart(calves, '#115e59'));

  const torso = new THREE.CylinderGeometry(0.28, 0.32, 0.68, 8);
  torso.translate(0, 1.04, -0.04);
  parts.push(paintAndPreparePart(torso, '#0d9488'));

  for (const side of [-1, 1]) {
    const riderArm = new THREE.CylinderGeometry(0.075, 0.075, 0.46, 6);
    riderArm.rotateZ(side * -0.35);
    riderArm.rotateX(0.32);
    riderArm.translate(side * 0.38, 0.88, 0.05);
    parts.push(paintAndPreparePart(riderArm, '#14b8a6'));
  }

  const head = new THREE.SphereGeometry(0.26, 8, 8);
  head.translate(0, 1.56, -0.02);
  parts.push(paintAndPreparePart(head, '#fde68a'));

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

export function buildMobilityScooterAgentGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 1. 4-Wheel Electric Mobility Scooter Deck & Rear Motor Shroud (Unified Emerald-Teal Group)
  const deck = new THREE.BoxGeometry(0.76, 0.16, 1.38);
  deck.translate(0, 0.24, 0.08);
  parts.push(paintAndPreparePart(deck, '#0d9488'));

  const motorHood = new THREE.BoxGeometry(0.72, 0.32, 0.48);
  motorHood.translate(0, 0.42, -0.36);
  parts.push(paintAndPreparePart(motorHood, '#0f766e'));

  for (const sx of [-0.38, 0.38]) {
    for (const sz of [-0.42, 0.56]) {
      const wheel = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10);
      wheel.rotateZ(Math.PI / 2);
      wheel.translate(sx, 0.2, sz);
      parts.push(paintAndPreparePart(wheel, '#0f172a'));
    }
  }

  const tiller = new THREE.CylinderGeometry(0.055, 0.065, 0.86, 8);
  tiller.rotateX(-0.26);
  tiller.translate(0, 0.68, 0.56);
  parts.push(paintAndPreparePart(tiller, '#cbd5e1'));

  const handleBar = new THREE.CylinderGeometry(0.04, 0.04, 0.62, 8);
  handleBar.rotateZ(Math.PI / 2);
  handleBar.translate(0, 1.06, 0.44);
  parts.push(paintAndPreparePart(handleBar, '#0f172a'));

  const basket = new THREE.BoxGeometry(0.48, 0.3, 0.34);
  basket.translate(0, 0.74, 0.74);
  parts.push(paintAndPreparePart(basket, '#334155'));

  const headlight = new THREE.SphereGeometry(0.08, 6, 6);
  headlight.translate(0, 0.94, 0.68);
  parts.push(paintAndPreparePart(headlight, '#fde047'));

  // Seated Rider in Unified Emerald-Teal Attire
  const chair = new THREE.BoxGeometry(0.62, 0.62, 0.52);
  chair.translate(0, 0.72, -0.18);
  parts.push(paintAndPreparePart(chair, '#1e293b'));

  const riderTorso = new THREE.CylinderGeometry(0.27, 0.31, 0.66, 8);
  riderTorso.translate(0, 1.1, -0.12);
  parts.push(paintAndPreparePart(riderTorso, '#10b981'));

  const riderLegs = new THREE.BoxGeometry(0.5, 0.38, 0.42);
  riderLegs.rotateX(0.35);
  riderLegs.translate(0, 0.56, 0.22);
  parts.push(paintAndPreparePart(riderLegs, '#115e59'));

  for (const side of [-1, 1]) {
    const arm = new THREE.CylinderGeometry(0.07, 0.07, 0.52, 6);
    arm.rotateX(1.18);
    arm.translate(side * 0.26, 1.08, 0.16);
    parts.push(paintAndPreparePart(arm, '#14b8a6'));
  }

  const head = new THREE.SphereGeometry(0.26, 8, 8);
  head.translate(0, 1.6, -0.1);
  parts.push(paintAndPreparePart(head, '#fde68a'));

  const sunHat = new THREE.CylinderGeometry(0.22, 0.36, 0.12, 10);
  sunHat.translate(0, 1.8, -0.1);
  parts.push(paintAndPreparePart(sunHat, '#ccfbf1'));

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

export function buildStrollerDeviceGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const offsetZ = 0.88;

  for (const side of [-0.26, 0.26]) {
    const tube = new THREE.CylinderGeometry(0.035, 0.035, 0.92, 6);
    tube.rotateX(0.62);
    tube.translate(side, 0.68, offsetZ - 0.34);
    parts.push(paintAndPreparePart(tube, '#cbd5e1'));
  }

  const grip = new THREE.CylinderGeometry(0.04, 0.04, 0.56, 6);
  grip.rotateZ(Math.PI / 2);
  grip.translate(0, 1.04, offsetZ - 0.6);
  parts.push(paintAndPreparePart(grip, '#0f172a'));

  // Unified Emerald-Teal Accessibility Group Stroller Bassinet & Canopy
  const bassinet = new THREE.BoxGeometry(0.56, 0.32, 0.68);
  bassinet.translate(0, 0.52, offsetZ);
  parts.push(paintAndPreparePart(bassinet, '#99f6e4'));

  const canopy = new THREE.SphereGeometry(0.32, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
  canopy.scale(0.95, 1.0, 1.05);
  canopy.translate(0, 0.68, offsetZ - 0.12);
  parts.push(paintAndPreparePart(canopy, '#0d9488'));

  const babyHead = new THREE.SphereGeometry(0.15, 6, 6);
  babyHead.translate(0, 0.76, offsetZ + 0.14);
  parts.push(paintAndPreparePart(babyHead, '#fde68a'));

  for (const wx of [-0.28, 0.28]) {
    for (const wz of [offsetZ - 0.24, offsetZ + 0.26]) {
      const wh = new THREE.CylinderGeometry(0.14, 0.14, 0.06, 8);
      wh.rotateZ(Math.PI / 2);
      wh.translate(wx, 0.14, wz);
      parts.push(paintAndPreparePart(wh, '#1e293b'));
    }
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

export function buildWhiteCaneGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Upper white shaft angled from right hand (0.34, 0.94, 0.12) forward to ground (0.18, 0.05, 1.18)
  const upper = new THREE.CylinderGeometry(0.026, 0.026, 0.95, 6);
  upper.rotateX(0.88);
  upper.rotateZ(0.12);
  upper.translate(0.28, 0.62, 0.52);
  parts.push(paintAndPreparePart(upper, '#ffffff'));

  // Lower red reflective tip segment
  const lower = new THREE.CylinderGeometry(0.028, 0.032, 0.45, 6);
  lower.rotateX(0.88);
  lower.rotateZ(0.12);
  lower.translate(0.2, 0.18, 1.02);
  parts.push(paintAndPreparePart(lower, '#ef4444'));

  const tipBall = new THREE.SphereGeometry(0.055, 6, 6);
  tipBall.translate(0.17, 0.05, 1.18);
  parts.push(paintAndPreparePart(tipBall, '#ef4444'));

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

export function buildCompanionDogGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Coat vertices use #ffffff so InstancedMesh.setColorAt tints fur cleanly!
  const torso = new THREE.CapsuleGeometry(0.2, 0.44, 4, 8);
  torso.rotateX(Math.PI / 2);
  torso.translate(0, 0.42, 0);
  parts.push(paintAndPreparePart(torso, '#ffffff'));

  const head = new THREE.SphereGeometry(0.18, 8, 8);
  head.translate(0, 0.62, 0.32);
  parts.push(paintAndPreparePart(head, '#ffffff'));

  const snout = new THREE.BoxGeometry(0.15, 0.13, 0.2);
  snout.translate(0, 0.58, 0.46);
  parts.push(paintAndPreparePart(snout, '#ffffff'));

  const nose = new THREE.SphereGeometry(0.045, 6, 6);
  nose.translate(0, 0.61, 0.56);
  parts.push(paintAndPreparePart(nose, '#0f172a'));

  for (const side of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.075, 0.18, 5);
    ear.rotateZ(side * -0.2);
    ear.translate(side * 0.12, 0.78, 0.3);
    parts.push(paintAndPreparePart(ear, '#f1f5f9'));
  }

  for (const lx of [-0.12, 0.12]) {
    for (const lz of [-0.2, 0.22]) {
      const leg = new THREE.CylinderGeometry(0.05, 0.045, 0.32, 6);
      leg.translate(lx, 0.16, lz);
      parts.push(paintAndPreparePart(leg, '#ffffff'));
    }
  }

  const tail = new THREE.ConeGeometry(0.055, 0.28, 6);
  tail.rotateX(-0.65);
  tail.translate(0, 0.58, -0.34);
  parts.push(paintAndPreparePart(tail, '#ffffff'));

  const collar = new THREE.TorusGeometry(0.155, 0.032, 6, 12);
  collar.rotateX(Math.PI / 2 - 0.35);
  collar.translate(0, 0.52, 0.24);
  parts.push(paintAndPreparePart(collar, '#ef4444'));

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

export function buildGuideDogHarnessGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Bright yellow/orange service-dog saddle vest + rigid guide handle
  const saddle = new THREE.BoxGeometry(0.44, 0.22, 0.36);
  saddle.translate(0, 0.48, 0.04);
  parts.push(paintAndPreparePart(saddle, '#f97316'));

  const handleBar = new THREE.BoxGeometry(0.28, 0.04, 0.52);
  handleBar.rotateX(0.55);
  handleBar.translate(0, 0.72, -0.14);
  parts.push(paintAndPreparePart(handleBar, '#facc15'));

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}
