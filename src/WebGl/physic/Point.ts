import { Sphere, Vector3 } from 'three';
import type { WebGlApp, WorldBounds } from '../WebGlApp';
import { clamp } from '../../utils/maths';
import type { Link } from './Link';

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

  public mass = 5;
  private elasticity = 0.005;
  private bounce = 0.9;
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

  public updatePhysic(
    simulationParams: { force: number; gravity: number; friction: number },
    dt: number
  ) {
    const { force, gravity, friction } = simulationParams;
    const { position, prevPosition, isPinned, mass } = this;
    if (isPinned || this.isDead) return;
    const acceleration = V3.set(
      force / mass,
      (force + gravity * -1) / mass,
      force / mass
    ); //newton's second law

    const sqDt = dt * dt;

    let newX, newY, newZ;
    if (
      this.app.cursorSphere &&
      this.app.cursorSphere.containsPoint(position) &&
      this.app.worldBounds
      // &&
      // this.pointer.isDown
    ) {
      const dragX = clamp(
        this.app.pointer.ndcVelocity.x * this.app.worldBounds.maxX,
        -this.elasticity,
        this.elasticity
      );
      const dragY = clamp(
        this.app.pointer.ndcVelocity.y * this.app.worldBounds.maxY,
        -this.elasticity,
        this.elasticity
      );

      const dragZ = clamp(
        this.app.pointer.ndcVelocity.length() * this.app.worldBounds.maxY,
        -this.elasticity,
        this.elasticity
      );

      newX =
        position.x +
        ((position.x - prevPosition.x) * friction + dragX) +
        acceleration.x * sqDt;
      newY =
        position.y +
        ((position.y - prevPosition.y) * friction + dragY) +
        acceleration.y * sqDt;
      newZ =
        position.z +
        ((position.z - prevPosition.z) * friction + dragZ) +
        acceleration.z * sqDt;
    } else {
      newX =
        position.x +
        (position.x - prevPosition.x) * friction +
        acceleration.x * sqDt;
      newY =
        position.y +
        (position.y - prevPosition.y) * friction +
        acceleration.y * sqDt;
      newZ =
        position.z +
        (position.z - prevPosition.z) * friction +
        acceleration.z * sqDt;
    }

    prevPosition.copy(position);
    position.set(newX, newY, newZ);
  }

  public applyConstraints(simulationParams: {
    force: number;
    gravity: number;
    friction: number;
  }) {
    const { friction } = simulationParams;
    if (this.app.worldBounds && !this.isDead) {
      const { position, prevPosition } = this;
      const velX = (position.x - prevPosition.x) * friction;
      const velY = (position.y - prevPosition.y) * friction;
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
