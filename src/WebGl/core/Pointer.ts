import { Vector2 } from 'three';
import type { Clock } from './Clock';
import type { Viewport } from './Viewport';

interface PointerParameters {
  viewport: Viewport;
  clock: Clock;
}

export class Pointer {
  private viewport: Viewport;

  public pointer = new Vector2();
  public ndcPointer = new Vector2();
  public velocity = new Vector2();
  public ndcVelocity = new Vector2();

  public isDown = false;

  constructor({ viewport }: PointerParameters) {
    this.viewport = viewport;
  }

  public start() {
    window.addEventListener('pointermove', this.onMouseMove);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  private onMouseMove = (e: MouseEvent) => {
    const nextPointerX = e.clientX;
    const nextPointerY = e.clientY;
    const nextNdcX = (nextPointerX / this.viewport.size.x) * 2 - 1;
    const nextNdcY = (nextPointerY / this.viewport.size.y) * -2 + 1;

    this.velocity.set(
      nextPointerX - this.pointer.x,
      nextPointerY - this.pointer.y
    );
    this.ndcVelocity.set(
      nextNdcX - this.ndcPointer.x,
      nextNdcY - this.ndcPointer.y
    );

    this.pointer.set(nextPointerX, nextPointerY);
    this.ndcPointer.set(nextNdcX, nextNdcY);
  };

  private onPointerDown = () => {
    this.isDown = true;
    this.velocity.set(0, 0);
    this.ndcVelocity.set(0, 0);
  };

  private onPointerUp = () => {
    this.isDown = false;
  };

  public stop() {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  public reset() {
    this.velocity.set(0, 0);
    this.ndcVelocity.set(0, 0);
  }
}
