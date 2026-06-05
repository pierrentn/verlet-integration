import {
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import type { MeshBasicNodeMaterial } from 'three/webgpu';
import type { Link } from './Link';
import type { WebGlApp } from '../WebGlApp';

const TMP_QUAT = new Quaternion();
const TMP_MATRIX = new Matrix4();
const TMP_SCALE = new Vector3();

const V3A = new Vector3();
const V3B = new Vector3();
const UP = new Vector3(0, 1, 0);

const BASE_COLOR = new Color(0x000000);
const SPEED_COLOR_SCALE = 1000;

interface LinkHelpersParameters {
  geometry: BufferGeometry;
  material: MeshBasicNodeMaterial;
  links: Link[];
  app: WebGlApp;
}

export class LinkHelpers extends InstancedMesh {
  private links: Link[];
  private colorBuffer: Float32Array;
  private app: WebGlApp;

  constructor({ geometry, material, links, app }: LinkHelpersParameters) {
    super(geometry, material, links.length);
    this.links = links;
    this.app = app;

    this.colorBuffer = new Float32Array(links.length * 3);
    for (let i = 0; i < links.length; i++) {
      this.colorBuffer[i * 3] = BASE_COLOR.r;
      this.colorBuffer[i * 3 + 1] = BASE_COLOR.g;
      this.colorBuffer[i * 3 + 2] = BASE_COLOR.b;
    }

    this.instanceColor = new InstancedBufferAttribute(this.colorBuffer, 3);
    this.instanceColor.setUsage(DynamicDrawUsage);
    this.instanceColor.needsUpdate = true;

    this.updateTransformation();
  }

  removeInstance() {
    this.count = this.links.length;
    this.instanceMatrix.needsUpdate = true;
  }

  public updateTransformation() {
    for (let i = 0; i < this.links.length; i++) {
      const { p0, p1, length } = this.links[i];

      const midPoint = V3A.copy(p0.position)
        .add(p1.position)
        .multiplyScalar(0.5);
      const delta = V3B.copy(p1.position).sub(p0.position);
      const dist = delta.length();

      const strain = Math.min(Math.abs(dist - length) / length, 1);
      const p0Vel = p0.position.distanceToSquared(p0.prevPosition);
      const p1Vel = p1.position.distanceToSquared(p1.prevPosition);
      const vel = Math.min((p0Vel + p1Vel) * SPEED_COLOR_SCALE, 1);

      this.colorBuffer[i * 3] =
        this.app.visualModeSelected === 'wireframe-strain' ? strain : 0;
      this.colorBuffer[i * 3 + 1] =
        this.app.visualModeSelected === 'wireframe-velocity' ? vel : 0;
      this.colorBuffer[i * 3 + 2] = 0;

      if (dist === 0) {
        TMP_MATRIX.identity();
        this.setMatrixAt(i, TMP_MATRIX);
        continue;
      }

      TMP_SCALE.set(1, dist, 1);
      TMP_QUAT.setFromUnitVectors(UP, delta.normalize());

      TMP_MATRIX.compose(midPoint, TMP_QUAT, TMP_SCALE);
      this.setMatrixAt(i, TMP_MATRIX);
    }

    this.instanceMatrix.needsUpdate = true;
    if (this.instanceColor) this.instanceColor.needsUpdate = true;
  }
}
