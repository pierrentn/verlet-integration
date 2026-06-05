import { BufferGeometry, InstancedMesh } from 'three';
import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  Matrix4,
  type MeshBasicNodeMaterial,
} from 'three/webgpu';
import type { Point } from './Point';

const TMP_MATRIX = new Matrix4();

const BASE_COLOR = new Color(0xdddddd);

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
    this.instanceColor.setUsage(DynamicDrawUsage);
    this.instanceColor.needsUpdate = true;
  }

  setTransformation(index: number) {
    const point = this.points[index];

    if (point.isDead) {
      TMP_MATRIX.makeScale(0, 0, 0);
      super.setMatrixAt(index, TMP_MATRIX);
      this.instanceMatrix.needsUpdate = true;
      return;
    }

    TMP_MATRIX.identity();
    TMP_MATRIX.setPosition(point.position);
    super.setMatrixAt(index, TMP_MATRIX);
    this.instanceMatrix.needsUpdate = true;
  }

  update() {
    for (let i = this.points.length - 1; i >= 0; i--) {
      // const pointVelX =
      //   this.points[i].position.x - this.points[i].prevPosition.x;
      // const pointVelY =
      //   this.points[i].position.y - this.points[i].prevPosition.y;
      // const pointVel = Math.sqrt(pointVelX * pointVelX + pointVelY * pointVelY);
      // this.colorBuffer[i * 3] = 0;
      // this.colorBuffer[i * 3 + 1] = (pointVel * 100 * (pointVel * 100)) / 5;
      // this.colorBuffer[i * 3 + 2] = 0;

      this.setTransformation(i);
    }
    this.instanceMatrix.needsUpdate = true;
    this.instanceColor!.needsUpdate = true;
  }
}
