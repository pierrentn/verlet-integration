import {
  BufferAttribute,
  BufferGeometry,
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
  Mesh,
  MeshStandardMaterial,
  DirectionalLight,
  AmbientLight,
  Color,
  Euler,
  Raycaster,
  RenderPipeline,
  TextureLoader,
  EquirectangularReflectionMapping,
  SRGBColorSpace,
  CircleGeometry,
  Plane,
} from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Clock, Viewport } from './core';
import { Pointer } from './core/Pointer';
import Stats from 'stats-gl';
import {
  color as tslColor,
  float,
  normalView,
  pass,
  positionViewDirection,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { Point } from './physic/Point';
import { Link } from './physic/Link';
import { PointHelpers } from './physic/PointHelpers';
import { LinkHelpers } from './physic/LinkHelpers';
import { FolderApi, Pane } from 'tweakpane';

const FOV = 75;
const NEAR = 0.1;
const FAR = 1000;

const FORCE = 0;
const GRAVITY = 50;

const GRID = { x: 61, y: 61 };

const POINT_SIZE = 0.015;

const MOUSE_RADIUS = 0.15;
const BACKGROUND_COLOR = 0x05070b;
const BLOOM_STRENGTH = 0.2;
const BLOOM_RADIUS = 0.25;
const BLOOM_THRESHOLD = 0.05;

let _instance: WebGlApp | null = null;

//TODO: add z dimension
export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PhysicsParams {
  mass: number;
  elasticity: number;
  force: number;
  gravity: number;
  friction: number;
}

type VisualMode = 'mesh' | 'wireframe-velocity' | 'wireframe-strain';

export class WebGlApp {
  public $canvas: HTMLCanvasElement;

  public pane!: Pane;
  public gui!: FolderApi;
  public scene: Scene;
  public clock: Clock;
  public renderer: WebGPURenderer;
  private renderPipeline!: RenderPipeline;
  public viewport: Viewport;
  public pointer: Pointer;
  public stats: Stats;
  private controls: OrbitControls;
  private raycaster: Raycaster;

  private radFov: number;
  public camera: PerspectiveCamera;

  public worldBounds: null | WorldBounds = null;

  public cursorSphere: Sphere;
  public cursorSpherePrevPosition = new Vector3();
  public cursorSphereVelocity = new Vector3();
  public cursorSphereHelper: Mesh;
  private cursorPlane = new Plane(new Vector3(0, 0, 1), 0);
  private cursorPlaneHit = new Vector3();
  private hasCursorBeenSet = false;

  private pointHelpers!: PointHelpers;
  private linkHelpers!: LinkHelpers;

  private cloth: Mesh;
  private clothPositions?: Float32Array;
  private clothIndices?: Uint32Array;
  private clothIndexCount = 0;
  private clothTopologyNeedsUpdate = true;
  private pointIndexLookup = new WeakMap<Point, number>();
  private linkLookup = new Set<string>();
  private simGridSchema = { nbCols: GRID.x, nbRows: GRID.y };

  private pPoint: Point[] = [];

  private pLink: Link[] = [];

  public physicsParams: PhysicsParams = {
    mass: 4,
    elasticity: 0.009,
    force: FORCE,
    gravity: GRAVITY,
    friction: 0.002,
  };

  public gridSchema = {
    nbCols: GRID.x,
    nbRows: GRID.y,
    spacing: 0.1,
  };

  public cursorParams = {
    radius: MOUSE_RADIUS,
  };

  public visualModeSelected: VisualMode = 'mesh';
  public visualModeSelector: Record<string, VisualMode> = {
    Mesh: 'mesh',
    'Wireframe (Velocity)': 'wireframe-velocity',
    'Wireframe (Strain)': 'wireframe-strain',
  };

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
    this.camera.position.z = 6;

    this.controls = new OrbitControls(this.camera, this.$canvas);
    this.controls.enabled = false;
    this.raycaster = new Raycaster();

    this.scene = new Scene();

    this.setupGui();
    this.setupEnvironment();

    this.cursorSphere = new Sphere(new Vector3(), MOUSE_RADIUS);
    this.cursorSphere.center.set(0, -10, 0);
    this.cursorSphereHelper = new Mesh(
      new CircleGeometry(MOUSE_RADIUS, 64),
      new MeshBasicNodeMaterial({
        color: 0x9ee8ff,
        transparent: true,
        opacity: 0.25,
        depthTest: false,
      })
    );

    this.scene.add(this.cursorSphereHelper);

    // this.setBox();
    // this.setPendulum();
    this.setupPostProcessing();

    const clothMaterial = new MeshStandardMaterial({
      side: DoubleSide,
      color: 0x3e3f52,
    });
    // new TextureLoader().load('/shrek.jpg', (texture) => {
    //   console.log(texture);
    //   clothMaterial.map = texture;
    //   clothMaterial.needsUpdate = true;
    // });
    const fresnel = normalView
      .normalize()
      .dot(positionViewDirection.normalize())
      .clamp()
      .oneMinus()
      .pow(2);
    clothMaterial.emissiveNode = tslColor(0x9ee8ff).mul(fresnel);

    // clothMaterial.fragmentNode = normalWorld;
    this.cloth = new Mesh(new BufferGeometry(), clothMaterial);
    // clothMaterial.flatShading = true;
    this.scene.add(this.cloth);

    this.generateSim();

    this.renderer.setAnimationLoop(this.tick);
    this.start();
  }

  private generateSim(): void {
    this.pPoint = [];
    this.pLink = [];
    if (this.pointHelpers) this.scene.remove(this.pointHelpers);
    if (this.linkHelpers) this.scene.remove(this.linkHelpers);

    this.setGrid();
    this.createVisibleObjects();
    this.rebuildClothGeometry();
    this.updateVisualMode();
  }

  private setupGui(): void {
    this.pane = new Pane();
    this.gui = this.pane.addFolder({ title: 'Verlet Integration' });
    this.gui
      .addBinding(this, 'visualModeSelected', {
        options: this.visualModeSelector,
      })
      .on('change', this.updateVisualMode);
    this.gui
      .addBinding(this.cursorParams, 'radius', { min: 0.1, max: 2 })
      .on('change', () => {
        this.cursorSphere.radius = this.cursorParams.radius;
        this.cursorSphereHelper.scale.set(
          this.cursorParams.radius / MOUSE_RADIUS,
          this.cursorParams.radius / MOUSE_RADIUS,
          this.cursorParams.radius / MOUSE_RADIUS
        );
      });
    this.gui.addBinding(this.physicsParams, 'mass', { min: 1, max: 10 });
    this.gui.addBinding(this.physicsParams, 'elasticity', {
      min: 0,
      max: 0.02,
      step: 0.0001,
    });
    this.gui.addBinding(this.physicsParams, 'force', {
      label: 'wind',
      min: 0,
      max: 10,
    });
    this.gui.addBinding(this.physicsParams, 'gravity', {
      min: 0,
      max: 100,
    });
    this.gui.addBinding(this.physicsParams, 'friction', {
      min: 0.001,
      max: 0.1,
      step: 0.001,
    });

    const simFolder = this.gui.addFolder({ title: 'Simulation' });
    simFolder.addBinding(this.gridSchema, 'nbCols', {
      min: 2,
      max: 81,
      step: 1,
    });
    simFolder.addBinding(this.gridSchema, 'nbRows', {
      min: 2,
      max: 81,
      step: 1,
    });
    simFolder.addBinding(this.gridSchema, 'spacing', { min: 0.01, max: 0.5 });
    this.gui.addButton({ title: 'Reset Simulation' }).on('click', () => {
      this.generateSim();
    });
  }

  public updateVisualMode = () => {
    if (this.visualModeSelected === 'mesh') {
      this.cloth.visible = true;
      this.pointHelpers.visible = false;
      this.linkHelpers.visible = false;
    } else {
      this.cloth.visible = false;
      this.pointHelpers.visible = true;
      this.linkHelpers.visible = true;
    }
  };

  private setupEnvironment(): void {
    this.scene.background = new Color(BACKGROUND_COLOR);

    const directionalLight = new DirectionalLight(new Color(0xffffff), 5);
    directionalLight.position.set(10, 8, 1);
    this.scene.add(directionalLight);

    const ambientLight = new AmbientLight(new Color(0xffffff), 0.1);
    this.scene.add(ambientLight);
    const xyPlane = new GridHelper(30, 30).rotateX(Math.PI / 2);
    xyPlane.position.z = -1;
    this.scene.add(xyPlane);

    const envRotation = new Euler(0, Math.PI / 2, 0);
    this.scene.backgroundRotation.copy(envRotation);
    this.scene.environmentRotation.copy(envRotation);

    new TextureLoader().load('/shrek-hdri.png', (texture) => {
      texture.mapping = EquirectangularReflectionMapping;
      texture.colorSpace = SRGBColorSpace;
      //   this.scene.background = texture;
    });
  }

  private setupPostProcessing(): void {
    const scenePass = pass(this.scene, this.camera);
    const sceneColor = scenePass.getTextureNode();

    this.renderPipeline = new RenderPipeline(this.renderer);
    this.renderPipeline.outputNode = sceneColor.add(
      bloom(sceneColor, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD)
    );
  }

  private setGrid(): void {
    const gridSchema = new Vector2(
      this.gridSchema.nbCols,
      this.gridSchema.nbRows
    );
    this.simGridSchema.nbCols = this.gridSchema.nbCols;
    this.simGridSchema.nbRows = this.gridSchema.nbRows;
    const gridCenter = new Vector2(0, 0);
    const gridSpacing = new Vector2(
      this.gridSchema.spacing,
      this.gridSchema.spacing
    );

    const ttSizeY = gridSpacing.y * (gridSchema.y - 1);
    const ttSizeX = gridSpacing.x * (gridSchema.x - 1);

    const points: Point[] = [];
    const links: Link[] = [];

    let pIndex = 0;
    for (let row = 0; row < gridSchema.y; row++) {
      const y = gridCenter.y + ttSizeY - gridSpacing.y * row - ttSizeY / 2;
      for (let col = 0; col < gridSchema.x; col++) {
        let x = gridCenter.x + gridSpacing.x * col - ttSizeX / 2;
        const z = row === 0 ? 0 : Math.abs(x) * 0.05;

        const newPoint = new Point({
          app: this,
          physic: {
            isPinned: row === 0 && (col % 5 === 0 || col === gridSchema.x - 1),
            // isPinned: false,
            position: new Vector3(x, y, z),
            prevPosition: new Vector3(x, y, z),
          },
        });
        points.push(newPoint);

        if (pIndex > 0) {
          const p0Idx = pIndex - 1;
          const p1Index = pIndex;
          if (col > 0) {
            const newLink = new Link({
              app: this,
              physic: {
                p0: points[p0Idx],
                p1: points[p1Index],
                length: points[p0Idx].position.distanceTo(
                  points[p1Index].position
                ),
              },
            });

            links.push(newLink);
          }
        }
        if (row > 0) {
          const p0Idx = pIndex - 1;
          const p1Index = pIndex;

          links.push(
            new Link({
              app: this,
              physic: {
                p0: points[p0Idx - (gridSchema.x - 1)],
                p1: points[p1Index],
                length: points[p0Idx - (gridSchema.x - 1)].position.distanceTo(
                  points[p1Index].position
                ),
              },
            })
          );
        }
        pIndex++;
      }
    }

    this.pPoint.push(...points);
    this.pLink.push(...links);
    this.refreshPointIndexLookup();
    this.clothTopologyNeedsUpdate = true;

    console.log('nb Points:', this.pPoint.length);
    console.log('nb Links:', this.pLink.length);
  }

  private refreshPointIndexLookup(): void {
    this.pointIndexLookup = new WeakMap();
    for (let i = 0; i < this.pPoint.length; i++) {
      this.pointIndexLookup.set(this.pPoint[i], i);
    }
  }

  private linkKey(indexA: number, indexB: number): string {
    return indexA < indexB ? `${indexA}:${indexB}` : `${indexB}:${indexA}`;
  }

  private rebuildLinkLookup(): void {
    this.linkLookup.clear();

    for (let i = 0; i < this.pLink.length; i++) {
      const p0Index = this.pointIndexLookup.get(this.pLink[i].p0);
      const p1Index = this.pointIndexLookup.get(this.pLink[i].p1);

      if (p0Index === undefined || p1Index === undefined) continue;
      this.linkLookup.add(this.linkKey(p0Index, p1Index));
    }
  }

  private hasLiveCellEdge(indexA: number, indexB: number): boolean {
    return (
      !this.pPoint[indexA].isDead &&
      !this.pPoint[indexB].isDead &&
      this.linkLookup.has(this.linkKey(indexA, indexB))
    );
  }

  private rebuildClothGeometry(): void {
    this.cloth.geometry.dispose();
    this.cloth.geometry = new BufferGeometry();

    this.clothPositions = new Float32Array(this.pPoint.length * 3);
    const clothPositionAttr = new BufferAttribute(this.clothPositions, 3);
    clothPositionAttr.setUsage(DynamicDrawUsage);
    this.cloth.geometry.setAttribute('position', clothPositionAttr);

    const maxIndexCount =
      (this.simGridSchema.nbCols - 1) * (this.simGridSchema.nbRows - 1) * 6;
    this.clothIndices = new Uint32Array(maxIndexCount);
    const clothIndexAttr = new BufferAttribute(this.clothIndices, 1);
    clothIndexAttr.setUsage(DynamicDrawUsage);
    this.cloth.geometry.setIndex(clothIndexAttr);
    this.cloth.geometry.setDrawRange(0, 0);

    this.clothTopologyNeedsUpdate = true;
    this.updateClothBuffers();
  }

  private updateClothTopology(): void {
    if (!this.clothIndices || !this.cloth.geometry.index) return;

    this.rebuildLinkLookup();

    const { nbCols, nbRows } = this.simGridSchema;
    let writeIndex = 0;

    for (let row = 0; row < nbRows - 1; row++) {
      for (let col = 0; col < nbCols - 1; col++) {
        /**
         * topLeft ---- topRight
            |          |
            |          |
          bottomLeft - bottomRight
         */
        const topLeft = row * nbCols + col;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + nbCols;
        const bottomRight = bottomLeft + 1;

        const hasTop = this.hasLiveCellEdge(topLeft, topRight);
        const hasRight = this.hasLiveCellEdge(topRight, bottomRight);
        const hasBottom = this.hasLiveCellEdge(bottomLeft, bottomRight);
        const hasLeft = this.hasLiveCellEdge(topLeft, bottomLeft);

        if (!hasTop || !hasRight || !hasBottom || !hasLeft) continue;

        this.clothIndices[writeIndex++] = topLeft;
        this.clothIndices[writeIndex++] = bottomLeft;
        this.clothIndices[writeIndex++] = topRight;
        this.clothIndices[writeIndex++] = topRight;
        this.clothIndices[writeIndex++] = bottomLeft;
        this.clothIndices[writeIndex++] = bottomRight;
      }
    }

    this.clothIndexCount = writeIndex;
    this.cloth.geometry.setDrawRange(0, this.clothIndexCount);
    this.cloth.geometry.index.needsUpdate = true;
    this.clothTopologyNeedsUpdate = false;
  }

  private updateClothBuffers(): void {
    if (!this.clothPositions) return;

    for (let i = 0; i < this.pPoint.length; i++) {
      const p = this.pPoint[i].position;
      const base = i * 3;
      this.clothPositions[base] = p.x;
      this.clothPositions[base + 1] = p.y;
      this.clothPositions[base + 2] = p.z;
    }

    this.cloth.geometry.attributes.position.needsUpdate = true;

    if (this.clothTopologyNeedsUpdate) {
      this.updateClothTopology();
    }

    this.cloth.geometry.computeVertexNormals();
  }

  public setBox(): void {
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

  public setPendulum(): void {
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
        transparent: true,
        vertexColors: true,
        opacity: 1,
      }),
      links: this.pLink,
      app: this,
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

  public update = (): void => {
    this.clock.update();
    this.viewport.update();
    this.controls.update();

    this.raycaster.setFromCamera(this.pointer.ndcPointer, this.camera);
    const planeHit = this.raycaster.ray.intersectPlane(
      this.cursorPlane,
      this.cursorPlaneHit
    );

    this.cursorSpherePrevPosition.copy(this.cursorSphere.center);
    if (planeHit) {
      this.cursorSphere.center.copy(this.cursorPlaneHit);
      if (this.hasCursorBeenSet) {
        this.cursorSphereVelocity
          .copy(this.cursorSphere.center)
          .sub(this.cursorSpherePrevPosition);
      }
      this.hasCursorBeenSet = true;
    }
    this.cursorSphereHelper.position.copy(this.cursorSphere.center);

    for (let i = 0; i < this.pPoint.length; i++) {
      this.pPoint[i].updatePhysic(this.physicsParams, this.clock.delta);
    }

    for (let i = 0; i < 4; i++) {
      // going backward to prevent skipping items after removal
      for (let i = this.pLink.length - 1; i >= 0; i--) {
        const isTeared = this.pLink[i].updateConstraintsToPoint();
        if (isTeared) {
          this.pLink[i].unlinkPoints();
          this.pLink.splice(i, 1);
          this.linkHelpers.removeInstance();
          this.clothTopologyNeedsUpdate = true;
        }
      }
    }

    this.pointHelpers.update();
    this.linkHelpers.updateTransformation();

    this.updateClothBuffers();

    this.camera.updateMatrixWorld();
    this.cloth.updateMatrixWorld();

    this.pointer.reset();
  };

  public render = (): void => {
    this.renderPipeline.render();
  };

  public tick = (): void => {
    this.update();
    this.render();
    this.stats.update();
  };

  stop() {
    this.pointer.stop();
  }
}
