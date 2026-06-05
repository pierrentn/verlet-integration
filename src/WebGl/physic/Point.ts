import { Vector3 } from 'three';
import type { PhysicsParams, WebGlApp } from '../WebGlApp';
import { clamp } from '../../utils/maths';
import type { Link } from './Link';
import { isXYInsideCircle } from '../../utils/distance';

const V3 = new Vector3();

export interface PhysicPointParameters {
  position: Vector3;
  prevPosition: Vector3;
  isPinned: boolean;
}
export interface PointParameters {
  app: WebGlApp;
  physic: PhysicPointParameters;
}

export class Point {
  private app: WebGlApp;

  public position: Vector3;
  public prevPosition: Vector3;
  public isPinned: boolean;

  public bounce = 0.9;
  public isDead = false;

  public connectedLinks: Link[] = [];

  constructor({ app, physic }: PointParameters) {
    this.app = app;

    this.position = physic.position;
    this.prevPosition = physic.prevPosition;
    this.isPinned = physic.isPinned;
  }

  public connectLink(link: Link) {
    this.connectedLinks.push(link);
    return this;
  }

  public removeLink(link: Link) {
    const index = this.connectedLinks.indexOf(link);
    if (index !== -1) {
      this.connectedLinks.splice(index, 1);
    }

    if (this.connectedLinks.length === 0) {
      this.isDead = true;
    }
    return this;
  }

  public updatePhysic(physicsParams: PhysicsParams, dt: number) {
    const { force, gravity, friction, mass, elasticity } = physicsParams;
    const { position, prevPosition, isPinned } = this;
    if (isPinned || this.isDead) return;
    const acceleration = V3.set(
      force / mass,
      (force + gravity * -1) / mass,
      force / mass
    ); //newton's second law

    const sqDt = dt * dt;

    const isInsideCursor = isXYInsideCircle(
      position,
      this.app.cursorSphere.center,
      this.app.cursorSphere.radius
    );

    let newX = 0,
      newY = 0,
      newZ = 0;
    if (
      isInsideCursor
      // &&
      // this.pointer.isDown
    ) {
      const dragX = clamp(
        this.app.cursorSphereVelocity.x,
        -elasticity,
        elasticity
      );
      const dragY = clamp(
        this.app.cursorSphereVelocity.y,
        -elasticity,
        elasticity
      );

      newX =
        position.x +
        ((position.x - prevPosition.x) * (1 - friction) + dragX) +
        acceleration.x * sqDt;
      newY =
        position.y +
        ((position.y - prevPosition.y) * (1 - friction) + dragY) +
        acceleration.y * sqDt;
      newZ =
        position.z +
        (position.z - prevPosition.z) * (1 - friction) +
        acceleration.z * sqDt;
    } else {
      newX =
        position.x +
        (position.x - prevPosition.x) * (1 - friction) +
        acceleration.x * sqDt;
      newY =
        position.y +
        (position.y - prevPosition.y) * (1 - friction) +
        acceleration.y * sqDt;
      newZ =
        position.z +
        (position.z - prevPosition.z) * (1 - friction) +
        acceleration.z * sqDt;
    }

    prevPosition.copy(position);
    position.set(newX, newY, newZ);
  }

  public applyConstraints(physicsParams: PhysicsParams) {
    const { friction } = physicsParams;
    if (this.app.worldBounds && !this.isDead) {
      const { position, prevPosition } = this;
      const velX = (position.x - prevPosition.x) * (1 - friction);
      const velY = (position.y - prevPosition.y) * (1 - friction);
      // const velZ = (position.z - prevPosition.x) * FRICTION;

      const { minX, maxX, minY, maxY } = this.app.worldBounds;

      if (position.x >= maxX) {
        position.x = maxX;
        this.prevPosition.x = maxX + velX * this.bounce;
      } else if (position.x <= minX) {
        position.x = minX;
        this.prevPosition.x = minX + velX * this.bounce;
      }

      if (position.y >= maxY) {
        position.y = maxY;
        this.prevPosition.y = maxY + velY * this.bounce;
      } else if (position.y <= minY) {
        position.y = minY;
        this.prevPosition.y = minY + velY * this.bounce;
      }
    }
  }
}
