import {
  BufferGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import type { MeshBasicNodeMaterial } from 'three/webgpu';
import type { Link } from './Link';

const TMP_QUAT = new Quaternion();
const TMP_MATRIX = new Matrix4();
const TMP_SCALE = new Vector3();

const V3A = new Vector3();
const V3B = new Vector3();
const UP = new Vector3(0, 1, 0);

interface LinkHelpersParameters {
  geometry: BufferGeometry;
  material: MeshBasicNodeMaterial;
  links: Link[];
}

export class LinkHelpers extends InstancedMesh {
  private links: Link[];

  constructor({ geometry, material, links }: LinkHelpersParameters) {
    super(geometry, material, links.length);
    this.links = links;

    this.updateTransformation();
  }

  removeInstance(index: number) {
    this.count = this.links.length;
    this.instanceMatrix.needsUpdate = true;
  }

  public updateTransformation() {
    for (let i = 0; i < this.links.length; i++) {
      const { p0, p1 } = this.links[i];

      const midPoint = V3A.copy(p0.position)
        .add(p1.position)
        .multiplyScalar(0.5);
      const delta = V3B.copy(p1.position).sub(p0.position);
      const length = delta.length();

      if (length === 0) {
        TMP_MATRIX.identity();
        this.setMatrixAt(i, TMP_MATRIX);
        continue;
      }

      TMP_SCALE.set(1, length, 1);
      TMP_QUAT.setFromUnitVectors(UP, delta.normalize());

      TMP_MATRIX.compose(midPoint, TMP_QUAT, TMP_SCALE);
      this.setMatrixAt(i, TMP_MATRIX);

      this.instanceMatrix.needsUpdate = true;
    }
  }
}
