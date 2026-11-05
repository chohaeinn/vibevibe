import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Car,
  Check,
  Compass,
  Eye,
  FilePlus2,
  Laptop,
  Lock,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  PanelLeft,
  PanelRight,
  PenTool,
  Plus,
  RefreshCw,
  RotateCcw,
  Tag,
  X,
} from 'lucide-react';
import { buildVenueRoutes, CrowdSimulator } from '../engine/crowdSimulation';
import { getFacilityDisplayName } from '../engine/presets';
import {
  buildCompanionDogGeometry,
  buildFacilityGroup,
  buildGuideDogHarnessGeometry,
  buildLandscapingTrees,
  buildMobilityScooterAgentGeometry,
  buildRouteLayers,
  buildStaffGearGeometry,
  buildStrollerDeviceGeometry,
  buildVenueGroundAndPerimeter,
  buildWheelchairAgentGeometry,
  buildWhiteCaneGeometry,
} from '../engine/venueMeshBuilder';
import {
  CATEGORY_SIMPLE_LABELS,
  CONTINGENCY_MULTILANG,
  tUi,
  VENUE_ENV_FLOOR_STRINGS,
} from '../i18n/translations';
import {
  CameraViewMode,
  ContingencyScenario,
  CrowdRoleCounts,
  DeviceControlMode,
  EventConfig,
  Facility,
  FacilityCategory,
  GhostPreviewState,
  Language,
  LayerVisibility,
  SimulationSnapshot,
} from '../types/festival';

import { tr6 } from '../i18n/localeCatalog';

interface ThreeVenueCanvasProps {
  language: Language;
  config: EventConfig;
  facilities: Facility[];
  baselineFacilities?: Facility[];
  onSwitchLayoutMode?: (mode: 'original' | 'optimized') => void;
  visibility: LayerVisibility;
  onToggleVisibility: (key: keyof LayerVisibility) => void;
  onQuickToggleAccessibility?: (
    key: 'stepFreeRoutes' | 'wideCorridors' | 'accessibleRestrooms' | 'accessibleParking',
  ) => void;
  roleCounts?: CrowdRoleCounts;
  selectedFacilityId: string | null;
  highlightedFacilityIds?: string[];
  onSelectFacility: (id: string | null) => void;
  onMoveFacility: (id: string, x: number, z: number) => void;
  onResizeFacility: (id: string, deltaW: number, deltaD: number) => void;
  onNudgeFacility: (id: string, dx: number, dz: number) => void;
  ghostPreview: GhostPreviewState | null;
  onConfirmGhostPreview: () => void;
  onCancelGhostPreview: () => void;
  deviceMode: DeviceControlMode;
  onChangeDeviceMode: (mode: DeviceControlMode) => void;
  simulatorRef: React.MutableRefObject<CrowdSimulator>;
  isPlaying: boolean;
  simSpeed: number;
  simProgress: number;
  contingency: ContingencyScenario;
  onChangeContingency: (scenario: ContingencyScenario) => void;
  onReoptimizeContingency: () => void;
  onSnapshotUpdate: (snapshot: SimulationSnapshot) => void;
  activeLayoutBadge: 'original' | 'optimized';
  isLeftSidebarOpen?: boolean;
  onToggleLeftSidebar?: () => void;
  isRightSidebarOpen?: boolean;
  onToggleRightSidebar?: () => void;
  onRequestNewPlan?: () => void;
  onResetDesign?: () => void;
  children?: React.ReactNode;
}

const _dummy = new THREE.Object3D();
const _headDummy = new THREE.Object3D();
const _auxDummy = new THREE.Object3D();
const _projVec = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _hitVec = new THREE.Vector3();
const _floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const _generalPalette = [
  new THREE.Color('#2563eb'),
  new THREE.Color('#3b82f6'),
  new THREE.Color('#1d4ed8'),
  new THREE.Color('#4f46e5'),
];
const _staffTrouserColor = new THREE.Color('#365314');
// Unified Emerald-Teal Priority Access Group (wheelchair + scooter + stroller)
const _strollerGuardianColor = new THREE.Color('#0d9488');
const _visuallyImpairedColor = new THREE.Color('#0d9488');
const _petOwnerColor = new THREE.Color('#0f766e');
const _petCoatPalette = [
  new THREE.Color('#f59e0b'),
  new THREE.Color('#f8fafc'),
  new THREE.Color('#c2410c'),
  new THREE.Color('#475569'),
  new THREE.Color('#fde68a'),
];
const _guideDogCoatColor = new THREE.Color('#fbbf24');

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function disposeMaterialSafely(mat: THREE.Material): void {
  const std = mat as THREE.MeshStandardMaterial;
  if (std.map && !std.map.userData?.shared) std.map.dispose();
  if (std.emissiveMap && !std.emissiveMap.userData?.shared) std.emissiveMap.dispose();
  if (std.bumpMap && !std.bumpMap.userData?.shared) std.bumpMap.dispose();
  mat.dispose();
}

function disposeGroupChildren(grp: THREE.Group): void {
  while (grp.children.length > 0) {
    const child = grp.children[0];
    child.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Line).isLine) {
        const renderable = obj as THREE.Mesh | THREE.Line;
        renderable.geometry?.dispose();
        if (Array.isArray(renderable.material)) {
          renderable.material.forEach(disposeMaterialSafely);
        } else if (renderable.material) {
          disposeMaterialSafely(renderable.material);
        }
      }
    });
    grp.remove(child);
  }
}

function writeHeatmapTextureData(
  densityGrid: Float32Array,
  rgbaBuffer: Uint8Array,
  cols: number,
  rows: number,
): void {
  for (let dstRow = 0; dstRow < rows; dstRow++) {
    const srcRow = rows - 1 - dstRow;
    const srcRowOffset = srcRow * cols;
    const dstRowOffset = dstRow * cols;
    for (let c = 0; c < cols; c++) {
      const d = densityGrid[srcRowOffset + c];
      const idx = (dstRowOffset + c) * 4;
      if (d < 0.16) {
        rgbaBuffer[idx] = 34;
        rgbaBuffer[idx + 1] = 197;
        rgbaBuffer[idx + 2] = 94;
        rgbaBuffer[idx + 3] = 0;
        continue;
      }

      let r = 34;
      let g = 197;
      let b = 94;
      let alpha = 115;

      if (d < 0.85) {
        const t = (d - 0.16) / 0.69;
        r = Math.round(34 + (234 - 34) * t);
        g = Math.round(197 + (179 - 197) * t);
        b = Math.round(94 + (8 - 94) * t);
        alpha = Math.round(65 + t * 88);
      } else if (d < 1.8) {
        const t = (d - 0.85) / 0.95;
        r = Math.round(234 + (249 - 234) * t);
        g = Math.round(179 + (115 - 179) * t);
        b = Math.round(8 + (22 - 8) * t);
        alpha = Math.round(153 + t * 42);
      } else if (d < 2.9) {
        const t = (d - 1.8) / 1.1;
        r = Math.round(249 + (220 - 249) * t);
        g = Math.round(115 + (38 - 115) * t);
        b = Math.round(22 + (38 - 22) * t);
        alpha = Math.round(195 + t * 35);
      } else {
        r = 220;
        g = 38;
        b = 38;
        alpha = 235;
      }

      rgbaBuffer[idx] = r;
      rgbaBuffer[idx + 1] = g;
      rgbaBuffer[idx + 2] = b;
      rgbaBuffer[idx + 3] = alpha;
    }
  }
}

export const ThreeVenueCanvas: React.FC<ThreeVenueCanvasProps> = ({
  language,
  config,
  facilities,
  baselineFacilities,
  onSwitchLayoutMode,
  visibility,
  onToggleVisibility,
  onQuickToggleAccessibility,
  roleCounts,
  selectedFacilityId,
  highlightedFacilityIds = [],
  onSelectFacility,
  onMoveFacility,
  onResizeFacility,
  onNudgeFacility,
  ghostPreview,
  onConfirmGhostPreview,
  onCancelGhostPreview,
  deviceMode,
  onChangeDeviceMode,
  simulatorRef,
  isPlaying,
  simSpeed,
  simProgress,
  contingency,
  onChangeContingency,
  onReoptimizeContingency,
  onSnapshotUpdate,
  activeLayoutBadge,
  isLeftSidebarOpen = true,
  onToggleLeftSidebar,
  isRightSidebarOpen = true,
  onToggleRightSidebar,
  onRequestNewPlan,
  onResetDesign,
  children,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [cameraMode, setCameraMode] = useState<CameraViewMode>('isometric');
  const [dragMode, setDragMode] = useState<'rotate' | 'pan'>('rotate');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [lockedToast, setLockedToast] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [showRoleLegend, setShowRoleLegend] = useState(true);
  const [previewOverlayExisting, setPreviewOverlayExisting] = useState(false);
  const pressedKeysRef = useRef<Set<string>>(new Set());

  const ui = tUi(language);
  const efStrings = VENUE_ENV_FLOOR_STRINGS[language] || VENUE_ENV_FLOOR_STRINGS.ko;
  const isKo = language === 'ko';

  const triggerLockedToast = (msg: string) => {
    setLockedToast(msg);
    window.setTimeout(() => {
      setLockedToast((cur) => (cur === msg ? null : cur));
    }, 2200);
  };

  const stateRef = useRef({
    language,
    ui,
    config,
    facilities,
    visibility,
    selectedFacilityId,
    highlightedFacilityIds,
    deviceMode,
    isPlaying,
    simSpeed,
    contingency,
    onSelectFacility,
    onMoveFacility,
    onResizeFacility,
    onNudgeFacility,
    onSnapshotUpdate,
  });
  stateRef.current = {
    language,
    ui,
    config,
    facilities,
    visibility,
    selectedFacilityId,
    highlightedFacilityIds,
    deviceMode,
    isPlaying,
    simSpeed,
    contingency,
    onSelectFacility,
    onMoveFacility,
    onResizeFacility,
    onNudgeFacility,
    onSnapshotUpdate,
  };

  const sceneHandlesRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    renderer: THREE.WebGLRenderer;
    sunLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    envRoot: THREE.Group;
    facilitiesRoot: THREE.Group;
    ghostRoot: THREE.Group;
    facilityMap: Map<string, THREE.Group>;
    landscapingRoot: THREE.Group;
    pedestrianRoot: THREE.Group;
    evacuationRoot: THREE.Group;
    selectionRingGroup: THREE.Group;
    emergencyCorridorRoot: THREE.Group;
    rainLines: THREE.LineSegments;
    rainPositions: Float32Array;
    heatmapMesh: THREE.Mesh;
    heatmapTexture: THREE.DataTexture;
    heatmapRgba: Uint8Array;
    visitorBodies: THREE.InstancedMesh;
    visitorHeads: THREE.InstancedMesh;
    staffGearMesh: THREE.InstancedMesh;
    wheelchairUsersMesh: THREE.InstancedMesh;
    scooterUsersMesh: THREE.InstancedMesh;
    strollerMesh: THREE.InstancedMesh;
    whiteCaneMesh: THREE.InstancedMesh;
    companionPetsMesh: THREE.InstancedMesh;
    guideDogHarnessMesh: THREE.InstancedMesh;
    petLeashes: THREE.LineSegments;
    petLeashPositions: Float32Array;
    cameraTransition: {
      active: boolean;
      pos: THREE.Vector3;
      look: THREE.Vector3;
    };
    maxAnisotropy: number;
  } | null>(null);

  const getPresetCameraPose = (mode: CameraViewMode, w: number, d: number) => {
    const hasExtParking = stateRef.current.facilities.some((f) => f.category === 'parking');
    const span = Math.max(w, d);
    const centerLookX = hasExtParking ? 10 : 0;
    if (mode === 'top') {
      return {
        pos: new THREE.Vector3(centerLookX, span * (hasExtParking ? 1.06 : 0.92), 0.01),
        look: new THREE.Vector3(centerLookX, 0, 0),
      };
    }
    if (mode === 'perspective') {
      return {
        pos: new THREE.Vector3(0, span * 0.25, span * 0.58),
        look: new THREE.Vector3(0, 3, -10),
      };
    }
    return {
      pos: new THREE.Vector3(
        -span * (hasExtParking ? 0.52 : 0.54),
        span * (hasExtParking ? 0.58 : 0.54),
        span * (hasExtParking ? 0.66 : 0.6),
      ),
      look: new THREE.Vector3(centerLookX, 0, 0),
    };
  };

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL context could not be initialized on this browser.');
      return;
    }

    const rect = mount.getBoundingClientRect();
    const initW = Math.max(300, rect.width || 900);
    const initH = Math.max(300, rect.height || 640);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(initW, initH);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('WebGL rendering context paused. Restoring automatically...');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef2f6');
    scene.fog = new THREE.Fog('#eef2f6', 240, 560);

    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {
      // Fallback gracefully if PMREM fails on restricted WebGL drivers
    }

    const hemiLight = new THREE.HemisphereLight('#f8fafc', '#cbd5e1', 0.92);
    hemiLight.position.set(0, 120, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fffbeb', 1.6);
    sunLight.position.set(-80, 135, 90);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    const shadowBound = 165;
    sunLight.shadow.camera.left = -shadowBound;
    sunLight.shadow.camera.right = shadowBound;
    sunLight.shadow.camera.top = shadowBound;
    sunLight.shadow.camera.bottom = -shadowBound;
    sunLight.shadow.camera.near = 20;
    sunLight.shadow.camera.far = 360;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#dbeafe', 0.42);
    rimLight.position.set(85, 65, -85);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(36, initW / initH, 1, 900);
    const initPose = getPresetCameraPose(
      'isometric',
      stateRef.current.config.venueWidth,
      stateRef.current.config.venueDepth,
    );
    camera.position.copy(initPose.pos);
    camera.lookAt(initPose.look);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.panSpeed = 1.15;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 24;
    controls.maxDistance = 440;
    controls.target.copy(initPose.look);
    controls.update();

    const envRoot = new THREE.Group();
    const pedestrianRoot = new THREE.Group();
    const evacuationRoot = new THREE.Group();
    const landscapingRoot = new THREE.Group();
    const facilitiesRoot = new THREE.Group();
    const ghostRoot = new THREE.Group();
    const selectionRingGroup = new THREE.Group();
    selectionRingGroup.visible = false;

    const ringMat = new THREE.MeshBasicMaterial({
      color: '#2563eb',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const selPlane = new THREE.Mesh(new THREE.RingGeometry(0.47, 0.52, 4), ringMat);
    selPlane.rotation.x = -Math.PI / 2;
    selPlane.rotation.z = Math.PI / 4;
    selPlane.position.y = 0.24;
    selectionRingGroup.add(selPlane);

    const selBeacon = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 2.2, 4),
      new THREE.MeshBasicMaterial({ color: '#2563eb' }),
    );
    selBeacon.rotation.x = Math.PI;
    selBeacon.position.y = 14;
    selectionRingGroup.add(selBeacon);

    const emergencyCorridorRoot = new THREE.Group();
    emergencyCorridorRoot.visible = false;

    const rainDropCount = 360;
    const rainPositions = new Float32Array(rainDropCount * 6);
    for (let i = 0; i < rainDropCount; i++) {
      const rx = (Math.random() - 0.5) * 200;
      const ry = Math.random() * 60 + 4;
      const rz = (Math.random() - 0.5) * 160;
      const base = i * 6;
      rainPositions[base] = rx;
      rainPositions[base + 1] = ry;
      rainPositions[base + 2] = rz;
      rainPositions[base + 3] = rx - 0.5;
      rainPositions[base + 4] = ry - 3.4;
      rainPositions[base + 5] = rz + 0.3;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: '#60a5fa',
      transparent: true,
      opacity: 0.45,
    });
    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.visible = false;

    const { cols, rows } = simulatorRef.current.getGridDimensions();
    const heatmapRgba = new Uint8Array(cols * rows * 4);
    const heatmapTexture = new THREE.DataTexture(heatmapRgba, cols, rows, THREE.RGBAFormat);
    heatmapTexture.colorSpace = THREE.SRGBColorSpace;
    heatmapTexture.magFilter = THREE.LinearFilter;
    heatmapTexture.minFilter = THREE.LinearFilter;
    heatmapTexture.wrapS = THREE.ClampToEdgeWrapping;
    heatmapTexture.wrapT = THREE.ClampToEdgeWrapping;
    heatmapTexture.generateMipmaps = false;
    heatmapTexture.flipY = false;
    heatmapTexture.needsUpdate = true;

    const heatmapMat = new THREE.MeshBasicMaterial({
      map: heatmapTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const heatmapGeo = new THREE.PlaneGeometry(1, 1);
    heatmapGeo.rotateX(-Math.PI / 2);
    const heatmapMesh = new THREE.Mesh(heatmapGeo, heatmapMat);
    heatmapMesh.position.y = 0.18;
    heatmapMesh.renderOrder = 4;

    const maxVisitors = 850;
    const maxMobility = 240;
    const maxCanes = 160;
    const maxPets = 220;

    const bodyGeo = new THREE.CylinderGeometry(0.32, 0.42, 1.35, 8);
    bodyGeo.translate(0, 0.68, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.65 });
    const visitorBodies = new THREE.InstancedMesh(bodyGeo, bodyMat, maxVisitors);
    visitorBodies.castShadow = !isSoftwareGl;
    visitorBodies.frustumCulled = false;

    const headGeo = new THREE.SphereGeometry(0.28, 8, 8);
    headGeo.translate(0, 1.58, 0);
    const headMat = new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.6 });
    const visitorHeads = new THREE.InstancedMesh(headGeo, headMat, maxVisitors);
    visitorHeads.frustumCulled = false;

    const vertexColorMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.52,
    });
    const petMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.72,
    });

    const staffGearMesh = new THREE.InstancedMesh(
      buildStaffGearGeometry(),
      vertexColorMat,
      maxVisitors,
    );
    staffGearMesh.castShadow = !isSoftwareGl;
    staffGearMesh.frustumCulled = false;
    staffGearMesh.count = 0;

    const wheelchairUsersMesh = new THREE.InstancedMesh(
      buildWheelchairAgentGeometry(),
      vertexColorMat,
      maxMobility,
    );
    wheelchairUsersMesh.castShadow = !isSoftwareGl;
    wheelchairUsersMesh.frustumCulled = false;
    wheelchairUsersMesh.count = 0;

    const scooterUsersMesh = new THREE.InstancedMesh(
      buildMobilityScooterAgentGeometry(),
      vertexColorMat,
      maxMobility,
    );
    scooterUsersMesh.castShadow = !isSoftwareGl;
    scooterUsersMesh.frustumCulled = false;
    scooterUsersMesh.count = 0;

    const strollerMesh = new THREE.InstancedMesh(
      buildStrollerDeviceGeometry(),
      vertexColorMat,
      maxMobility,
    );
    strollerMesh.castShadow = !isSoftwareGl;
    strollerMesh.frustumCulled = false;
    strollerMesh.count = 0;

    const whiteCaneMesh = new THREE.InstancedMesh(
      buildWhiteCaneGeometry(),
      vertexColorMat,
      maxCanes,
    );
    whiteCaneMesh.frustumCulled = false;
    whiteCaneMesh.count = 0;

    const companionPetsMesh = new THREE.InstancedMesh(
      buildCompanionDogGeometry(),
      petMat,
      maxPets,
    );
    companionPetsMesh.castShadow = !isSoftwareGl;
    companionPetsMesh.frustumCulled = false;
    companionPetsMesh.count = 0;

    const guideDogHarnessMesh = new THREE.InstancedMesh(
      buildGuideDogHarnessGeometry(),
      vertexColorMat,
      maxCanes,
    );
    guideDogHarnessMesh.frustumCulled = false;
    guideDogHarnessMesh.count = 0;

    const petLeashPositions = new Float32Array(maxPets * 6);
    const petLeashGeo = new THREE.BufferGeometry();
    const leashAttr = new THREE.BufferAttribute(petLeashPositions, 3);
    leashAttr.setUsage(THREE.DynamicDrawUsage);
    petLeashGeo.setAttribute('position', leashAttr);
    petLeashGeo.setDrawRange(0, 0);
    const petLeashMat = new THREE.LineBasicMaterial({
      color: '#0d9488',
      transparent: true,
      opacity: 0.85,
    });
    const petLeashes = new THREE.LineSegments(petLeashGeo, petLeashMat);
    petLeashes.frustumCulled = false;

    for (let i = 0; i < maxVisitors; i++) {
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      visitorBodies.setMatrixAt(i, _dummy.matrix);
      visitorHeads.setMatrixAt(i, _dummy.matrix);
      visitorBodies.setColorAt(i, _generalPalette[i % _generalPalette.length]);
    }
    for (let i = 0; i < maxPets; i++) {
      companionPetsMesh.setColorAt(i, _petCoatPalette[i % _petCoatPalette.length]);
    }

    scene.add(
      envRoot,
      pedestrianRoot,
      evacuationRoot,
      emergencyCorridorRoot,
      heatmapMesh,
      landscapingRoot,
      facilitiesRoot,
      ghostRoot,
      selectionRingGroup,
      visitorBodies,
      visitorHeads,
      staffGearMesh,
      wheelchairUsersMesh,
      scooterUsersMesh,
      strollerMesh,
      whiteCaneMesh,
      companionPetsMesh,
      guideDogHarnessMesh,
      petLeashes,
      rainLines,
    );

    const cameraTransition = {
      active: false,
      pos: initPose.pos.clone(),
      look: initPose.look.clone(),
    };

    controls.addEventListener('start', () => {
      cameraTransition.active = false;
    });

    sceneHandlesRef.current = {
      scene,
      camera,
      controls,
      renderer,
      sunLight,
      hemiLight,
      envRoot,
      facilitiesRoot,
      ghostRoot,
      facilityMap: new Map(),
      landscapingRoot,
      pedestrianRoot,
      evacuationRoot,
      selectionRingGroup,
      emergencyCorridorRoot,
      rainLines,
      rainPositions,
      heatmapMesh,
      heatmapTexture,
      heatmapRgba,
      visitorBodies,
      visitorHeads,
      staffGearMesh,
      wheelchairUsersMesh,
      scooterUsersMesh,
      strollerMesh,
      whiteCaneMesh,
      companionPetsMesh,
      guideDogHarnessMesh,
      petLeashes,
      petLeashPositions,
      cameraTransition,
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    };

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownX = 0;
    let pointerDownY = 0;
    let draggingFacilityId: string | null = null;
    let dragOffsetX = 0;
    let dragOffsetZ = 0;
    let lastDragEmit = 0;
    let lastHoverTime = 0;

    const raycastFacilityHit = (clientX: number, clientY: number): string | null => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(facilitiesRoot.children, true);
      const visibleHit = hits.find((h) => {
        let curObj: THREE.Object3D | null = h.object;
        while (curObj) {
          if (!curObj.visible && curObj !== h.object) return false;
          curObj = curObj.parent;
        }
        return Boolean(h.object.userData?.facilityId);
      });
      return visibleHit ? (visibleHit.object.userData.facilityId as string) : null;
    };

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownX = ev.clientX;
      pointerDownY = ev.clientY;
      draggingFacilityId = null;

      const hitId = raycastFacilityHit(ev.clientX, ev.clientY);
      if (!hitId) return;

      const cur = stateRef.current;
      const found = cur.facilities.find((f) => f.id === hitId);
      if (!found) return;

      cur.onSelectFacility(hitId);

      const isPrimaryPointer =
        ev.button === 0 || ev.pointerType === 'pen' || ev.pointerType === 'touch';
      if (!isPrimaryPointer) return;

      if (found.locked) {
        triggerLockedToast(cur.ui.lockedNotice);
        return;
      }

      if (raycaster.ray.intersectPlane(_floorPlane, _hitVec)) {
        draggingFacilityId = hitId;
        dragOffsetX = _hitVec.x - found.position.x;
        dragOffsetZ = _hitVec.z - found.position.z;
        controls.enabled = false;
        renderer.domElement.style.cursor = 'grabbing';
        try {
          renderer.domElement.setPointerCapture(ev.pointerId);
        } catch {
          // Ignore pointer capture restriction
        }
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (draggingFacilityId) {
        if (Math.hypot(ev.clientX - pointerDownX, ev.clientY - pointerDownY) < 4) return;
        const now = performance.now();
        if (now - lastDragEmit < 22) return;
        lastDragEmit = now;

        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.x = ((ev.clientX - bounds.left) / bounds.width) * 2 - 1;
        pointer.y = -((ev.clientY - bounds.top) / bounds.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        if (raycaster.ray.intersectPlane(_floorPlane, _hitVec)) {
          stateRef.current.onMoveFacility(
            draggingFacilityId,
            _hitVec.x - dragOffsetX,
            _hitVec.z - dragOffsetZ,
          );
        }
        return;
      }

      const now = performance.now();
      if (now - lastHoverTime < 55) return;
      lastHoverTime = now;

      const hitId = raycastFacilityHit(ev.clientX, ev.clientY);
      if (hitId) {
        const found = stateRef.current.facilities.find((f) => f.id === hitId);
        renderer.domElement.style.cursor = found?.locked ? 'pointer' : 'grab';
        setHoveredName(found ? getFacilityDisplayName(found, stateRef.current.language) : null);
      } else {
        renderer.domElement.style.cursor = 'default';
        setHoveredName(null);
      }
    };

    const finishPointerInteraction = (ev: PointerEvent) => {
      if (draggingFacilityId) {
        draggingFacilityId = null;
        controls.enabled = true;
        renderer.domElement.style.cursor = 'grab';
        try {
          renderer.domElement.releasePointerCapture(ev.pointerId);
        } catch {
          // Ignore
        }
        return;
      }

      if (Math.hypot(ev.clientX - pointerDownX, ev.clientY - pointerDownY) > 6) return;
      const hitId = raycastFacilityHit(ev.clientX, ev.clientY);
      if (hitId) {
        stateRef.current.onSelectFacility(hitId);
      } else {
        stateRef.current.onSelectFacility(null);
      }
    };

    const onWheel = (ev: WheelEvent) => {
      const cur = stateRef.current;
      if (!ev.altKey || !cur.selectedFacilityId) return;
      ev.preventDefault();
      const found = cur.facilities.find((f) => f.id === cur.selectedFacilityId);
      if (!found) return;
      if (found.locked) {
        triggerLockedToast(cur.ui.lockedNotice);
        return;
      }
      const delta = ev.deltaY < 0 ? 1 : -1;
      cur.onResizeFacility(found.id, delta, delta);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', finishPointerInteraction);
    renderer.domElement.addEventListener('pointercancel', finishPointerInteraction);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(200, entry.contentRect.width);
        const h = Math.max(200, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(mount);

    const onKeyDown = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (ev.target as HTMLElement | null)?.isContentEditable
      ) {
        return;
      }
      const k = ev.key.toLowerCase();
      const isMoveKey =
        k === 'w' ||
        k === 'a' ||
        k === 's' ||
        k === 'd' ||
        k === 'arrowup' ||
        k === 'arrowdown' ||
        k === 'arrowleft' ||
        k === 'arrowright';
      if (!isMoveKey) return;

      const cur = stateRef.current;
      // In Laptop Mode, when a booth is selected, WASD / Arrow keys nudge the booth directly!
      if (cur.deviceMode === 'laptop' && cur.selectedFacilityId) {
        ev.preventDefault();
        const found = cur.facilities.find((f) => f.id === cur.selectedFacilityId);
        if (!found) return;
        if (found.locked) {
          triggerLockedToast(cur.ui.lockedNotice);
          return;
        }
        const step = ev.shiftKey ? 3 : 1;
        let dx = 0;
        let dz = 0;
        if (k === 'w' || k === 'arrowup') dz = -step;
        if (k === 's' || k === 'arrowdown') dz = step;
        if (k === 'a' || k === 'arrowleft') dx = -step;
        if (k === 'd' || k === 'arrowright') dx = step;
        cur.onNudgeFacility(found.id, dx, dz);
        return;
      }

      pressedKeysRef.current.add(k);
      cameraTransition.active = false;
    };

    const onKeyUp = (ev: KeyboardEvent) => {
      pressedKeysRef.current.delete(ev.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let frameId = 0;
    let lastTime = performance.now();
    let lastHeatmapUpload = 0;
    let lastMetricsEmit = 0;
    const _fwd = new THREE.Vector3();
    const _right = new THREE.Vector3();
    const _panStep = new THREE.Vector3();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (st === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      const now = performance.now();
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;

      const cur = stateRef.current;
      const sim = simulatorRef.current;

      const keys = pressedKeysRef.current;
      if (keys.size > 0 && !cur.selectedFacilityId) {
        camera.getWorldDirection(_fwd);
        _fwd.y = 0;
        if (_fwd.lengthSq() < 0.0001) _fwd.set(0, 0, -1);
        _fwd.normalize();
        _right.set(-_fwd.z, 0, _fwd.x);

        let moveF = 0;
        let moveR = 0;
        if (keys.has('w') || keys.has('arrowup')) moveF += 1;
        if (keys.has('s') || keys.has('arrowdown')) moveF -= 1;
        if (keys.has('d') || keys.has('arrowright')) moveR += 1;
        if (keys.has('a') || keys.has('arrowleft')) moveR -= 1;

        if (moveF !== 0 || moveR !== 0) {
          const camDist = Math.max(40, camera.position.distanceTo(controls.target));
          const panSpeedMeters = camDist * 0.65 * dt;
          _panStep
            .set(0, 0, 0)
            .addScaledVector(_fwd, moveF)
            .addScaledVector(_right, moveR)
            .normalize()
            .multiplyScalar(panSpeedMeters);
          camera.position.add(_panStep);
          controls.target.add(_panStep);
        }
      }

      if (cameraTransition.active) {
        const alpha = 1 - Math.exp(-6.5 * dt);
        camera.position.lerp(cameraTransition.pos, alpha);
        controls.target.lerp(cameraTransition.look, alpha);
        if (
          camera.position.distanceToSquared(cameraTransition.pos) < 0.25 &&
          controls.target.distanceToSquared(cameraTransition.look) < 0.25
        ) {
          camera.position.copy(cameraTransition.pos);
          controls.target.copy(cameraTransition.look);
          cameraTransition.active = false;
        }
      }

      // Clamp camera target cleanly inside indoor bounds
      const boundX = cur.config.venueWidth * 0.65;
      const boundZ = cur.config.venueDepth * 0.65;
      if (Math.abs(controls.target.x) > boundX) {
        const clampedX = Math.max(-boundX, Math.min(boundX, controls.target.x));
        camera.position.x += clampedX - controls.target.x;
        controls.target.x = clampedX;
      }
      if (Math.abs(controls.target.z) > boundZ) {
        const clampedZ = Math.max(-boundZ, Math.min(boundZ, controls.target.z));
        camera.position.z += clampedZ - controls.target.z;
        controls.target.z = clampedZ;
      }
      controls.target.y = Math.max(-1, Math.min(16, controls.target.y));

      controls.update();

      if (rainLines.visible) {
        const fallDist = 50 * dt;
        for (let i = 0; i < rainDropCount; i++) {
          const base = i * 6;
          rainPositions[base + 1] -= fallDist;
          rainPositions[base + 4] -= fallDist;
          if (rainPositions[base + 4] < 0) {
            const resetY = 62 + (i % 12);
            rainPositions[base + 1] = resetY;
            rainPositions[base + 4] = resetY - 3.4;
          }
        }
        (rainLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }

      sim.step(dt, cur.simSpeed, cur.isPlaying);
      const agents = sim.agents;
      const showCrowd = cur.visibility.crowd;

      let staffIdx = 0;
      let wcIdx = 0;
      let scIdx = 0;
      let stIdx = 0;
      let caneIdx = 0;
      let petIdx = 0;
      let harnessIdx = 0;

      for (let i = 0; i < maxVisitors; i++) {
        if (showCrowd && i < agents.length && agents[i].active) {
          const ag = agents[i];
          const baseY = ag.y || 0;
          const cheerYaw =
            cur.isPlaying && ag.isWatchingStage ? Math.sin(now * 0.0042 + i * 0.9) * 0.07 : 0;

          if (ag.role === 'wheelchair_user' && wcIdx < maxMobility) {
            _dummy.position.set(0, -50, 0);
            _dummy.scale.setScalar(0.0001);
            _dummy.updateMatrix();
            visitorBodies.setMatrixAt(i, _dummy.matrix);
            visitorHeads.setMatrixAt(i, _dummy.matrix);

            _auxDummy.position.set(ag.x, baseY, ag.z);
            _auxDummy.rotation.set(0, ag.heading + cheerYaw, 0);
            _auxDummy.scale.setScalar(1.12);
            _auxDummy.updateMatrix();
            wheelchairUsersMesh.setMatrixAt(wcIdx++, _auxDummy.matrix);
          } else if (ag.role === 'scooter_user' && scIdx < maxMobility) {
            _dummy.position.set(0, -50, 0);
            _dummy.scale.setScalar(0.0001);
            _dummy.updateMatrix();
            visitorBodies.setMatrixAt(i, _dummy.matrix);
            visitorHeads.setMatrixAt(i, _dummy.matrix);

            _auxDummy.position.set(ag.x, baseY, ag.z);
            _auxDummy.rotation.set(0, ag.heading + cheerYaw, 0);
            _auxDummy.scale.setScalar(1.12);
            _auxDummy.updateMatrix();
            scooterUsersMesh.setMatrixAt(scIdx++, _auxDummy.matrix);
          } else if (ag.isSeated) {
            const cheerBob = cur.isPlaying ? Math.abs(Math.sin(now * 0.0055 + i * 1.3)) * 0.045 : 0;
            _dummy.position.set(ag.x, baseY - 0.16 + cheerBob, ag.z);
            _dummy.rotation.set(0, ag.heading + cheerYaw, 0);
            _dummy.scale.set(0.96, 0.72, 0.96);
            _dummy.updateMatrix();
            visitorBodies.setMatrixAt(i, _dummy.matrix);

            _headDummy.position.set(ag.x, baseY - 0.58 + cheerBob, ag.z);
            _headDummy.rotation.set(0, 0, 0);
            _headDummy.scale.setScalar(1);
            _headDummy.updateMatrix();
            visitorHeads.setMatrixAt(i, _headDummy.matrix);

            if (ag.role === 'visually_impaired') {
              visitorBodies.setColorAt(i, _visuallyImpairedColor);
              if (caneIdx < maxCanes) {
                _auxDummy.position.set(ag.x, baseY - 0.12, ag.z);
                _auxDummy.rotation.set(0, ag.heading, 0);
                _auxDummy.scale.setScalar(0.92);
                _auxDummy.updateMatrix();
                whiteCaneMesh.setMatrixAt(caneIdx++, _auxDummy.matrix);
              }
            } else if (ag.role === 'stroller_family') {
              visitorBodies.setColorAt(i, _strollerGuardianColor);
            } else if (ag.role === 'pet_owner') {
              visitorBodies.setColorAt(i, _petOwnerColor);
            } else {
              visitorBodies.setColorAt(i, _generalPalette[ag.colorIndex % _generalPalette.length]);
            }
          } else {
            const bob = cur.isPlaying
              ? ag.isWatchingStage
                ? Math.abs(Math.sin(now * 0.006 + i * 1.1)) * 0.06
                : Math.abs(Math.sin(now * 0.0068 + i)) * 0.09
              : 0;
            _dummy.position.set(ag.x, baseY + bob, ag.z);
            _dummy.rotation.set(0, ag.heading + cheerYaw, 0);
            _dummy.scale.setScalar(1);
            _dummy.updateMatrix();
            visitorBodies.setMatrixAt(i, _dummy.matrix);

            _headDummy.position.set(ag.x, baseY + bob, ag.z);
            _headDummy.rotation.set(0, 0, 0);
            _headDummy.scale.setScalar(1);
            _headDummy.updateMatrix();
            visitorHeads.setMatrixAt(i, _headDummy.matrix);

            if (ag.role === 'staff') {
              visitorBodies.setColorAt(i, _staffTrouserColor);
              const wandWave = cur.isPlaying ? Math.sin(now * 0.008 + i) * 0.1 : 0;
              _auxDummy.position.set(ag.x, baseY + bob, ag.z);
              _auxDummy.rotation.set(0, ag.heading + wandWave, 0);
              _auxDummy.scale.setScalar(1.04);
              _auxDummy.updateMatrix();
              staffGearMesh.setMatrixAt(staffIdx++, _auxDummy.matrix);
            } else if (ag.role === 'stroller_family') {
              visitorBodies.setColorAt(i, _strollerGuardianColor);
              if (stIdx < maxMobility) {
                _auxDummy.position.set(ag.x, baseY, ag.z);
                _auxDummy.rotation.set(0, ag.heading + cheerYaw, 0);
                _auxDummy.scale.setScalar(1.08);
                _auxDummy.updateMatrix();
                strollerMesh.setMatrixAt(stIdx++, _auxDummy.matrix);
              }
            } else if (ag.role === 'visually_impaired') {
              visitorBodies.setColorAt(i, _visuallyImpairedColor);
              if (caneIdx < maxCanes) {
                const caneSweep = cur.isPlaying ? Math.sin(now * 0.006 + i) * 0.2 : 0;
                _auxDummy.position.set(ag.x, baseY + bob * 0.3, ag.z);
                _auxDummy.rotation.set(0, ag.heading + caneSweep, 0);
                _auxDummy.scale.setScalar(1.06);
                _auxDummy.updateMatrix();
                whiteCaneMesh.setMatrixAt(caneIdx++, _auxDummy.matrix);
              }
            } else if (ag.role === 'pet_owner') {
              visitorBodies.setColorAt(i, _petOwnerColor);
            } else {
              visitorBodies.setColorAt(i, _generalPalette[ag.colorIndex % _generalPalette.length]);
            }
          }

          if (ag.hasCompanionPet && petIdx < maxPets) {
            const sideSign = ag.petOffsetSide || 1;
            const fwdX = Math.sin(ag.heading);
            const fwdZ = Math.cos(ag.heading);
            const rightX = Math.cos(ag.heading) * sideSign;
            const rightZ = -Math.sin(ag.heading) * sideSign;

            const dogX = ag.x + rightX * (ag.isSeated ? 0.62 : 0.88) + fwdX * 0.38;
            const dogZ = ag.z + rightZ * (ag.isSeated ? 0.62 : 0.88) + fwdZ * 0.38;
            const dogBaseY = ag.isSeated ? Math.max(0.4, baseY - 0.35) : baseY;
            const dogBob =
              cur.isPlaying && !ag.isSeated ? Math.abs(Math.sin(now * 0.014 + i * 1.7)) * 0.06 : 0;

            _auxDummy.position.set(dogX, dogBaseY + dogBob, dogZ);
            _auxDummy.rotation.set(0, ag.heading, 0);
            _auxDummy.scale.setScalar(1.22);
            _auxDummy.updateMatrix();
            companionPetsMesh.setMatrixAt(petIdx, _auxDummy.matrix);
            companionPetsMesh.setColorAt(
              petIdx,
              ag.role === 'visually_impaired'
                ? _guideDogCoatColor
                : _petCoatPalette[ag.petCoatIndex % _petCoatPalette.length],
            );

            if (ag.role === 'visually_impaired' && harnessIdx < maxCanes) {
              guideDogHarnessMesh.setMatrixAt(harnessIdx++, _auxDummy.matrix);
            }

            const base = petIdx * 6;
            petLeashPositions[base] = ag.x + rightX * 0.32;
            petLeashPositions[base + 1] = ag.isSeated ? baseY + 0.48 : baseY + 0.96;
            petLeashPositions[base + 2] = ag.z + rightZ * 0.32;
            petLeashPositions[base + 3] = dogX;
            petLeashPositions[base + 4] = dogBaseY + 0.62 + dogBob;
            petLeashPositions[base + 5] = dogZ + fwdZ * 0.22;

            petIdx++;
          }
        } else {
          _dummy.position.set(0, -50, 0);
          _dummy.scale.setScalar(0.0001);
          _dummy.updateMatrix();
          visitorBodies.setMatrixAt(i, _dummy.matrix);
          visitorHeads.setMatrixAt(i, _dummy.matrix);
        }
      }

      staffGearMesh.count = staffIdx;
      wheelchairUsersMesh.count = wcIdx;
      scooterUsersMesh.count = scIdx;
      strollerMesh.count = stIdx;
      whiteCaneMesh.count = caneIdx;
      companionPetsMesh.count = petIdx;
      guideDogHarnessMesh.count = harnessIdx;
      petLeashes.geometry.setDrawRange(0, petIdx * 2);

      visitorBodies.instanceMatrix.needsUpdate = true;
      visitorHeads.instanceMatrix.needsUpdate = true;
      if (visitorBodies.instanceColor) visitorBodies.instanceColor.needsUpdate = true;
      if (staffIdx > 0) staffGearMesh.instanceMatrix.needsUpdate = true;
      if (wcIdx > 0) wheelchairUsersMesh.instanceMatrix.needsUpdate = true;
      if (scIdx > 0) scooterUsersMesh.instanceMatrix.needsUpdate = true;
      if (stIdx > 0) strollerMesh.instanceMatrix.needsUpdate = true;
      if (caneIdx > 0) whiteCaneMesh.instanceMatrix.needsUpdate = true;
      if (petIdx > 0) {
        companionPetsMesh.instanceMatrix.needsUpdate = true;
        if (companionPetsMesh.instanceColor) companionPetsMesh.instanceColor.needsUpdate = true;
        (petLeashes.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
      if (harnessIdx > 0) guideDogHarnessMesh.instanceMatrix.needsUpdate = true;

      if (now - lastHeatmapUpload > (cur.isPlaying ? 90 : 280)) {
        lastHeatmapUpload = now;
        const snap = sim.getSnapshot();
        const { cols: gc, rows: gr } = sim.getGridDimensions();
        writeHeatmapTextureData(snap.densityGrid, heatmapRgba, gc, gr);
        heatmapTexture.needsUpdate = true;
        if (cur.isPlaying && now - lastMetricsEmit > 180) {
          lastMetricsEmit = now;
          cur.onSnapshotUpdate(snap);
        }
      }

      if (selectionRingGroup.visible) {
        selBeacon.position.y = 13.5 + Math.sin(now * 0.004) * 0.65;
      }

      if (cur.visibility.labels) {
        const cw = renderer.domElement.clientWidth;
        const ch = renderer.domElement.clientHeight;
        for (let i = 0; i < cur.facilities.length; i++) {
          const f = cur.facilities[i];
          const el = labelRefs.current[f.id];
          if (!el) continue;

          const catVisible = cur.visibility[f.category as keyof LayerVisibility];
          if (!catVisible) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            continue;
          }

          _projVec.set(f.position.x, f.dimensions.height + 2.4, f.position.z);
          _projVec.project(camera);

          if (_projVec.z > 1 || _projVec.z < -1) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
          } else {
            const sx = (_projVec.x * 0.5 + 0.5) * cw;
            const sy = (-_projVec.y * 0.5 + 0.5) * ch;
            el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) translate(-50%, -100%)`;
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
          }
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', finishPointerInteraction);
      renderer.domElement.removeEventListener('pointercancel', finishPointerInteraction);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      renderer.dispose();
    };
  }, [simulatorRef]);

  // Rebuild Indoor Ground, Cutaway Perimeter Walls, Facilities & Routes
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    disposeGroupChildren(handles.envRoot);
    disposeGroupChildren(handles.facilitiesRoot);
    disposeGroupChildren(handles.landscapingRoot);
    disposeGroupChildren(handles.pedestrianRoot);
    disposeGroupChildren(handles.evacuationRoot);
    disposeGroupChildren(handles.emergencyCorridorRoot);
    handles.facilityMap.clear();

    const routes = buildVenueRoutes(config, facilities);
    handles.envRoot.add(buildVenueGroundAndPerimeter(config, facilities, handles.maxAnisotropy));
    handles.landscapingRoot.add(buildLandscapingTrees(config, facilities, routes));

    const { pedestrianGroup, evacuationGroup, emergencyAmbulanceGroup } = buildRouteLayers(
      routes,
      config,
    );
    handles.pedestrianRoot.add(pedestrianGroup);
    handles.evacuationRoot.add(evacuationGroup);
    handles.emergencyCorridorRoot.add(emergencyAmbulanceGroup);

    for (const f of facilities) {
      const fGroup = buildFacilityGroup(f, config, handles.maxAnisotropy);
      fGroup.visible = Boolean(visibility[f.category as keyof LayerVisibility]);
      handles.facilitiesRoot.add(fGroup);
      handles.facilityMap.set(f.id, fGroup);
    }

    // When Dispersed Alternative Layout ('optimized') is active in 3D, draw unmistakable relocation pads & movement lines!
    if (activeLayoutBadge === 'optimized' && baselineFacilities && baselineFacilities.length > 0) {
      const vectorCoords: number[] = [];
      for (const f of facilities) {
        const orig = baselineFacilities.find((o) => o.id === f.id);
        if (!orig) continue;
        const movedDist = Math.hypot(f.position.x - orig.position.x, f.position.z - orig.position.z);
        const areaChanged =
          Math.abs(
            f.dimensions.width * f.dimensions.depth -
              orig.dimensions.width * orig.dimensions.depth,
          ) > 1.2;
        if (movedDist > 1.5 || areaChanged) {
          const padW = f.dimensions.width + 1.8;
          const padD = f.dimensions.depth + 1.8;
          const padGeo = new THREE.PlaneGeometry(padW, padD);
          padGeo.rotateX(-Math.PI / 2);
          const padMat = new THREE.MeshBasicMaterial({
            color: '#10b981',
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
          });
          const padMesh = new THREE.Mesh(padGeo, padMat);
          padMesh.position.set(f.position.x, 0.12, f.position.z);
          handles.pedestrianRoot.add(padMesh);

          const borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(padW, 0.08, padD));
          const borderLine = new THREE.LineSegments(
            borderGeo,
            new THREE.LineBasicMaterial({ color: '#059669' }),
          );
          borderLine.position.set(f.position.x, 0.16, f.position.z);
          handles.pedestrianRoot.add(borderLine);

          if (movedDist > 2.0) {
            vectorCoords.push(
              orig.position.x,
              0.32,
              orig.position.z,
              f.position.x,
              0.32,
              f.position.z,
            );
            const originMarker = new THREE.Mesh(
              new THREE.RingGeometry(0.6, 1.05, 16),
              new THREE.MeshBasicMaterial({
                color: '#64748b',
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.65,
              }),
            );
            originMarker.rotation.x = -Math.PI / 2;
            originMarker.position.set(orig.position.x, 0.14, orig.position.z);
            handles.pedestrianRoot.add(originMarker);
          }
        }
      }
      if (vectorCoords.length > 0) {
        const vecGeo = new THREE.BufferGeometry();
        vecGeo.setAttribute('position', new THREE.Float32BufferAttribute(vectorCoords, 3));
        const vecLines = new THREE.LineSegments(
          vecGeo,
          new THREE.LineBasicMaterial({ color: '#059669', transparent: true, opacity: 0.85 }),
        );
        handles.pedestrianRoot.add(vecLines);
      }
    }

    handles.heatmapMesh.scale.set(config.venueWidth, 1, config.venueDepth);

    const snap = simulatorRef.current.getSnapshot();
    const { cols, rows } = simulatorRef.current.getGridDimensions();
    writeHeatmapTextureData(snap.densityGrid, handles.heatmapRgba, cols, rows);
    handles.heatmapTexture.needsUpdate = true;
  }, [config, facilities, activeLayoutBadge, baselineFacilities, simulatorRef]);

  // Reset overlay toggle to Clean New-Blueprint Solo View whenever a new preview starts
  useEffect(() => {
    if (ghostPreview) {
      setPreviewOverlayExisting(ghostPreview.mode === 'element');
    }
  }, [ghostPreview?.title, ghostPreview?.mode]);

  // High-Quality New-Blueprint 3D Preview: renders full PBR models on a clean blank New floor by default!
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    disposeGroupChildren(handles.ghostRoot);

    if (!ghostPreview || ghostPreview.facilities.length === 0) {
      handles.facilitiesRoot.visible = true;
      handles.envRoot.visible = true;
      handles.pedestrianRoot.visible = visibility.pedestrianRoutes;
      handles.landscapingRoot.visible = visibility.landscaping;
      return;
    }

    const previewCfg = ghostPreview.configOverride || config;
    const isCleanNewFloor = !previewOverlayExisting;

    if (isCleanNewFloor) {
      // Hide old layout completely so the New Blueprint stands out in crisp studio 3D!
      handles.facilitiesRoot.visible = false;
      handles.envRoot.visible = false;
      handles.pedestrianRoot.visible = false;
      handles.landscapingRoot.visible = false;
      handles.heatmapMesh.visible = false;

      const previewRoutes = buildVenueRoutes(previewCfg, ghostPreview.facilities);
      handles.ghostRoot.add(
        buildVenueGroundAndPerimeter(previewCfg, ghostPreview.facilities, handles.maxAnisotropy),
      );
      const { pedestrianGroup } = buildRouteLayers(previewRoutes, previewCfg);
      handles.ghostRoot.add(pedestrianGroup);
      handles.ghostRoot.add(buildLandscapingTrees(previewCfg, ghostPreview.facilities, previewRoutes));

      for (const gf of ghostPreview.facilities) {
        const grp = buildFacilityGroup(gf, previewCfg, handles.maxAnisotropy);
        grp.traverse((obj) => {
          obj.layers.set(0);
        });
        handles.ghostRoot.add(grp);
      }

      // Frame camera cleanly onto the New Blueprint
      const pose = getPresetCameraPose('isometric', previewCfg.venueWidth, previewCfg.venueDepth);
      handles.cameraTransition.pos.copy(pose.pos);
      handles.cameraTransition.look.copy(pose.look);
      handles.cameraTransition.active = true;
    } else {
      // Optional Overlay Comparison Mode: show existing floor + full PBR previewed item(s) with sky-blue accent base ring
      handles.facilitiesRoot.visible = true;
      handles.envRoot.visible = true;
      handles.pedestrianRoot.visible = visibility.pedestrianRoutes;
      handles.landscapingRoot.visible = visibility.landscaping;

      for (const gf of ghostPreview.facilities) {
        const grp = buildFacilityGroup(gf, previewCfg, handles.maxAnisotropy);
        grp.traverse((obj) => {
          obj.layers.set(0);
        });
        const ringRadius = Math.max(gf.dimensions.width, gf.dimensions.depth) * 0.64 + 1.2;
        const accentRing = new THREE.Mesh(
          new THREE.RingGeometry(ringRadius - 0.45, ringRadius, 32),
          new THREE.MeshBasicMaterial({
            color: '#0284c7',
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
          }),
        );
        accentRing.rotation.x = -Math.PI / 2;
        accentRing.position.set(gf.position.x, 0.22, gf.position.z);
        handles.ghostRoot.add(accentRing);
        handles.ghostRoot.add(grp);
      }
    }
  }, [ghostPreview, config, previewOverlayExisting, visibility.pedestrianRoutes, visibility.landscaping]);

  // Smoothly re-frame 3D camera when indoor venue footprint or stage placement changes
  const prevStructureKeyRef = useRef<string>(
    `${config.venueWidth}x${config.venueDepth}:${config.venueShape ?? 'rectangle'}:${config.stagePlacement ?? 'north_end'}`,
  );
  useEffect(() => {
    const nextKey = `${config.venueWidth}x${config.venueDepth}:${config.venueShape ?? 'rectangle'}:${config.stagePlacement ?? 'north_end'}`;
    if (prevStructureKeyRef.current === nextKey) return;
    prevStructureKeyRef.current = nextKey;

    const handles = sceneHandlesRef.current;
    if (!handles) return;
    const pose = getPresetCameraPose('isometric', config.venueWidth, config.venueDepth);
    setCameraMode('isometric');
    handles.cameraTransition.pos.copy(pose.pos);
    handles.cameraTransition.look.copy(pose.look);
    handles.cameraTransition.active = true;
  }, [config.venueWidth, config.venueDepth, config.venueShape, config.stagePlacement]);

  // Sync Contingency Atmosphere
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    if (contingency === 'rain') {
      handles.scene.background = new THREE.Color('#dfe6ef');
      handles.scene.fog = new THREE.Fog('#dfe6ef', 200, 480);
      handles.sunLight.intensity = 1.1;
      handles.hemiLight.intensity = 0.95;
      handles.rainLines.visible = true;
    } else if ((config.venueEnvironment ?? 'indoor') === 'outdoor') {
      handles.scene.background = new THREE.Color('#e6eff8');
      handles.scene.fog = new THREE.Fog('#e6eff8', 260, 620);
      handles.sunLight.intensity = 1.72;
      handles.hemiLight.intensity = 0.98;
      handles.rainLines.visible = false;
    } else {
      handles.scene.background = new THREE.Color('#eef2f6');
      handles.scene.fog = new THREE.Fog('#eef2f6', 240, 560);
      handles.sunLight.intensity = 1.6;
      handles.hemiLight.intensity = 0.92;
      handles.rainLines.visible = false;
    }

    handles.emergencyCorridorRoot.visible = contingency === 'medical_emergency';
    handles.evacuationRoot.visible =
      contingency === 'medical_emergency' ? true : visibility.evacuationRoutes;
  }, [contingency, config.venueEnvironment, visibility.evacuationRoutes]);

  // Refresh heatmap texture when simProgress scrubs manually
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;
    const snap = simulatorRef.current.getSnapshot();
    const { cols, rows } = simulatorRef.current.getGridDimensions();
    writeHeatmapTextureData(snap.densityGrid, handles.heatmapRgba, cols, rows);
    handles.heatmapTexture.needsUpdate = true;
  }, [simProgress, simulatorRef]);

  // Sync Layer Visibility
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    for (const f of facilities) {
      const grp = handles.facilityMap.get(f.id);
      if (grp) {
        grp.visible = Boolean(visibility[f.category as keyof LayerVisibility]);
      }
    }

    handles.landscapingRoot.visible = visibility.landscaping;
    handles.heatmapMesh.visible = visibility.heatmap;
    handles.pedestrianRoot.visible = visibility.pedestrianRoutes;
    handles.evacuationRoot.visible =
      contingency === 'medical_emergency' ? true : visibility.evacuationRoutes;
    handles.visitorBodies.visible = visibility.crowd;
    handles.visitorHeads.visible = visibility.crowd;
    handles.staffGearMesh.visible = visibility.crowd;
    handles.wheelchairUsersMesh.visible = visibility.crowd;
    handles.scooterUsersMesh.visible = visibility.crowd;
    handles.strollerMesh.visible = visibility.crowd;
    handles.whiteCaneMesh.visible = visibility.crowd;
    handles.companionPetsMesh.visible = visibility.crowd;
    handles.guideDogHarnessMesh.visible = visibility.crowd;
    handles.petLeashes.visible = visibility.crowd;
  }, [visibility, facilities, contingency]);

  // Sync Selected Booth Ring & Highlighted Facilities
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    handles.facilitiesRoot.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive && !mat.emissiveMap) {
          mat.emissive.setHex(0x000000);
        }
      }
    });

    for (const hId of highlightedFacilityIds) {
      const grp = handles.facilityMap.get(hId);
      if (grp) {
        grp.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (mat && mat.emissive && !mat.emissiveMap) {
              mat.emissive.setHex(0x047857);
              mat.emissiveIntensity = 0.28;
            }
          }
        });
      }
    }

    if (!selectedFacilityId) {
      handles.selectionRingGroup.visible = false;
      return;
    }

    const sel = facilities.find((f) => f.id === selectedFacilityId);
    const selGrp = handles.facilityMap.get(selectedFacilityId);
    if (!sel || !selGrp) {
      handles.selectionRingGroup.visible = false;
      return;
    }

    const span = Math.max(sel.dimensions.width, sel.dimensions.depth) + 4.2;
    handles.selectionRingGroup.position.set(sel.position.x, 0, sel.position.z);
    handles.selectionRingGroup.children[0].scale.set(span, span, 1);
    handles.selectionRingGroup.visible = true;

    selGrp.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive && !mat.emissiveMap) {
          mat.emissive.setHex(sel.locked ? 0xb45309 : 0x1e3a8a);
          mat.emissiveIntensity = 0.24;
        }
      }
    });
  }, [selectedFacilityId, highlightedFacilityIds, facilities]);

  const applyCameraPreset = (mode: CameraViewMode) => {
    setCameraMode(mode);
    const handles = sceneHandlesRef.current;
    if (!handles) return;
    const pose = getPresetCameraPose(mode, config.venueWidth, config.venueDepth);
    handles.cameraTransition.pos.copy(pose.pos);
    handles.cameraTransition.look.copy(pose.look);
    handles.cameraTransition.active = true;
  };

  const toggleDragMode = (nextMode: 'rotate' | 'pan') => {
    setDragMode(nextMode);
    const handles = sceneHandlesRef.current;
    if (!handles) return;
    if (nextMode === 'pan') {
      handles.controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
    } else {
      handles.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    }
  };

  const handlePanByButtons = (stepForward: number, stepRight: number) => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;
    const fwd = new THREE.Vector3();
    handles.camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 0.0001) fwd.set(0, 0, -1);
    fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const dist = Math.max(40, handles.camera.position.distanceTo(handles.controls.target));
    const stepLen = dist * 0.22;
    const delta = new THREE.Vector3()
      .addScaledVector(fwd, stepForward * stepLen)
      .addScaledVector(right, stepRight * stepLen);

    const targetLook = handles.controls.target.clone().add(delta);
    const boundX = config.venueWidth * 0.9;
    const boundZ = config.venueDepth * 0.9;
    targetLook.x = Math.max(-boundX, Math.min(boundX, targetLook.x));
    targetLook.z = Math.max(-boundZ, Math.min(boundZ, targetLook.z));
    const clampedDelta = targetLook.clone().sub(handles.controls.target);

    handles.cameraTransition.look.copy(targetLook);
    handles.cameraTransition.pos.copy(handles.camera.position).add(clampedDelta);
    handles.cameraTransition.active = true;
  };

  const handleZoom = (factor: number) => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;
    _targetPos.copy(handles.camera.position).sub(handles.controls.target).multiplyScalar(factor);
    const len = _targetPos.length();
    if (len >= 24 && len <= 440) {
      handles.cameraTransition.pos.copy(handles.controls.target).add(_targetPos);
      handles.cameraTransition.look.copy(handles.controls.target);
      handles.cameraTransition.active = true;
    }
  };

  const handleToggleFullscreen = () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const highlightSet = new Set(highlightedFacilityIds);

  // Show labels on user-named/locked booths + key indoor facilities without clutter
  const labeledFacilities = facilities.filter((f, idx) => {
    if (f.id === selectedFacilityId || highlightSet.has(f.id) || f.locked || f.customDisplayName) {
      return true;
    }
    if (
      f.category === 'stage' ||
      f.category === 'medical' ||
      f.category === 'entrance' ||
      f.category === 'parking' ||
      f.subtype === 'photo_zone' ||
      f.category === 'rest' ||
      f.category === 'restroom' ||
      f.category === 'vip'
    ) {
      return true;
    }
    if (f.category === 'seating' && idx === 1) return true;
    if (f.category === 'food' && idx % 2 === 0) return true;
    if (f.category === 'booth' && idx % 2 === 0) return true;
    return false;
  });

  const primaryExteriorParking = facilities.find((f) => f.category === 'parking') || null;
  const focusExteriorParking = () => {
    if (!primaryExteriorParking) return;
    const handles = sceneHandlesRef.current;
    if (!handles) return;
    onSelectFacility(primaryExteriorParking.id);
    const px = primaryExteriorParking.position.x;
    const pz = primaryExteriorParking.position.z;
    handles.cameraTransition.look.set(px * 0.82, 0, pz);
    handles.cameraTransition.pos.set(px + (px >= 0 ? 46 : -46), 54, pz + 52);
    handles.cameraTransition.active = true;
  };

  const relocatedFacilityCount =
    activeLayoutBadge === 'optimized' && baselineFacilities
      ? facilities.filter((f) => {
          const orig = baselineFacilities.find((o) => o.id === f.id);
          if (!orig) return false;
          return (
            Math.hypot(f.position.x - orig.position.x, f.position.z - orig.position.z) > 1.5 ||
            Math.abs(
              f.dimensions.width * f.dimensions.depth -
                orig.dimensions.width * orig.dimensions.depth,
            ) > 1.2
          );
        }).length
      : 0;

  const quickLayerButtons: Array<{
    key: keyof LayerVisibility;
    label: string;
    dotColor: string;
  }> = [
    {
      key: 'heatmap',
      label: tr6(language, '밀도 히트맵', 'Heatmap', '密度マップ', '密度热力图', 'Mapa calor', 'Carte densité'),
      dotColor: 'bg-red-500',
    },
    {
      key: 'crowd',
      label: tr6(language, '방문객', 'Visitors', '来場者', '访客', 'Visitantes', 'Visiteurs'),
      dotColor: 'bg-teal-600',
    },
    {
      key: 'pedestrianRoutes',
      label: tr6(language, '동선·퇴장로', 'Routes', '動線・退場路', '动线与退场道', 'Rutas', 'Parcours'),
      dotColor: 'bg-emerald-600',
    },
  ];

  const categoryColorDot = (cat: FacilityCategory) => {
    switch (cat) {
      case 'stage':
        return 'bg-blue-500';
      case 'food':
        return 'bg-orange-500';
      case 'medical':
        return 'bg-red-500';
      case 'vip':
        return 'bg-purple-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full overflow-hidden bg-[#eef2f6] select-none"
    >
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Projected 3D Booth Callout Labels (hidden during clean solo New-Blueprint preview to avoid old-label ghosting) */}
      {visibility.labels && !(ghostPreview && !previewOverlayExisting) && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
          {labeledFacilities.map((f) => {
            const isSel = f.id === selectedFacilityId;
            const isPersonaHighlighted = highlightSet.has(f.id);
            return (
              <button
                key={f.id}
                ref={(el) => {
                  labelRefs.current[f.id] = el;
                }}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectFacility(f.id);
                }}
                style={{ opacity: 0 }}
                className={`absolute left-0 top-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-tight whitespace-nowrap shadow-sm transition-colors cursor-pointer ${
                  isSel
                    ? 'bg-blue-600 text-white ring-2 ring-white'
                    : f.locked
                      ? 'bg-amber-700 text-white ring-1 ring-amber-200'
                      : isPersonaHighlighted
                        ? 'bg-emerald-700 text-white ring-2 ring-white'
                        : 'bg-slate-900 text-white hover:bg-blue-600'
                }`}
              >
                {f.locked ? (
                  <Lock className="w-3 h-3 text-amber-200 shrink-0" />
                ) : (
                  <span className={`w-1.5 h-1.5 rounded-full ${categoryColorDot(f.category)}`} />
                )}
                <span>{getFacilityDisplayName(f, language)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* High-Quality New-Blueprint 3D Studio Preview Bar */}
      {ghostPreview && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white border border-sky-400 rounded-xl px-4 py-2.5 shadow-xl flex flex-wrap items-center gap-3 max-w-[94%]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Eye className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-tight text-sky-300">
                  {!previewOverlayExisting
                    ? tr6(
                        language,
                        '새 도안(NEW) 단독 3D 미리보기',
                        'NEW Blueprint Solo 3D Preview',
                        '新規図面（NEW）単独3Dプレビュー',
                        '新方案（NEW）独立3D预览',
                        'Vista 3D independiente en plano NUEVO',
                        'Aperçu 3D dédié sur NOUVEAU plan',
                      )
                    : tr6(
                        language,
                        '기존 도안과 함께 보기',
                        'Overlay with Current Plan',
                        '既存図面と重ねて表示',
                        '与当前方案叠加对比',
                        'Superponer con plano actual',
                        'Superposer au plan actuel',
                      )}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-xs font-bold truncate">{ghostPreview.title}</span>
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                {ghostPreview.subtitle || ui.ghostBannerHint} ·{' '}
                {tr6(
                  language,
                  `시설 ${ghostPreview.facilities.length}개 고화질 렌더링`,
                  `${ghostPreview.facilities.length} PBR 3D modules`,
                  `${ghostPreview.facilities.length}施設の高精細3D表示`,
                  `${ghostPreview.facilities.length}个设施高清3D模型`,
                  `${ghostPreview.facilities.length} módulos 3D de alta calidad`,
                  `${ghostPreview.facilities.length} modules 3D haute fidélité`,
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setPreviewOverlayExisting(false)}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                  !previewOverlayExisting
                    ? 'bg-white text-slate-900'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {tr6(language, '새 도안 단독', 'Solo New Floor', '新規図面単独', '新画布独立看', 'Plano nuevo solo', 'Nouveau plan seul')}
              </button>
              <button
                type="button"
                onClick={() => setPreviewOverlayExisting(true)}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                  previewOverlayExisting
                    ? 'bg-white text-slate-900'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {tr6(language, '기존 도안 겹쳐보기', 'Compare Overlay', '既存と重ねる', '叠加当前方案', 'Superponer actual', 'Superposer')}
              </button>
            </div>

            <button
              type="button"
              onClick={onConfirmGhostPreview}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{ui.ghostBannerConfirm}</span>
            </button>
            <button
              type="button"
              onClick={onCancelGhostPreview}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{ui.ghostBannerCancel}</span>
            </button>
          </div>
        </div>
      )}

      {/* Dispersed Relocation 3D Diff Banner (makes dispersed 3D layout differences unmistakable!) */}
      {!ghostPreview && activeLayoutBadge === 'optimized' && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white border border-emerald-400 rounded-xl px-4 py-2 shadow-lg flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-emerald-300">
            {tr6(
              language,
              `분산 재배치 도안 3D 표시 중 · 좌우 분산 이동·경량 조정 ${relocatedFacilityCount}개 시설 초록 바닥선 강조됨`,
              `Dispersed Layout Active in 3D · ${relocatedFacilityCount} relocated/compacted booths highlighted in emerald`,
              `分散再配置3D表示中 · 移動・調整された${relocatedFacilityCount}施設を緑枠で強調`,
              `分散重排方案3D显示中 · 已用绿色底座标出 ${relocatedFacilityCount} 个分散移动与精简展位`,
              `Diseño disperso activo en 3D · ${relocatedFacilityCount} módulos reubicados resaltados en verde`,
              `Plan dispersé actif en 3D · ${relocatedFacilityCount} modules déplacés soulignés en vert`,
            )}
          </span>
          {onSwitchLayoutMode && (
            <button
              type="button"
              onClick={() => onSwitchLayoutMode('original')}
              className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
            >
              {tr6(language, '원본 도안으로 전환 비교', 'Switch to Original to Compare', '元の図面と切替比較', '切换原方案对比', 'Cambiar al original', 'Comparer à l’original')}
            </button>
          )}
        </div>
      )}

      {/* Empty Blank Plan Guidance Card */}
      {facilities.length === 0 && !ghostPreview && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-white border border-slate-300 rounded-xl px-5 py-3.5 shadow-sm text-center max-w-md">
          <div className="text-xs font-bold text-slate-900">
            {config.venueWidth}m × {config.venueDepth}m{' '}
            {tr6(language, '빈 도안', 'Blank Venue Floor', '空の図面', '空白场地画布', 'Plano en blanco', 'Plan vierge')}
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{ui.emptyVenueHint}</p>
        </div>
      )}

      {/* Locked Booth Protection Toast */}
      {lockedToast && (
        <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-amber-900 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-md flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>{lockedToast}</span>
        </div>
      )}

      {/* Top-Left Indoor Layer & Accessibility Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-2 max-w-[calc(100%-260px)]">
        <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm">
          {onToggleLeftSidebar && (
            <>
              <button
                type="button"
                onClick={onToggleLeftSidebar}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isLeftSidebarOpen
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <PanelLeft className="w-3.5 h-3.5" />
                {!isLeftSidebarOpen && <span>{ui.tabSetup}</span>}
              </button>
              <div className="h-4 w-px bg-slate-200 mx-0.5" />
            </>
          )}

          {quickLayerButtons.map((btn) => {
            const active = visibility[btn.key];
            return (
              <button
                key={btn.key}
                type="button"
                onClick={() => onToggleVisibility(btn.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-xs ${btn.dotColor}`} />
                <span>{btn.label}</span>
              </button>
            );
          })}

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          <button
            type="button"
            onClick={() => onToggleVisibility('labels')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              visibility.labels
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>{tr6(language, '이름표', 'Labels', 'ラベル', '名称标签', 'Etiquetas', 'Étiquettes')}</span>
          </button>

          {activeLayoutBadge === 'optimized' && (
            <span className="ml-1 text-xs font-semibold text-emerald-700 px-1.5">
              {tr6(language, '분산 최적화 적용', 'Dispersed Plan', '分散最適化', '已启用分散优化', 'Plan disperso', 'Plan dispersé')}
            </span>
          )}
        </div>

        {/* New Blueprint / Reset Design Action Strip & Legend Button */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm text-xs">
          {onRequestNewPlan && (
            <button
              type="button"
              onClick={onRequestNewPlan}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>{ui.newBlueprintBtn}</span>
            </button>
          )}

          {onResetDesign && (
            <button
              type="button"
              onClick={onResetDesign}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>{tr6(language, '초기 복원', 'Reset Layout', '初期復元', '重置初始', 'Restaurar', 'Réinitialiser')}</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          <button
            type="button"
            onClick={() => setShowRoleLegend((v) => !v)}
            className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-700 cursor-pointer"
          >
            {ui.legendTitle}
          </button>
        </div>

        {/* Unified Visitor Group & Dedicated Step-Free Egress Legend */}
        {showRoleLegend && (
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm text-[11px] text-slate-700">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 shrink-0" />
              <span>
                {ui.legendGeneralVisitor}
                {roleCounts ? ` (${roleCounts.general.toLocaleString()})` : ''}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-teal-900">
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-600 shrink-0" />
              <span>
                {ui.legendAccessibilityGroup}
                {roleCounts ? ` (${roleCounts.mobilityAssisted.toLocaleString()})` : ''}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-emerald-800">
              <span className="w-4 h-1.5 rounded-xs bg-emerald-500 shrink-0" />
              <span>{ui.legendAccessibilityEgress}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-4 h-1 bg-slate-400 shrink-0" />
              <span>{ui.legendGeneralRoute}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-4 h-1 bg-red-500 shrink-0" />
              <span>{ui.legendEmergencyRoute}</span>
            </span>
          </div>
        )}
      </div>

      {/* Hover Tooltip */}
      {hoveredName && (
        <div className="pointer-events-none absolute top-32 left-3 z-20 bg-slate-900 text-white text-xs font-medium px-2.5 py-1 rounded-md shadow-sm">
          {hoveredName}
        </div>
      )}

      {/* Top-Right Camera Presets, Exclusive Device Mode Switcher & Control Guide */}
      <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2 max-w-[270px]">
        {/* Indoor Camera View Switcher */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
          <button
            type="button"
            onClick={() => applyCameraPreset('isometric')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              cameraMode === 'isometric'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>{ui.viewIso}</span>
          </button>
          <button
            type="button"
            onClick={() => applyCameraPreset('top')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              cameraMode === 'top'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{ui.viewTop}</span>
          </button>
          <button
            type="button"
            onClick={() => applyCameraPreset('perspective')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              cameraMode === 'perspective'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>
              {(config.venueEnvironment ?? 'indoor') === 'outdoor'
                ? isKo
                  ? '현장 시점'
                  : 'Ground Eye'
                : isKo
                  ? '실내 시점'
                  : 'Indoor Eye'}
            </span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          {primaryExteriorParking && (
            <button
              type="button"
              onClick={focusExteriorParking}
              title={isKo ? '행사장 외부 주차장 보기' : 'Focus Exterior Parking'}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Car className="w-3.5 h-3.5 text-blue-600" />
              <span>{efStrings.jumpExteriorParkingBtn}</span>
            </button>
          )}

          {onToggleRightSidebar && (
            <>
              <div className="h-4 w-px bg-slate-200 mx-0.5" />
              <button
                type="button"
                onClick={onToggleRightSidebar}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isRightSidebarOpen
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <PanelRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Exclusive Device Mode Switcher + Single-Mode Guide Card */}
        <div className="w-full bg-white border border-slate-200 rounded-lg p-2 shadow-sm space-y-1.5 text-[11px]">
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => onChangeDeviceMode('laptop')}
              className={`flex items-center justify-center gap-1 py-1 px-2 rounded text-[11px] font-semibold cursor-pointer ${
                deviceMode === 'laptop'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Laptop className="w-3 h-3 shrink-0" />
              <span className="truncate">{ui.deviceLaptop}</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeDeviceMode('tablet')}
              className={`flex items-center justify-center gap-1 py-1 px-2 rounded text-[11px] font-semibold cursor-pointer ${
                deviceMode === 'tablet'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool className="w-3 h-3 shrink-0" />
              <span className="truncate">{ui.deviceTablet}</span>
            </button>
          </div>

          {deviceMode === 'laptop' ? (
            <div className="space-y-0.5 text-slate-600 leading-snug">
              <div className="font-semibold text-slate-900">{ui.laptopGuideTitle}</div>
              <div>{ui.laptopGuideKeys}</div>
              <div>{ui.laptopGuideDrag}</div>
              <div>{ui.laptopGuideWheel}</div>
            </div>
          ) : (
            <div className="space-y-0.5 text-slate-600 leading-snug">
              <div className="font-semibold text-blue-900">{ui.tabletGuideTitle}</div>
              <div>{ui.tabletGuidePen}</div>
              <div>{ui.tabletGuideOrbit}</div>
            </div>
          )}
        </div>

        {/* Camera Pan / Zoom / Fullscreen Controls */}
        <div className="flex items-start gap-1.5">
          {deviceMode === 'laptop' && (
            <div className="bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
              <div className="flex items-center gap-1 pb-1 mb-1 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => toggleDragMode('rotate')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                    dragMode === 'rotate'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {isKo ? '회전' : 'Orbit'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleDragMode('pan')}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                    dragMode === 'pan'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Move className="w-2.5 h-2.5" />
                  <span>{isKo ? '이동' : 'Pan'}</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-0.5 w-[74px]">
                <div />
                <button
                  type="button"
                  onClick={() => handlePanByButtons(1, 0)}
                  aria-label="Pan Forward"
                  className="p-1 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <div />
                <button
                  type="button"
                  onClick={() => handlePanByButtons(0, -1)}
                  aria-label="Pan Left"
                  className="p-1 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyCameraPreset(cameraMode)}
                  aria-label="Recenter"
                  className="p-0.5 flex items-center justify-center text-[9px] font-bold text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                >
                  {isKo ? '중앙' : 'CTR'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePanByButtons(0, 1)}
                  aria-label="Pan Right"
                  className="p-1 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <div />
                <button
                  type="button"
                  onClick={() => handlePanByButtons(-1, 0)}
                  aria-label="Pan Backward"
                  className="p-1 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <div />
              </div>
            </div>
          )}

          <div className="flex flex-col bg-white border border-slate-200 rounded-lg p-1 shadow-sm gap-0.5">
            <button
              type="button"
              onClick={() => handleZoom(0.8)}
              title="Zoom In"
              aria-label="Zoom In"
              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(1.25)}
              title="Zoom Out"
              aria-label="Zoom Out"
              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyCameraPreset('isometric')}
              title={ui.viewReset}
              aria-label={ui.viewReset}
              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="h-px bg-slate-200 my-0.5" />
            <button
              type="button"
              onClick={handleToggleFullscreen}
              aria-label="Toggle Fullscreen"
              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {webglError && (
        <div className="absolute inset-x-6 top-28 z-30 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-sm">
          {webglError}
        </div>
      )}

      {children}
    </div>
  );
};
