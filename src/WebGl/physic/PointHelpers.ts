import { BufferGeometry, InstancedMesh, Object3D } from 'three';
import {
  Color,
  InstancedBufferAttribute,
  Matrix4,
  type MeshBasicNodeMaterial,
} from 'three/webgpu';
import type { Point } from './Point';

const TMP_MATRIX = new Matrix4();

const BASE_COLOR = new Color(0xff0000);

export interface PointHelpersParameters {
  geometry: BufferGeometry;
  material: MeshBasicNodeMaterial;
  points: Point[];
}

export class PointHelpers extends InstancedMesh {
  public points: Point[];

  private colorBuffer: Float32Array;

  constructor({ geometry, material, points }: PointHelpersParameters) {
    super(geometry, material, points.length);

    this.points = points;

    for (let i = 0; i < points.length; i++) {
      this.setTransformation(i);
    }

    this.colorBuffer = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      this.colorBuffer[i * 3] = BASE_COLOR.r;
      this.colorBuffer[i * 3 + 1] = BASE_COLOR.g;
      this.colorBuffer[i * 3 + 2] = BASE_COLOR.b;
    }

    this.instanceColor = new InstancedBufferAttribute(this.colorBuffer, 3);
    this.instanceColor.needsUpdate = true;
  }

  setTransformation(index: number) {
    const point = this.points[index];

    TMP_MATRIX.setPosition(point.position);
    super.setMatrixAt(index, TMP_MATRIX);
    this.instanceMatrix.needsUpdate = true;
  }

  update() {
    for (let i = this.points.length - 1; i >= 0; i--) {
      if (this.points[i].isDead) {
        this.points.splice(i, 1);
        this.count = this.points.length;
        this.instanceMatrix.needsUpdate = true;
        continue;
      }
      this.setTransformation(i);
    }
  }
}
