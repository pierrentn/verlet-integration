import {
  BufferGeometry,
  Line,
  LineBasicNodeMaterial,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import { Clock, Viewport } from './core';

const V3 = new Vector3();
const V3B = new Vector3();

const FOV = 75;
const NEAR = 0.1;
const FAR = 1000;

const GRAVITY = 0.001;
const FRICTION = 0.999;
const BOUNCE = 0.9;

const POINT_SIZE = 0.03;

let _instance: WebGlApp | null = null;

interface PPoint {
  pos: Vector3;
  prevPos: Vector3;
  frozen: boolean;
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

  private radFov: number;
  public camera: PerspectiveCamera;

  private worldBounds: null | {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } = null;
  private points: Mesh[] = [];
  private links: Line[] = [];

  private pPoint: PPoint[] = [];
  private pLink: PLink[] = [];

  public static getInstance(): WebGlApp {
    if (!_instance) {
      _instance = new WebGlApp();
    }
    return _instance;
  }

  private constructor() {
    this.$canvas = document.createElement('canvas');
    this.$canvas.classList.add('webgl-canvas');
    console.log(this.$canvas);
    document.body.appendChild(this.$canvas);

    this.clock = new Clock();
    this.renderer = new WebGPURenderer({
      canvas: this.$canvas,
      antialias: true,
    });

    this.viewport = new Viewport({
      $canvas: this.$canvas,
      resize: this.resize,
    });

    this.camera = new PerspectiveCamera(FOV, this.viewport.ratio, NEAR, FAR);
    this.radFov = (this.camera.fov * Math.PI) / 180;
    this.camera.position.z = 5;

    this.scene = new Scene();

    // this.setBox();
    // this.setPendulum();
    this.setGrid();

    this.createVisibleObjects();

    this.renderer.setAnimationLoop(this.tick);
    this.start();
  }

  //   [
  //     [],
  //     [],
  //     [],
  //     [],
  //   ]

  private setGrid(): void {
    const gridSchema = new Vector2(4, 4);
    const gridCenter = new Vector2(0, 0);
    const gridSpacing = new Vector2(0.5, 0.5);
    let pIndex = 0;
    const grid = [];

    for (let row = 0; row <= gridSchema.x; row++) {
      const ttSizeY = gridSpacing.y * gridSchema.y;
      const y = ttSizeY - gridSpacing.y * row - ttSizeY / 2;

      for (let col = 0; col <= gridSchema.y; col++) {
        const ttSizeX = gridSpacing.x * gridSchema.x;
        let x = gridSpacing.x * col - ttSizeX / 2;

        const newPoint: PPoint = {
          frozen: (pIndex === 0 || pIndex === gridSchema.x) && row === 0,
          pos: new Vector3(x, y, 0),
          prevPos: new Vector3(x, y, 0),
        };
        this.pPoint.push(newPoint);
        if (pIndex > 0) {
          console.log(col + row);
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

          if (row > 0) {
            this.pLink.push({
              p0: this.pPoint[p0Idx - gridSchema.x],
              p1: this.pPoint[p1Index],
              length: this.pPoint[p0Idx - gridSchema.x].pos.distanceTo(
                this.pPoint[p1Index].pos
              ),
            });
          }
        }
        pIndex++;
      }
    }
  }

  private setBox(): void {
    this.pPoint.push({
      pos: new Vector3(0, 0, 0),
      prevPos: new Vector3(-0.05, -0.05, 0),
      frozen: false,
    });
    this.pPoint.push({
      pos: new Vector3(0, 1, 0),
      prevPos: new Vector3(0, 1, 0),
      frozen: false,
    });
    this.pPoint.push({
      pos: new Vector3(1, 1, 0),
      prevPos: new Vector3(1, 1, 0),
      frozen: false,
    });
    this.pPoint.push({
      pos: new Vector3(1, 0, 0),
      prevPos: new Vector3(1, 0, 0),
      frozen: false,
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
    const offsetZ = 0.1;
    const baseY = 3;
    for (let i = 0; i < pendulumNbPoints; i++) {
      const newP = {
        pos: new Vector3(0 - offsetX * i, baseY - offsetY * i, offsetZ * i),
        prevPos: new Vector3(0 - offsetX * i, baseY - offsetY * i, offsetZ * i),
        frozen: i === 0,
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
    for (let i = 0; i < this.pPoint.length; i++) {
      const m = new Mesh(
        new SphereGeometry(POINT_SIZE, 5, 5),
        new MeshBasicNodeMaterial({ color: 'red', wireframe: true })
      );
      this.points.push(m);
      this.scene.add(m);
    }

    for (let i = 0; i < this.pLink.length; i++) {
      const physicsLink = this.pLink[i];
      const linkGeometry = new BufferGeometry().setFromPoints([
        physicsLink.p0.pos,
        physicsLink.p1.pos,
      ]);
      const link = new Line(
        linkGeometry,
        new LineBasicNodeMaterial({ color: 0x000000 })
      );
      this.links.push(link);
      this.scene.add(link);
    }
  }

  private start(): void {
    this.clock.start();
    this.viewport.start();

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
      const { pos, prevPos, frozen } = this.pPoint[i];
      if (frozen) continue;
      const velX = (pos.x - prevPos.x) * FRICTION;
      const velY = (pos.y - prevPos.y) * FRICTION;
      const velZ = (pos.z - prevPos.z) * FRICTION;

      let newX = pos.x + velX;
      let newY = pos.y + velY - GRAVITY;
      let newZ = pos.z + velZ;

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

      if (!p0.frozen) p0.pos.add(offset);
      if (!p1.frozen) p1.pos.sub(offset);
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

          if (!p.frozen && !pTest.frozen) {
            const offset = V3B.copy(dir).multiplyScalar(difference * 0.5);
            p.pos.add(offset);
            pTest.pos.sub(offset);
          } else if (!p.frozen) {
            const offset = V3B.copy(dir).multiplyScalar(difference);
            p.pos.add(offset);
          } else if (!pTest.frozen) {
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
        const { pos, prevPos } = this.pPoint[i];
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
    for (let i = 0; i < this.points.length; i++) {
      const objPPoint = this.pPoint[i];
      const obj = this.points[i];
      if (objPPoint) {
        obj.position.copy(objPPoint.pos);
      }
    }
  }

  private updateLinksPosition(): void {
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i];
      const pLink = this.pLink[i];
      if (pLink) {
        link.geometry.setFromPoints([pLink.p0.pos, pLink.p1.pos]);
      }
    }
  }

  public update = (): void => {
    this.clock.update();
    this.viewport.update();
    this.updatePhysicsPoints();
    this.updatePhysicsLinks();
    for (let i = 0; i < 4; i++) {
      this.applyCollision();
    }
    // this.applyConstraint();
    this.updatePointsPosition();
    this.updateLinksPosition();
  };

  public render = (): void => {
    this.renderer.render(this.scene, this.camera);
  };

  public tick = (): void => {
    this.update();
    this.render();
  };
}
