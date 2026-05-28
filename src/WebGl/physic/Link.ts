import { Sphere, Vector3 } from 'three';
import type { WebGlApp, WorldBounds } from '../WebGlApp';
import type { Point } from './Point';

const V3 = new Vector3();

export interface LinkPhysicParameters {
  p0: Point;
  p1: Point;
  length: number;
}

export interface LinkParameters {
  app: WebGlApp;
  physic: LinkPhysicParameters;
}

export class Link {
  private app: WebGlApp;

  public p0: Point;
  public p1: Point;
  public length: number;
  private tear = 10;

  constructor({ app, physic }: LinkParameters) {
    this.app = app;

    this.p0 = physic.p0.connectLink(this);
    this.p1 = physic.p1.connectLink(this);
    this.length = physic.length;
  }

  public unlinkPoints() {
    this.p0.removeLink(this);
    this.p1.removeLink(this);
  }

  public updateConstraintsToPoint(): boolean {
    const { p0, p1, length } = this;
    const delta = V3.copy(p1.position).sub(p0.position);
    const dist = delta.length();
    const difference = dist - length;

    if (
      this.app.cursorSphere &&
      (difference > this.tear * this.length ||
        ((this.app.cursorSphere.containsPoint(p0.position) ||
          this.app.cursorSphere.containsPoint(p1.position)) &&
          this.app.worldBounds &&
          this.app.pointer.isDown))
    ) {
      return true;
    }

    const offset = V3.copy(delta)
      .normalize()
      .multiplyScalar(difference * 0.5);

    if (!p0.isPinned) p0.position.add(offset);
    if (!p1.isPinned) p1.position.sub(offset);

    return false;
  }
}
