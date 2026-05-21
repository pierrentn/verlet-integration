import {
  BufferAttribute,
  DynamicDrawUsage,
  GridHelper,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Sphere,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGPURenderer,
  PlaneGeometry,
  Mesh,
  MeshNormalMaterial,
  MeshStandardMaterial,
  DirectionalLight,
  AmbientLight,
  Color,
  Euler,
  PointLight,
  Raycaster,
  Texture,
  TextureLoader,
  CubeTextureLoader,
  EquirectangularReflectionMapping,
  SRGBColorSpace,
} from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Clock, Viewport } from './core';
import { Pointer } from './core/Pointer';
import { clamp } from '../utils/maths';
import Stats from 'stats-gl';
import {
  normalFlat,
  normalGeometry,
  normalLocal,
  normalWorld,
} from 'three/tsl';

const V3 = new Vector3();
const V3B = new Vector3();
const V3C = new Vector3();
const V3D = new Vector3();
const UP = new Vector3(0, 1, 0);
const TMP_QUAT = new Quaternion();
const TMP_SCALE = new Vector3(1, 1, 1);
const TMP_MATRIX = new Matrix4();

const FOV = 75;
const NEAR = 0.1;
const FAR = 1000;

const MASS = 1;
const FORCE = 0;
const GRAVITY = 20;
const FRICTION = 0.998;
const BOUNCE = 0.9;
const ELASTICITY = 0.02;

const GRID = { x: 51, y: 51 };

const POINT_SIZE = 0.025;

const MOUSE_RADIUS = 0.5;

let _instance: WebGlApp | null = null;

interface PPoint {
  pos: Vector3;
  prevPos: Vector3;
  isPinned: boolean;
  mass: number;
}

interface PLink {
  p0: PPoint;
  p1: PPoint;
  length: number;
}

export class WebGlApp {
  public $canvas: HTMLCanvasElement;

  public scene: Scene;
  public clock: Clock;
  public renderer: WebGPURenderer;
  public viewport: Viewport;
  public pointer: Pointer;
  public stats: Stats;
  private controls: OrbitControls;
  private raycaster: Raycaster;

  private radFov: number;
  public camera: PerspectiveCamera;

  private worldBounds: null | {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } = null;
  private pointsMesh?: InstancedMesh;
  private linksMesh?: InstancedMesh;

  private cloth: Mesh;
  private clothPositions?: Float32Array;

  private pPoint: PPoint[] = [];

  private pLink: PLink[] = [];

  private cursorSphere: Sphere;

  public static getInstance(): WebGlApp {
    if (!_instance) {
      _instance = new WebGlApp();
    }
    return _instance;
  }

  private constructor() {
    this.$canvas = document.createElement('canvas');
    this.$canvas.classList.add('webgl-canvas');
    document.body.appendChild(this.$canvas);

    this.clock = new Clock();
    this.renderer = new WebGPURenderer({
      canvas: this.$canvas,
      antialias: true,
    });

    this.stats = new Stats();
    document.body.appendChild(this.stats.dom);
    this.stats.init(this.renderer);

    this.viewport = new Viewport({
      $canvas: this.$canvas,
      resize: this.resize,
    });

    this.pointer = new Pointer({
      viewport: this.viewport,
      clock: this.clock,
    });

    this.camera = new PerspectiveCamera(FOV, this.viewport.ratio, NEAR, FAR);
    this.radFov = (this.camera.fov * Math.PI) / 180;
    this.camera.position.z = 10;

    this.controls = new OrbitControls(this.camera, this.$canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.raycaster = new Raycaster();

    this.scene = new Scene();

    this.setupEnvironment();

    const directionalLight = new DirectionalLight(new Color(0xffffff), 10);
    directionalLight.position.set(10, 8, 1);
    this.scene.add(directionalLight);

    const ambientLight = new AmbientLight(new Color(0xffffff), 0.1);
    this.scene.add(ambientLight);

    this.cursorSphere = new Sphere(new Vector3(), MOUSE_RADIUS);

    const xyPlane = new GridHelper(30, 30).rotateX(Math.PI / 2);
    this.scene.add(xyPlane);

    // this.pPoint.push({
    //   pos: new Vector3(),
    //   prevPos: new Vector3(-0.05, 0, 0),
    //   isPinned: false,
    //   mass: MASS,
    // });

    // this.setBox();
    // this.setPendulum();
    this.setGrid();

    this.createVisibleObjects();

    const clothMaterial = new MeshStandardMaterial({ side: DoubleSide });
    new TextureLoader().load('/shrek.jpg', (texture) => {
      clothMaterial.map = texture;
      clothMaterial.needsUpdate = true;
    });

    const clothGeometry = new PlaneGeometry(1, 1, GRID.x - 1, GRID.y - 1);
    // clothMaterial.fragmentNode = normalWorld;
    this.cloth = new Mesh(clothGeometry, clothMaterial);
    // clothMaterial.flatShading = true;
    this.clothPositions = new Float32Array(this.pPoint.length * 3);
    const clothPositionAttr = new BufferAttribute(this.clothPositions, 3);
    clothPositionAttr.setUsage(DynamicDrawUsage);
    this.cloth.geometry.setAttribute('position', clothPositionAttr);
    this.scene.add(this.cloth);

    this.renderer.setAnimationLoop(this.tick);
    this.start();
  }

  private setupEnvironment(): void {
    const envRotation = new Euler(0, Math.PI / 2, 0);
    this.scene.backgroundRotation.copy(envRotation);
    this.scene.environmentRotation.copy(envRotation);

    const cubeUrls = [
      new URL('../assets/shrekCubeMap/px.png', import.meta.url).href,
      new URL('../assets/shrekCubeMap/nx.png', import.meta.url).href,
      new URL('../assets/shrekCubeMap/py.png', import.meta.url).href,
      new URL('../assets/shrekCubeMap/ny.png', import.meta.url).href,
      new URL('../assets/shrekCubeMap/pz.png', import.meta.url).href,
      new URL('../assets/shrekCubeMap/nz.png', import.meta.url).href,
    ];

    new CubeTextureLoader().load(cubeUrls, (cubeTexture) => {
      cubeTexture.colorSpace = SRGBColorSpace;
      this.scene.environment = cubeTexture;
    });

    new TextureLoader().load('/shrek-hdri.png', (texture) => {
      texture.mapping = EquirectangularReflectionMapping;
      texture.colorSpace = SRGBColorSpace;
      this.scene.background = texture;
    });
  }

  //   [
  //     [],
  //     [],
  //     [],
  //     [],
  //   ]

  private setGrid(): void {
    const gridSchema = new Vector2(GRID.x, GRID.y);
    const gridCenter = new Vector2(0, 0);
    const gridSpacing = new Vector2(0.1, 0.1);
    let pIndex = 0;

    for (let row = 0; row < gridSchema.y; row++) {
      const ttSizeY = gridSpacing.y * (gridSchema.y - 1);
      const y = ttSizeY - gridSpacing.y * row - ttSizeY / 2;

      for (let col = 0; col < gridSchema.x; col++) {
        const ttSizeX = gridSpacing.x * (gridSchema.x - 1);
        let x = gridSpacing.x * col - ttSizeX / 2;
        const randZ = 0;
        const newPoint: PPoint = {
          //   isPinned: pIndex === 0 || pIndex === gridSchema.x - 1,
          isPinned: row === 0 && col % 5 === 0,
          pos: new Vector3(
            x,
            y,
            // (col + row) / (gridSchema.x * gridSchema.y * 0.5)
            0
          ),
          prevPos: new Vector3(
            x,
            y,
            // (col + row) / (gridSchema.x * gridSchema.y * 0.5)
            0
          ),
          mass: MASS,
        };
        this.pPoint.push(newPoint);

        if (pIndex > 0) {
          const p0Idx = pIndex - 1;
          const p1Index = pIndex;
          if (col > 0) {
            const newLink: PLink = {
              p0: this.pPoint[p0Idx],
              p1: this.pPoint[p1Index],
              length: this.pPoint[p0Idx].pos.distanceTo(
                this.pPoint[p1Index].pos
              ),
            };
            this.pLink.push(newLink);
          }
        }
        if (row > 0) {
          const p0Idx = pIndex - 1;
          const p1Index = pIndex;

          this.pLink.push({
            p0: this.pPoint[p0Idx - (gridSchema.x - 1)],
            p1: this.pPoint[p1Index],
            length: this.pPoint[p0Idx - (gridSchema.x - 1)].pos.distanceTo(
              this.pPoint[p1Index].pos
            ),
          });
        }
        pIndex++;
      }
    }

    console.log('nb Points:', this.pPoint.length);
    console.log('nb Links:', this.pLink.length);
  }

  private setBox(): void {
    this.pPoint.push({
      pos: new Vector3(0, 0, 0),
      prevPos: new Vector3(-0.05, -0.05, 0),
      isPinned: false,
      mass: MASS,
    });
    this.pPoint.push({
      pos: new Vector3(0, 1, 0),
      prevPos: new Vector3(0, 1, 0),
      isPinned: false,
      mass: MASS,
    });
    this.pPoint.push({
      pos: new Vector3(1, 1, 0),
      prevPos: new Vector3(1, 1, 0),
      isPinned: false,
      mass: MASS,
    });
    this.pPoint.push({
      pos: new Vector3(1, 0, 0),
      prevPos: new Vector3(1, 0, 0),
      isPinned: false,
      mass: MASS,
    });
    this.pLink.push({
      p0: this.pPoint[0],
      p1: this.pPoint[1],
      length: this.pPoint[0].pos.distanceTo(this.pPoint[1].pos),
    });
    this.pLink.push({
      p0: this.pPoint[1],
      p1: this.pPoint[2],
      length: this.pPoint[1].pos.distanceTo(this.pPoint[2].pos),
    });
    this.pLink.push({
      p0: this.pPoint[2],
      p1: this.pPoint[3],
      length: this.pPoint[2].pos.distanceTo(this.pPoint[3].pos),
    });
    this.pLink.push({
      p0: this.pPoint[3],
      p1: this.pPoint[0],
      length: this.pPoint[3].pos.distanceTo(this.pPoint[0].pos),
    });
    this.pLink.push({
      p0: this.pPoint[1],
      p1: this.pPoint[3],
      length: this.pPoint[1].pos.distanceTo(this.pPoint[3].pos),
    });
  }

  private setPendulum(): void {
    const pendulumNbPoints = 40;
    const offsetX = 0.1;
    const offsetY = 0.1;
    const offsetZ = 0;
    const baseY = 3;
    for (let i = 0; i < pendulumNbPoints; i++) {
      const newP = {
        pos: new Vector3(0 - offsetX * i, baseY - offsetY * i, offsetZ * i),
        prevPos: new Vector3(0 - offsetX * i, baseY - offsetY * i, offsetZ * i),
        isPinned: i === 0,
        mass: MASS,
      };
      this.pPoint.push(newP);
    }

    for (let i = 0; i < this.pPoint.length; i++) {
      if (i !== 0) {
        const nLink = {
          p0: this.pPoint[i - 1],
          p1: this.pPoint[i],
          length: this.pPoint[i].pos.distanceTo(this.pPoint[i - 1].pos),
        };
        this.pLink.push(nLink);
      }
    }
  }

  private createVisibleObjects(): void {
    const pointGeometry = new SphereGeometry(POINT_SIZE, 5, 5);
    const pointMaterial = new MeshBasicNodeMaterial({
      color: 'red',
      wireframe: true,
      transparent: true,
      opacity: 0.1,
    });
    this.pointsMesh = new InstancedMesh(
      pointGeometry,
      pointMaterial,
      this.pPoint.length
    );
    for (let i = 0; i < this.pPoint.length; i++) {
      TMP_MATRIX.makeTranslation(
        this.pPoint[i].pos.x,
        this.pPoint[i].pos.y,
        this.pPoint[i].pos.z
      );
      this.pointsMesh.setMatrixAt(i, TMP_MATRIX);
    }
    // this.scene.add(this.pointsMesh);

    const linkGeometry = new CylinderGeometry(0.01, 0.01, 1, 6);
    const linkMaterial = new MeshBasicNodeMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.1,
    });
    this.linksMesh = new InstancedMesh(
      linkGeometry,
      linkMaterial,
      this.pLink.length
    );
    for (let i = 0; i < this.pLink.length; i++) {
      this.setLinkMatrix(this.pLink[i], TMP_MATRIX);
      this.linksMesh.setMatrixAt(i, TMP_MATRIX);
    }
    // this.scene.add(this.linksMesh);
  }

  private start(): void {
    this.clock.start();
    this.viewport.start();
    this.pointer.start();

    this.renderer.init();
  }

  public resize = (): void => {
    this.camera.aspect = this.viewport.ratio;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.viewport.size.x, this.viewport.size.y);
    this.renderer.setPixelRatio(this.viewport.dpr);

    const worldSizeY = 2 * (Math.tan(this.radFov / 2) * this.camera.position.z);
    const worldSizeX = worldSizeY * this.viewport.ratio;
    this.worldBounds = {
      minX: worldSizeX / -2,
      maxX: worldSizeX / 2,
      minY: worldSizeY / -2,
      maxY: worldSizeY / 2,
    };
  };

  private updatePhysicsPoints(): void {
    for (let i = 0; i < this.pPoint.length; i++) {
      const { pos, prevPos, isPinned, mass } = this.pPoint[i];
      if (isPinned) continue;
      const acceleration = V3.set(
        FORCE / mass,
        (FORCE + GRAVITY * -1) / mass,
        FORCE / mass
      ); //newton's second law

      const sqDt = this.clock.delta * this.clock.delta;

      let newX, newY, newZ;
      if (
        this.cursorSphere.containsPoint(pos) &&
        this.worldBounds &&
        this.pointer.isDown
      ) {
        const dragX = clamp(
          this.pointer.ndcVelocity.x * this.worldBounds.maxX,
          -ELASTICITY,
          ELASTICITY
        );
        const dragY = clamp(
          this.pointer.ndcVelocity.y * this.worldBounds.maxY,
          -ELASTICITY,
          ELASTICITY
        );

        const dragZ = clamp(
          this.pointer.ndcVelocity.length() * this.worldBounds.maxY,
          -ELASTICITY,
          ELASTICITY
        );

        newX =
          pos.x +
          ((pos.x - prevPos.x) * FRICTION + dragX) +
          acceleration.x * sqDt;
        newY =
          pos.y +
          ((pos.y - prevPos.y) * FRICTION + dragY) +
          acceleration.y * sqDt;
        newZ =
          pos.z +
          ((pos.z - prevPos.z) * FRICTION + dragZ) +
          acceleration.z * sqDt;
      } else {
        newX = pos.x + (pos.x - prevPos.x) * FRICTION + acceleration.x * sqDt;
        newY = pos.y + (pos.y - prevPos.y) * FRICTION + acceleration.y * sqDt;
        newZ = pos.z + (pos.z - prevPos.z) * FRICTION + acceleration.z * sqDt;
      }

      prevPos.copy(pos);
      pos.set(newX, newY, newZ);
    }
  }

  private updatePhysicsLinks(): void {
    for (let i = 0; i < this.pLink.length; i++) {
      const { p0, p1, length } = this.pLink[i];
      const delta = V3.copy(p1.pos).sub(p0.pos);
      const dist = delta.length();
      const difference = dist - length;

      const offset = V3.copy(delta)
        .normalize()
        .multiplyScalar(difference * 0.5);

      if (!p0.isPinned) p0.pos.add(offset);
      if (!p1.isPinned) p1.pos.sub(offset);
    }
  }

  private applyCollision(): void {
    for (let i = 0; i < this.pPoint.length; i++) {
      const p = this.pPoint[i];
      for (let j = i + 1; j < this.pPoint.length; j++) {
        const pTest = this.pPoint[j];
        const delta = V3.copy(p.pos).sub(pTest.pos);
        const dist = delta.length();

        if (dist > 0 && dist < POINT_SIZE * 2) {
          const dir = V3.copy(delta).normalize();
          const difference = POINT_SIZE * 2 - dist;

          if (!p.isPinned && !pTest.isPinned) {
            const offset = V3B.copy(dir).multiplyScalar(difference * 0.5);
            p.pos.add(offset);
            pTest.pos.sub(offset);
          } else if (!p.isPinned) {
            const offset = V3B.copy(dir).multiplyScalar(difference);
            p.pos.add(offset);
          } else if (!pTest.isPinned) {
            const offset = V3B.copy(dir).multiplyScalar(difference);
            pTest.pos.sub(offset);
          }
        }
      }
    }
  }

  private applyConstraint(): void {
    if (this.worldBounds) {
      for (let i = 0; i < this.pPoint.length; i++) {
        const { pos, prevPos, mass } = this.pPoint[i];
        const velX = (pos.x - prevPos.x) * FRICTION;
        const velY = (pos.y - prevPos.y) * FRICTION;
        // const velZ = (pos.z - prevPos.x) * FRICTION;

        const { minX, maxX, minY, maxY } = this.worldBounds;

        if (pos.x >= maxX) {
          pos.x = maxX;
          this.pPoint[i].prevPos.x = maxX + velX * BOUNCE;
        } else if (pos.x <= minX) {
          pos.x = minX;
          this.pPoint[i].prevPos.x = minX + velX * BOUNCE;
        }

        if (pos.y >= maxY) {
          pos.y = maxY;
          this.pPoint[i].prevPos.y = maxY + velY * BOUNCE;
        } else if (pos.y <= minY) {
          pos.y = minY;
          this.pPoint[i].prevPos.y = minY + velY * BOUNCE;
        }
      }
    }
  }

  private updatePointsPosition(): void {
    if (!this.pointsMesh) return;
    for (let i = 0; i < this.pPoint.length; i++) {
      const objPPoint = this.pPoint[i];
      TMP_MATRIX.makeTranslation(
        objPPoint.pos.x,
        objPPoint.pos.y,
        objPPoint.pos.z
      );
      this.pointsMesh.setMatrixAt(i, TMP_MATRIX);
    }
    this.pointsMesh.instanceMatrix.needsUpdate = true;
  }

  private updateLinksPosition(): void {
    if (!this.linksMesh) return;
    for (let i = 0; i < this.pLink.length; i++) {
      const pLink = this.pLink[i];
      this.setLinkMatrix(pLink, TMP_MATRIX);
      this.linksMesh.setMatrixAt(i, TMP_MATRIX);
    }
    this.linksMesh.instanceMatrix.needsUpdate = true;
  }

  private setLinkMatrix(link: PLink, target: Matrix4): void {
    const start = link.p0.pos;
    const end = link.p1.pos;
    const delta = V3C.copy(end).sub(start);
    const length = delta.length();

    if (length === 0) {
      target.identity();
      return;
    }

    const midpoint = V3D.copy(start).add(end).multiplyScalar(0.5);
    // Rotate the unit Y axis to align the cylinder with the segment direction.
    TMP_QUAT.setFromUnitVectors(UP, delta.normalize());
    TMP_SCALE.set(1, length, 1);
    // Compose translation (midpoint), rotation, and scale into the instance matrix.
    target.compose(midpoint, TMP_QUAT, TMP_SCALE);
  }

  public update = (): void => {
    this.clock.update();
    this.viewport.update();

    if (this.worldBounds) {
      this.cursorSphere.center.set(
        this.pointer.ndcPointer.x * this.worldBounds?.maxX,
        this.pointer.ndcPointer.y * this.worldBounds?.maxY,
        0
      );
    }

    this.updatePhysicsPoints();
    for (let i = 0; i < 4; i++) {
      this.updatePhysicsLinks();
      //   this.applyCollision();
    }
    // this.applyConstraint();
    this.updatePointsPosition();
    this.updateLinksPosition();
    this.pointer.update();

    if (this.clothPositions) {
      for (let i = 0; i < this.pPoint.length; i++) {
        const p = this.pPoint[i].pos;
        const base = i * 3;
        this.clothPositions[base] = p.x;
        this.clothPositions[base + 1] = p.y;
        this.clothPositions[base + 2] = p.z;
      }
      this.cloth.geometry.attributes.position.needsUpdate = true;
      this.cloth.geometry.computeVertexNormals();
    }

    this.camera.updateMatrixWorld();
    this.cloth.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer.ndcPointer, this.camera);
    const clothHits = this.raycaster.intersectObject(this.cloth, false);
    this.controls.enabled = clothHits.length === 0;
  };

  public render = (): void => {
    this.renderer.render(this.scene, this.camera);
  };

  public tick = (): void => {
    // this.camera.position.x = Math.cos(this.clock.elapsed * 0.7) * 2 * 3;
    // this.camera.position.z = Math.sin(this.clock.elapsed * 0.7) * 2 * 3;
    // this.camera.lookAt(new Vector3());
    this.update();
    this.controls.update();
    this.render();
    this.stats.update();
  };

  stop() {
    this.pointer.stop();
  }
}
