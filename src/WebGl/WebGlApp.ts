import {
  BufferAttribute,
  DynamicDrawUsage,
  GridHelper,
  CylinderGeometry,
  DoubleSide,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  Scene,
  Sphere,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGPURenderer,
  PlaneGeometry,
  Mesh,
  MeshStandardMaterial,
  DirectionalLight,
  AmbientLight,
  Color,
  Euler,
  Raycaster,
  TextureLoader,
  EquirectangularReflectionMapping,
  SRGBColorSpace,
} from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Clock, Viewport } from './core';
import { Pointer } from './core/Pointer';
import Stats from 'stats-gl';
import { normalWorld } from 'three/tsl';
import { Point } from './physic/Point';
import { Link } from './physic/Link';
import { PointHelpers } from './physic/PointHelpers';
import { LinkHelpers } from './physic/LinkHelpers';

const FOV = 75;
const NEAR = 0.1;
const FAR = 1000;

const FORCE = 0;
const GRAVITY = 50;
const FRICTION = 0.998;

const GRID = { x: 71, y: 71 };

const POINT_SIZE = 0.025;

const MOUSE_RADIUS = 0.5;

let _instance: WebGlApp | null = null;

//TODO: add z dimension
export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
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

  public worldBounds: null | WorldBounds = null;
  public cursorSphere: Sphere;

  private pointHelpers!: PointHelpers;
  private linkHelpers!: LinkHelpers;

  private cloth: Mesh;
  private clothPositions?: Float32Array;

  private pPoint: Point[] = [];

  private pLink: Link[] = [];

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
    // new TextureLoader().load('/shrek.jpg', (texture) => {
    //   clothMaterial.map = texture;
    //   clothMaterial.needsUpdate = true;
    // });

    const clothGeometry = new PlaneGeometry(1, 1, GRID.x - 1, GRID.y - 1);
    clothMaterial.fragmentNode = normalWorld;
    this.cloth = new Mesh(clothGeometry, clothMaterial);
    // clothMaterial.flatShading = true;
    this.clothPositions = new Float32Array(this.pPoint.length * 3);
    const clothPositionAttr = new BufferAttribute(this.clothPositions, 3);
    clothPositionAttr.setUsage(DynamicDrawUsage);
    this.cloth.geometry.setAttribute('position', clothPositionAttr);
    // this.scene.add(this.cloth);

    this.renderer.setAnimationLoop(this.tick);
    this.start();
  }

  private setupEnvironment(): void {
    const envRotation = new Euler(0, Math.PI / 2, 0);
    this.scene.backgroundRotation.copy(envRotation);
    this.scene.environmentRotation.copy(envRotation);

    new TextureLoader().load('/shrek-hdri.png', (texture) => {
      texture.mapping = EquirectangularReflectionMapping;
      texture.colorSpace = SRGBColorSpace;
      //   this.scene.background = texture;
    });
  }

  private setGrid(): void {
    const gridSchema = new Vector2(GRID.x, GRID.y);
    const gridCenter = new Vector2(0, 0);
    const gridSpacing = new Vector2(0.05, 0.05);
    let pIndex = 0;

    for (let row = 0; row < gridSchema.y; row++) {
      const ttSizeY = gridSpacing.y * (gridSchema.y - 1);
      const y = ttSizeY - gridSpacing.y * row - ttSizeY / 2;

      for (let col = 0; col < gridSchema.x; col++) {
        const ttSizeX = gridSpacing.x * (gridSchema.x - 1);
        let x = gridSpacing.x * col - ttSizeX / 2;
        const z = Math.random() * 0.05 - 0.025;

        const newPoint = new Point({
          app: this,
          physic: {
            isPinned: row === 0 && col % 5 === 0,
            position: new Vector3(x, y, z),
            prevPosition: new Vector3(x, y, z),
          },
        });
        this.pPoint.push(newPoint);

        if (pIndex > 0) {
          const p0Idx = pIndex - 1;
          const p1Index = pIndex;
          if (col > 0) {
            const newLink = new Link({
              app: this,
              physic: {
                p0: this.pPoint[p0Idx],
                p1: this.pPoint[p1Index],
                length: this.pPoint[p0Idx].position.distanceTo(
                  this.pPoint[p1Index].position
                ),
              },
            });

            this.pLink.push(newLink);
          }
        }
        if (row > 0) {
          const p0Idx = pIndex - 1;
          const p1Index = pIndex;

          this.pLink.push(
            new Link({
              app: this,
              physic: {
                p0: this.pPoint[p0Idx - (gridSchema.x - 1)],
                p1: this.pPoint[p1Index],
                length: this.pPoint[
                  p0Idx - (gridSchema.x - 1)
                ].position.distanceTo(this.pPoint[p1Index].position),
              },
            })
          );
        }
        pIndex++;
      }
    }

    console.log('nb Points:', this.pPoint.length);
    console.log('nb Links:', this.pLink.length);
  }

  private setBox(): void {
    this.pPoint.push(
      new Point({
        app: this,
        physic: {
          position: new Vector3(0, 0, 0),
          prevPosition: new Vector3(-0.05, -0.05, 0),
          isPinned: false,
        },
      })
    );
    this.pPoint.push(
      new Point({
        app: this,
        physic: {
          position: new Vector3(0, 1, 0),
          prevPosition: new Vector3(0, 1, 0),
          isPinned: false,
        },
      })
    );
    this.pPoint.push(
      new Point({
        app: this,
        physic: {
          position: new Vector3(1, 1, 0),
          prevPosition: new Vector3(1, 1, 0),
          isPinned: false,
        },
      })
    );
    this.pPoint.push(
      new Point({
        app: this,
        physic: {
          position: new Vector3(1, 0, 0),
          prevPosition: new Vector3(1, 0, 0),
          isPinned: false,
        },
      })
    );
    this.pLink.push(
      new Link({
        app: this,
        physic: {
          p0: this.pPoint[0],
          p1: this.pPoint[1],
          length: this.pPoint[0].position.distanceTo(this.pPoint[1].position),
        },
      })
    );
    this.pLink.push(
      new Link({
        app: this,
        physic: {
          p0: this.pPoint[1],
          p1: this.pPoint[2],
          length: this.pPoint[1].position.distanceTo(this.pPoint[2].position),
        },
      })
    );
    this.pLink.push(
      new Link({
        app: this,
        physic: {
          p0: this.pPoint[2],
          p1: this.pPoint[3],
          length: this.pPoint[2].position.distanceTo(this.pPoint[3].position),
        },
      })
    );
    this.pLink.push(
      new Link({
        app: this,
        physic: {
          p0: this.pPoint[3],
          p1: this.pPoint[0],
          length: this.pPoint[3].position.distanceTo(this.pPoint[0].position),
        },
      })
    );
    this.pLink.push(
      new Link({
        app: this,
        physic: {
          p0: this.pPoint[1],
          p1: this.pPoint[3],
          length: this.pPoint[1].position.distanceTo(this.pPoint[3].position),
        },
      })
    );
  }

  private setPendulum(): void {
    const pendulumNbPoints = 40;
    const offsetX = 0.1;
    const offsetY = 0.1;
    const offsetZ = 0;
    const baseY = 3;
    for (let i = 0; i < pendulumNbPoints; i++) {
      const newP = new Point({
        app: this,
        physic: {
          position: new Vector3(
            0 - offsetX * i,
            baseY - offsetY * i,
            offsetZ * i
          ),
          prevPosition: new Vector3(
            0 - offsetX * i,
            baseY - offsetY * i,
            offsetZ * i
          ),
          isPinned: i === 0,
        },
      });
      this.pPoint.push(newP);
    }

    for (let i = 0; i < this.pPoint.length; i++) {
      if (i !== 0) {
        const nLink = new Link({
          app: this,
          physic: {
            p0: this.pPoint[i - 1],
            p1: this.pPoint[i],
            length: this.pPoint[i].position.distanceTo(
              this.pPoint[i - 1].position
            ),
          },
        });
        this.pLink.push(nLink);
      }
    }
  }

  private createVisibleObjects(): void {
    const pointGeometry = new SphereGeometry(POINT_SIZE, 5, 5);
    const pointMaterial = new MeshBasicNodeMaterial({
      //   color: 'red',
      wireframe: false,
      transparent: true,
      vertexColors: true,
      opacity: 1,
    });
    this.pointHelpers = new PointHelpers({
      geometry: pointGeometry,
      material: pointMaterial,
      points: this.pPoint,
    });
    this.scene.add(this.pointHelpers);

    this.linkHelpers = new LinkHelpers({
      geometry: new CylinderGeometry(0.01, 0.01, 1, 6),
      material: new MeshBasicNodeMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 1,
      }),
      links: this.pLink,
    });

    this.scene.add(this.linkHelpers);
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

  //   private applyCollision(): void {
  //     for (let i = 0; i < this.pPoint.length; i++) {
  //       const p = this.pPoint[i];
  //       for (let j = i + 1; j < this.pPoint.length; j++) {
  //         const pTest = this.pPoint[j];
  //         const delta = V3.copy(p.pos).sub(pTest.pos);
  //         const dist = delta.length();

  //         if (dist > 0 && dist < POINT_SIZE * 2) {
  //           const dir = V3.copy(delta).normalize();
  //           const difference = POINT_SIZE * 2 - dist;

  //           if (!p.isPinned && !pTest.isPinned) {
  //             const offset = V3B.copy(dir).multiplyScalar(difference * 0.5);
  //             p.pos.add(offset);
  //             pTest.pos.sub(offset);
  //           } else if (!p.isPinned) {
  //             const offset = V3B.copy(dir).multiplyScalar(difference);
  //             p.pos.add(offset);
  //           } else if (!pTest.isPinned) {
  //             const offset = V3B.copy(dir).multiplyScalar(difference);
  //             pTest.pos.sub(offset);
  //           }
  //         }
  //       }
  //     }
  //   }

  public update = (): void => {
    this.clock.update();
    this.viewport.update();
    this.controls.update();
    this.pointer.update();

    if (this.worldBounds) {
      this.cursorSphere.center.set(
        this.pointer.ndcPointer.x * this.worldBounds?.maxX,
        this.pointer.ndcPointer.y * this.worldBounds?.maxY,
        0
      );
    }

    for (let i = 0; i < this.pPoint.length; i++) {
      this.pPoint[i].updatePhysic(
        { force: FORCE, gravity: GRAVITY, friction: FRICTION },
        this.clock.delta
      );
    }

    for (let i = 0; i < 4; i++) {
      // going backward to prevent skipping items after removal
      for (let i = this.pLink.length - 1; i >= 0; i--) {
        const isTeared = this.pLink[i].updateConstraintsToPoint();
        if (isTeared) {
          this.pLink[i].unlinkPoints();
          this.pLink.splice(i, 1);
          this.linkHelpers.removeInstance(i);
        }
      }
    }

    for (let i = 0; i < this.pPoint.length; i++) {
      this.pPoint[i].applyConstraints({
        force: FORCE,
        gravity: GRAVITY,
        friction: FRICTION,
      });
    }

    this.pointHelpers.update();
    this.linkHelpers.updateTransformation();

    if (this.clothPositions) {
      for (let i = 0; i < this.pPoint.length; i++) {
        const p = this.pPoint[i].position;
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
    this.render();
    this.stats.update();

    if (this.pPoint.length)
      console.log(
        this.pPoint[0].connectedLinks.length,
        this.pPoint[10].connectedLinks.length
      );
  };

  stop() {
    this.pointer.stop();
  }
}
